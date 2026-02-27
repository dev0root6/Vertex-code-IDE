export interface Definition {
    name: string;
    line: number;
    startCol: number;
    endCol: number;
}

export interface Relationship {
    start: { name: string, line: number, startCol: number, endCol: number };
    end: Definition;
    id: string;
}

export class ParserService {
    // Keywords that should never be treated as variables
    private static EXCLUDE: Record<string, Set<string>> = {
        javascript: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'function', 'const', 'let', 'var', 'class', 'return', 'console', 'require', 'import', 'export', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'void']),
        typescript: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'function', 'const', 'let', 'var', 'class', 'return', 'console', 'require', 'import', 'export', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'void', 'interface', 'type', 'enum', 'namespace', 'abstract', 'implements', 'extends', 'readonly', 'public', 'private', 'protected', 'static', 'async', 'await', 'number', 'string', 'boolean', 'any', 'never', 'unknown', 'infer', 'keyof', 'declare', 'get', 'set', 'constructor', 'super', 'break', 'continue', 'do', 'try', 'finally', 'throw', 'case', 'default', 'yield', 'delete', 'with', 'debugger', 'as', 'from', 'of', 'in']),
        python: new Set(['if', 'else', 'elif', 'for', 'while', 'class', 'return', 'print', 'range', 'def', 'import', 'from', 'with', 'as', 'try', 'except', 'pass', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'break', 'continue', 'del', 'raise']),
        java: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'new', 'return', 'class', 'throw', 'System', 'public', 'private', 'static', 'void', 'int', 'long', 'double', 'boolean', 'String', 'true', 'false', 'null']),
        c: new Set(['if', 'else', 'for', 'while', 'switch', 'return', 'printf', 'scanf', 'include', 'define', 'int', 'float', 'char', 'void', 'unsigned', 'long', 'short', 'struct', 'typedef', 'NULL']),
        cpp: new Set(['if', 'else', 'for', 'while', 'switch', 'return', 'cout', 'cin', 'endl', 'class', 'public', 'private', 'protected', 'std', 'vector', 'string', 'int', 'float', 'double', 'bool', 'void', 'true', 'false', 'nullptr', 'new', 'delete', 'this']),
        go: new Set(['if', 'else', 'for', 'range', 'switch', 'case', 'default', 'return', 'func', 'var', 'const', 'type', 'struct', 'interface', 'package', 'import', 'go', 'defer', 'select', 'chan', 'map', 'make', 'new', 'nil', 'true', 'false', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover', 'print', 'println', 'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'float32', 'float64', 'string', 'bool', 'byte', 'rune', 'error']),
        html: new Set(['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'input', 'button', 'script', 'style', 'link', 'meta', 'title', 'h1', 'h2', 'h3', 'section', 'main', 'nav', 'footer', 'header', 'class', 'id', 'href', 'src', 'type', 'value', 'name']),
        css: new Set(['px', 'em', 'rem', 'vw', 'vh', 'auto', 'none', 'block', 'flex', 'grid', 'absolute', 'relative', 'fixed', 'sticky', 'hidden', 'visible', 'solid', 'dashed', 'dotted', 'bold', 'normal', 'italic', 'center', 'left', 'right', 'top', 'bottom', 'inherit', 'initial', 'unset']),
        json: new Set([]),
    };

    public static parse(code: string, languageId: string): Relationship[] {
        const lines = code.split('\n');
        const definitions = new Map<string, Definition>();
        const calls: { name: string, line: number, startCol: number, endCol: number, defSnapshot: Definition }[] = [];
        const lang = this.normalizeLanguageId(languageId);
        const excludeSet = this.EXCLUDE[lang] || this.EXCLUDE.javascript;

        const addDef = (name: string, line: number, lineText: string, searchFrom = 0) => {
            if (!name || excludeSet.has(name) || definitions.has(name)) return;
            const startCol = lineText.indexOf(name, searchFrom);
            if (startCol === -1) return;
            definitions.set(name, { name, line, startCol, endCol: startCol + name.length });
        };

        lines.forEach((line, lineNum) => {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') ||
                trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')
            ) { return; }

            // ── DEFINITIONS ──
            if (lang === 'python') {
                // Function definition: def add_numbers(a, b, c):
                const fnMatch = trimmed.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
                if (fnMatch) {
                    addDef(fnMatch[1], lineNum, line); // function name itself

                    // Find the opening paren in the REAL line to search params from correct offset
                    const parenIndex = line.indexOf('(');
                    if (parenIndex !== -1) {
                        // Extract each param and find its exact col inside the param list
                        const paramStr = fnMatch[2];
                        let searchFrom = parenIndex + 1;
                        paramStr.split(',').forEach(rawParam => {
                            const param = rawParam.trim().split('=')[0].trim().split(':')[0].trim().replace(/^\*+/, '');
                            if (param) {
                                const col = line.indexOf(param, searchFrom);
                                if (col !== -1 && !excludeSet.has(param)) {
                                    definitions.set(param, { name: param, line: lineNum, startCol: col, endCol: col + param.length });
                                    searchFrom = col + param.length;
                                }
                            }
                        });
                    }
                }

                // Variable assignment: x = 1, x, y = 1, 2
                const assignMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_,\s]*)\s*=/);
                if (assignMatch && !trimmed.startsWith('def ') && !trimmed.includes('==')) {
                    let searchFrom = 0;
                    assignMatch[1].split(',').forEach(v => {
                        const name = v.trim();
                        if (name && !excludeSet.has(name)) {
                            const col = line.indexOf(name, searchFrom);
                            if (col !== -1) {
                                definitions.set(name, { name, line: lineNum, startCol: col, endCol: col + name.length });
                                searchFrom = col + name.length;
                            }
                        }
                    });
                }

                // For loop variable: for x in range(...)
                const forMatch = trimmed.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_,\s]*)\s+in/);
                if (forMatch) {
                    let searchFrom = line.indexOf('for') + 3;
                    forMatch[1].split(',').forEach(v => {
                        const name = v.trim();
                        if (name && !excludeSet.has(name)) {
                            const col = line.indexOf(name, searchFrom);
                            if (col !== -1) {
                                definitions.set(name, { name, line: lineNum, startCol: col, endCol: col + name.length });
                                searchFrom = col + name.length;
                            }
                        }
                    });
                }

            } else if (lang === 'javascript' || lang === 'typescript') {
                // Class/Interface method: public methodName(...) or methodName(...)
                const methodMatch = trimmed.match(/^(?:(?:public|private|protected|static|async|readonly)\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
                if (methodMatch && !trimmed.startsWith('function ') && !trimmed.startsWith('if') && !trimmed.startsWith('for') && !trimmed.startsWith('while') && !trimmed.startsWith('switch')) {
                    const methodName = methodMatch[1];
                    // Only add method name if it's not a keyword
                    if (!excludeSet.has(methodName)) {
                        addDef(methodName, lineNum, line);
                    }
                    // Parse parameters
                    const parenIdx = line.indexOf('(', line.indexOf(methodName));
                    const paramsStr = methodMatch[2] || '';
                    let searchFrom = parenIdx + 1;
                    if (paramsStr.trim()) {
                        paramsStr.split(',').forEach(rawP => {
                            const p = rawP.trim().split('=')[0].trim().split(':')[0].trim().replace(/^\.\.\./, '').replace(/[?]/g, '');
                            if (p && !excludeSet.has(p)) {
                                const col = line.indexOf(p, searchFrom);
                                if (col !== -1) {
                                    definitions.set(p, { name: p, line: lineNum, startCol: col, endCol: col + p.length });
                                    searchFrom = col + p.length;
                                }
                            }
                        });
                    }
                }

                // Function declaration: function foo(a, b) or const foo = (a, b) => or const foo = async (a, b) =>
                const fnDeclMatch = trimmed.match(/(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?(?:function\s*)?\()\s*([^)]*)\)/);
                if (fnDeclMatch) {
                    const fnName = fnDeclMatch[1] || fnDeclMatch[2];
                    if (fnName) addDef(fnName, lineNum, line);
                    const parenIdx = line.indexOf('(');
                    const paramsStr = fnDeclMatch[3] || '';
                    let searchFrom = parenIdx + 1;
                    if (paramsStr.trim()) {
                        paramsStr.split(',').forEach(rawP => {
                            const p = rawP.trim().split('=')[0].trim().split(':')[0].trim().replace(/^\.\.\./, '').replace(/[?]/g, '');
                            if (p && !excludeSet.has(p)) {
                                const col = line.indexOf(p, searchFrom);
                                if (col !== -1) {
                                    definitions.set(p, { name: p, line: lineNum, startCol: col, endCol: col + p.length });
                                    searchFrom = col + p.length;
                                }
                            }
                        });
                    }
                }

                // TS: interface/type/enum/class declaration
                const tsTypeMatch = trimmed.match(/^(?:export\s+)?(?:interface|type|enum|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (tsTypeMatch) addDef(tsTypeMatch[1], lineNum, line);

                // Variable declaration: const x = ..., let y, var z
                const varMatch = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (varMatch) addDef(varMatch[1], lineNum, line);

                // Class properties: private _view?: Type or public name: string
                const propMatch = trimmed.match(/^(?:public|private|protected|readonly|static)\s+([a-zA-Z_][a-zA-Z0-9_]*)[?:]?\s*:/);
                if (propMatch) addDef(propMatch[1], lineNum, line);

                // For loop: for (let i = 0...) or for (const x of arr)
                const forMatch = trimmed.match(/^for\s*\(\s*(?:let|const|var)?\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (forMatch) addDef(forMatch[1], lineNum, line);

            } else if (lang === 'go') {
                // Function: func foo(a int, b string)
                const goFnMatch = trimmed.match(/^func\s+(?:\([^)]*\)\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
                if (goFnMatch) {
                    addDef(goFnMatch[1], lineNum, line);
                    const parenIdx = line.indexOf('(', line.indexOf(goFnMatch[1]));
                    let searchFrom = parenIdx + 1;
                    goFnMatch[2].split(',').forEach(rawP => {
                        // Go params: "a int" or "a, b int" — take first word
                        const p = rawP.trim().split(/\s+/)[0]?.trim();
                        if (p && !excludeSet.has(p)) {
                            const col = line.indexOf(p, searchFrom);
                            if (col !== -1) {
                                definitions.set(p, { name: p, line: lineNum, startCol: col, endCol: col + p.length });
                                searchFrom = col + p.length;
                            }
                        }
                    });
                }
                // Short variable declaration: x := value
                const goVarMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_,\s]*)\s*:=/);
                if (goVarMatch) {
                    let searchFrom = 0;
                    goVarMatch[1].split(',').forEach(v => {
                        const name = v.trim();
                        if (name && !excludeSet.has(name)) {
                            const col = line.indexOf(name, searchFrom);
                            if (col !== -1) { definitions.set(name, { name, line: lineNum, startCol: col, endCol: col + name.length }); searchFrom = col + name.length; }
                        }
                    });
                }
                // var/const declaration: var x int = ...
                const goVarDeclMatch = trimmed.match(/^(?:var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (goVarDeclMatch) addDef(goVarDeclMatch[1], lineNum, line);

            } else if (lang === 'html') {
                // Track id="..." and class="..." attribute values as definitions
                const idMatch = line.match(/id="([a-zA-Z_][a-zA-Z0-9_-]*)"/g);
                if (idMatch) idMatch.forEach(m => { const v = m.match(/id="([^"]+)"/); if (v) addDef(v[1], lineNum, line); });

            } else if (lang === 'css') {
                // Track CSS custom properties (variables): --my-color: ...
                const cssVarMatch = trimmed.match(/^(--[a-zA-Z][a-zA-Z0-9-]*)\s*:/);
                if (cssVarMatch) addDef(cssVarMatch[1], lineNum, line);
                // Track class/id selector names: .foo or #bar at start
                const selectorMatch = trimmed.match(/^[.#]([a-zA-Z_][a-zA-Z0-9_-]*)/);
                if (selectorMatch) addDef(selectorMatch[1], lineNum, line);

            } else if (lang === 'json') {
                // Track top-level JSON keys as definitions: "keyName":
                const jsonKeyMatch = trimmed.match(/^"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/);
                if (jsonKeyMatch) addDef(jsonKeyMatch[1], lineNum, line);

            } else if (['java', 'c', 'cpp'].includes(lang)) {
                // Method/function signature: void foo(int a, String b)
                const fnParamMatch = trimmed.match(/\(([^)]+)\)\s*(?:\{|throws)/);
                if (fnParamMatch) {
                    const paramStr = fnParamMatch[1];
                    paramStr.split(',').forEach(param => {
                        const parts = param.trim().split(/\s+/);
                        const pName = parts[parts.length - 1]?.replace(/[*&[\]]/g, '').trim();
                        if (pName) addDef(pName, lineNum, line);
                    });
                }

                // Variable declaration: int x = ...; or String name;
                const varDeclMatch = trimmed.match(/^(?:[a-zA-Z_*&][\w<>[\]*&\s]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|;|,)/);
                if (varDeclMatch) addDef(varDeclMatch[1], lineNum, line);
            }

            // ── USAGES: find all identifiers on this line that are defined ABOVE this line ──
            // Capture the definition snapshot at the time of usage detection
            const usageRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
            let usageMatch: RegExpExecArray | null;
            while ((usageMatch = usageRegex.exec(line)) !== null) {
                const word = usageMatch[1];
                if (!excludeSet.has(word) && definitions.has(word)) {
                    const def = definitions.get(word)!;
                    if (def.line < lineNum) {
                        // Capture definition snapshot at this exact moment (before any future re-registration)
                        calls.push({
                            name: word,
                            line: lineNum,
                            startCol: usageMatch.index,
                            endCol: usageMatch.index + word.length,
                            defSnapshot: { ...def }  // snapshot so future overwrites don't affect this
                        });
                    }
                }
            }
        });

        // Build final relationships using the snapshotted definitions
        const relationships: Relationship[] = [];
        const seen = new Set<string>();
        calls.forEach(call => {
            const def = call.defSnapshot;
            // Use only safe characters in ID (no > or special HTML chars)
            const id = `${call.name}_L${call.line}_C${call.startCol}_D${def.line}`;
            if (!seen.has(id)) {
                relationships.push({ start: call, end: def, id });
                seen.add(id);
            }
        });
        return relationships;
    }

    private static normalizeLanguageId(id: string): string {
        if (id === 'javascriptreact') { return 'javascript'; }
        if (id === 'typescriptreact') { return 'typescript'; }
        // All supported languages — return as-is
        const supported = ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'html', 'css', 'json'];
        return supported.includes(id) ? id : 'javascript'; // default to JS rules for unknown langs
    }
}
