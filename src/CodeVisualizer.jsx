import React, { useState, useEffect, useRef, useCallback } from 'react';
import Xarrow, { Xwrapper } from 'react-xarrows';

const CodeVisualizer = ({ editor, monaco, code, language }) => {
    const [arrows, setArrows] = useState([]);
    const [activeLine, setActiveLine] = useState(null);
    const containerRef = useRef(null);

    // Control-flow / built-in keywords to exclude per language
    const EXCLUDE = {
        javascript: new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'def', 'class', 'return', 'console', 'require', 'import', 'new', 'typeof', 'instanceof', 'delete', 'void', 'throw', 'try']),
        python: new Set(['if', 'for', 'while', 'class', 'return', 'print', 'range', 'len', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple', 'input', 'type', 'super', 'open', 'map', 'filter', 'zip', 'enumerate', 'sorted', 'reversed', 'abs', 'min', 'max', 'sum', 'any', 'all', 'isinstance', 'hasattr', 'getattr', 'setattr', 'import', 'from', 'with', 'as', 'try', 'except', 'raise', 'assert', 'del', 'pass', 'break', 'continue', 'yield', 'lambda', 'not', 'and', 'or', 'in', 'is']),
        java: new Set(['if', 'for', 'while', 'switch', 'catch', 'new', 'return', 'class', 'throw', 'throws', 'try', 'finally', 'import', 'package', 'extends', 'implements', 'interface', 'enum', 'assert', 'break', 'continue', 'do', 'else', 'instanceof', 'super', 'this', 'synchronized', 'System']),
        c: new Set(['if', 'for', 'while', 'switch', 'return', 'sizeof', 'printf', 'scanf', 'fprintf', 'fscanf', 'sprintf', 'sscanf', 'malloc', 'calloc', 'realloc', 'free', 'memcpy', 'memset', 'strlen', 'strcpy', 'strcat', 'strcmp', 'typedef', 'struct', 'union', 'enum', 'goto', 'break', 'continue', 'do', 'else', 'case', 'default', 'extern', 'static', 'const', 'volatile', 'register', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma']),
        cpp: new Set(['if', 'for', 'while', 'switch', 'return', 'sizeof', 'printf', 'scanf', 'cout', 'cin', 'endl', 'cerr', 'clog', 'new', 'delete', 'throw', 'try', 'catch', 'class', 'struct', 'union', 'enum', 'namespace', 'using', 'template', 'typename', 'typedef', 'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast', 'auto', 'decltype', 'constexpr', 'nullptr', 'this', 'virtual', 'override', 'final', 'explicit', 'friend', 'operator', 'goto', 'break', 'continue', 'do', 'else', 'case', 'default', 'extern', 'static', 'const', 'volatile', 'mutable', 'inline', 'include', 'define', 'std', 'vector', 'string', 'map', 'set', 'pair', 'sort', 'push_back', 'begin', 'end', 'size', 'empty', 'getline'])
    };

    const JAVA_MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'native']);

    const parseCode = useCallback((code, lang) => {
        const lines = code.split('\n');
        const definitions = new Map();
        const calls = [];
        const excludeSet = EXCLUDE[lang] || EXCLUDE.javascript;

        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

            // ── DEFINITIONS ──
            if (lang === 'javascript') {
                const defMatch = trimmed.match(/function\s+([a-zA-Z0-9_]+)/) ||
                    trimmed.match(/(?:const|let|var)?\s*([a-zA-Z0-9_]+)\s*=\s*/);
                if (defMatch) {
                    const name = defMatch[1];
                    const colIdx = line.indexOf(name);
                    definitions.set(name, { line: lineNum, col: colIdx >= 0 ? colIdx + 1 : 1 });
                }
            } else if (lang === 'python') {
                const defMatch = trimmed.match(/def\s+([a-zA-Z0-9_]+)/) ||
                    trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                if (defMatch) {
                    const name = defMatch[1];
                    const colIdx = line.indexOf(name);
                    definitions.set(name, { line: lineNum, col: colIdx >= 0 ? colIdx + 1 : 1 });
                }
            } else if (lang === 'java' || lang === 'c' || lang === 'cpp') {
                // 1. Detect multiple variable declarations (e.g. int x, y, z;)
                const varDeclMatch = trimmed.match(/^((?:(?:static|extern|const|volatile|public|private|protected)\s+)*[a-zA-Z_][a-zA-Z0-9_<>]*)\s+([^;=()\[\]]+)(?:;|=|\s*$)/);
                if (varDeclMatch) {
                    const type = varDeclMatch[1].trim();
                    const namesPart = varDeclMatch[2];

                    // Filter out keywords that might look like types
                    if (!excludeSet.has(type) && !JAVA_MODIFIERS.has(type)) {
                        const potentialNames = namesPart.split(',');
                        potentialNames.forEach(n => {
                            // Extract the name part (handle pointers/refs)
                            const nameMatch = n.trim().match(/[*&]*\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
                            if (nameMatch) {
                                const name = nameMatch[1];
                                if (!excludeSet.has(name)) {
                                    const colIdx = line.indexOf(name);
                                    definitions.set(name, { line: lineNum, col: colIdx >= 0 ? colIdx + 1 : 1 });
                                }
                            }
                        });
                    }
                }

                // 2. Simple assignment detection (can also be a "definition" target)
                const assignMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                if (assignMatch) {
                    const name = assignMatch[1];
                    if (!excludeSet.has(name) && !definitions.has(name)) {
                        definitions.set(name, { line: lineNum, col: line.indexOf(name) + 1 });
                    }
                }

                // 3. Existing function definitions...
                if (lang === 'java') {
                    const javaDefMatch = trimmed.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*(\w+(?:<[^>]+>)?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                    if (javaDefMatch) {
                        const name = javaDefMatch[2];
                        if (!JAVA_MODIFIERS.has(name) && !excludeSet.has(name) && name !== 'main') {
                            definitions.set(name, { line: lineNum, col: line.indexOf(name) + 1 });
                        }
                    }
                } else {
                    const cDefMatch = trimmed.match(/^(?:static\s+|inline\s+|extern\s+|const\s+)*(\w+(?:\s*\*)?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                    if (cDefMatch) {
                        const name = cDefMatch[2];
                        if (!excludeSet.has(name) && name !== 'main') {
                            definitions.set(name, { line: lineNum, col: line.indexOf(name) + 1 });
                        }
                    }
                }
            }

            // ── USAGES ──
            const words = trimmed.split(/[^a-zA-Z0-9_]+/);
            words.forEach(word => {
                if (word && definitions.has(word)) {
                    const def = definitions.get(word);
                    if (def.line < lineNum) {
                        calls.push({ name: word, line: lineNum, col: line.indexOf(word) + 1 });
                    }
                }
            });
        });

        const relationships = [];
        const seen = new Set();
        calls.forEach(call => {
            const def = definitions.get(call.name);
            if (def && def.line !== call.line) {
                const id = `${call.name}-${call.line}-${def.line}`;
                if (!seen.has(id)) {
                    relationships.push({ start: call, end: def, id });
                    seen.add(id);
                }
            }
        });
        return relationships;
    }, []);

    const updateArrows = useCallback(() => {
        if (!editor || !monaco) return;

        try {
            const rels = parseCode(code, language);
            const newArrows = [];

            rels.forEach(rel => {
                try {
                    const startPos = editor.getScrolledVisiblePosition({
                        lineNumber: rel.start.line,
                        column: rel.start.col
                    });
                    const endPos = editor.getScrolledVisiblePosition({
                        lineNumber: rel.end.line,
                        column: rel.end.col
                    });

                    if (startPos && endPos) {
                        newArrows.push({
                            start: { x: startPos.left, y: startPos.top + 10, id: `start-${rel.id}` },
                            end: { x: endPos.left, y: endPos.top + 10, id: `end-${rel.id}` },
                            id: rel.id,
                            startLine: rel.start.line,
                            endLine: rel.end.line
                        });
                    }
                } catch (err) {
                    // Ignore individual arrow failures
                }
            });

            setArrows(newArrows);
        } catch (e) {
            console.error("Arrow update failed:", e);
        }
    }, [editor, monaco, code, language, parseCode]);

    useEffect(() => {
        if (!editor) return;

        const disposable = editor.onDidScrollChange(updateArrows);
        const layoutDisposable = editor.onDidLayoutChange(updateArrows);
        const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
            setActiveLine(e.position.lineNumber);
        });

        updateArrows();
        return () => {
            disposable.dispose();
            layoutDisposable.dispose();
            cursorDisposable.dispose();
        };
    }, [editor, updateArrows, code, language]);

    return (
        <div
            ref={containerRef}
            className="code-visualizer-overlay"
            style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 1000,
                overflow: 'visible'
            }}
        >
            <Xwrapper>
                {arrows.map(arrow => {
                    const isActive = activeLine === arrow.startLine || activeLine === arrow.endLine;
                    const opacity = isActive ? 1 : 0.4;
                    const color = isActive ? "#5aa5ff" : "rgba(180, 180, 200, 0.4)";

                    return (
                        <React.Fragment key={arrow.id}>
                            <div
                                id={arrow.start.id}
                                style={{ position: 'absolute', left: arrow.start.x, top: arrow.start.y, width: 1, height: 1 }}
                            />
                            <div
                                id={arrow.end.id}
                                style={{ position: 'absolute', left: arrow.end.x, top: arrow.end.y, width: 1, height: 1 }}
                            />
                            <Xarrow
                                start={arrow.start.id}
                                end={arrow.end.id}
                                color={color}
                                headSize={isActive ? 5 : 3}
                                strokeWidth={isActive ? 2 : 1.5}
                                path="smooth"
                                curveness={0.4}
                                startAnchor="right"
                                endAnchor="right"
                                divContainerStyle={{
                                    opacity,
                                    transition: 'all 0.3s ease',
                                    filter: isActive ? 'drop-shadow(0 0 8px rgba(90, 165, 255, 0.6))' : 'none'
                                }}
                            />
                        </React.Fragment>
                    );
                })}
            </Xwrapper>
        </div>
    );
};

export default CodeVisualizer;
