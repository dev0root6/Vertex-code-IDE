import * as vscode from 'vscode';
import * as path from 'path';

export class BlockCodeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devx.blockCode';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        const blocklyPath = vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri, blocklyPath]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'generateCode':
                    this._insertGeneratedCode(data.code, data.language);
                    break;
                case 'runCode':
                    this._runGeneratedCode(data.code, data.language);
                    break;
                case 'importCode':
                    this._importCodeToBlocks();
                    break;
                case 'error':
                    vscode.window.showErrorMessage(data.message);
                    break;
                case 'info':
                    vscode.window.showInformationMessage(data.message);
                    break;
                case 'ready':
                    console.log('[BlockCode] Blockly initialized successfully');
                    break;
            }
        });
    }

    private _insertGeneratedCode(code: string, language: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const languageId = language === 'python' ? 'python' : 'javascript';
            if (editor.document.isUntitled || editor.document.getText().trim() === '') {
                vscode.languages.setTextDocumentLanguage(editor.document, languageId);
            }
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, code + '\n');
            });
            vscode.window.showInformationMessage('Generated ' + language + ' code inserted!');
        } else {
            vscode.window.showErrorMessage('No active editor. Open a file first.');
        }
    }

    private async _importCodeToBlocks() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor. Open a Python or JavaScript file to import.');
            return;
        }

        const lang = editor.document.languageId;
        const ext = editor.document.fileName.split('.').pop()?.toLowerCase();
        
        // Support Python, JavaScript, and TypeScript
        const supportedLanguages = ['python', 'javascript', 'typescript'];
        const supportedExtensions = ['py', 'js', 'ts', 'jsx', 'tsx'];
        
        if (!supportedLanguages.includes(lang) && !supportedExtensions.includes(ext || '')) {
            vscode.window.showErrorMessage('Only Python and JavaScript/TypeScript files can be imported to blocks.');
            return;
        }

        const code = editor.document.getText();
        if (!code.trim()) {
            vscode.window.showWarningMessage('File is empty.');
            return;
        }

        if (this._view) {
            // Determine which parser to use
            const isPython = lang === 'python' || ext === 'py';
            const messageType = isPython ? 'importPythonCode' : 'importJavaScriptCode';
            this._view.webview.postMessage({ type: messageType, code });
        }
    }

    private async _runGeneratedCode(code: string, language: string) {
        const terminal = vscode.window.createTerminal({ name: 'BlockCode Run' });
        terminal.show();
        const fs = require('fs');
        const os = require('os');
        const ext = language === 'python' ? 'py' : 'js';
        const cmd = language === 'python' ? 'python3' : 'node';
        const tmpFile = path.join(os.tmpdir(), 'blockcode_' + Date.now() + '.' + ext);
        fs.writeFileSync(tmpFile, code);
        terminal.sendText(cmd + ' "' + tmpFile + '"');
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 5000);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const blocklyUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'blockly_compressed.js')
        );
        const blocksUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'blocks_compressed.js')
        );
        const jsGenUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'javascript_compressed.js')
        );
        const pyGenUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'python_compressed.js')
        );
        const msgUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'msg', 'en.js')
        );
        const mediaUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'blockly', 'media')
        );

        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BlockCode</title>
<script src="${blocklyUri}"></script>
<script src="${blocksUri}"></script>
<script src="${jsGenUri}"></script>
<script src="${pyGenUri}"></script>
<script src="${msgUri}"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',sans-serif; background:#1e1e1e; color:#fff; overflow:hidden; height:100vh; display:flex; flex-direction:column; }
.header { background:#252526; padding:6px 10px; border-bottom:1px solid #3c3c3c; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px; }
.title { font-size:12px; font-weight:600; color:#ccc; display:flex; align-items:center; gap:5px; }
.btn-row { display:flex; gap:4px; flex-wrap:wrap; }
.btn { background:#0e639c; border:none; color:#fff; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-weight:500; }
.btn:hover { background:#1177bb; }
.btn.green { background:#0e7d19; }
.btn.green:hover { background:#14a323; }
.btn.red { background:#c72e0e; }
.btn.red:hover { background:#e03e1e; }
#blocklyDiv { flex:1; width:100%; }
.bar { background:#2d2d30; padding:3px 10px; border-top:1px solid #3c3c3c; font-size:10px; color:#858585; display:flex; justify-content:space-between; align-items:center; }
.dot { width:6px; height:6px; border-radius:50%; display:inline-block; margin-right:4px; }
.dot.ok { background:#0e7d19; }
.dot.err { background:#c72e0e; }
#codePreview { display:none; background:#1a1a2e; border-top:1px solid #3c3c3c; max-height:30vh; overflow:auto; padding:8px; font-family:'Consolas',monospace; font-size:11px; color:#9cdcfe; white-space:pre-wrap; }
</style>
</head>
<body>
<div class="header">
  <div class="title"><span>🧱</span> Block Code</div>
  <div class="btn-row">
    <button class="btn" onclick="doImport()">📥 Import</button>
    <button class="btn" onclick="genPython()">🐍 Py</button>
    <button class="btn" onclick="genJS()">JS</button>
    <button class="btn" onclick="togglePreview()">👁 Preview</button>
    <button class="btn green" onclick="doRun()">▶ Run</button>
    <button class="btn red" onclick="doClear()">✕</button>
  </div>
</div>
<div id="blocklyDiv"></div>
<div id="codePreview"></div>
<div class="bar">
  <span><span class="dot ok" id="dot"></span><span id="status">Init...</span></span>
  <span id="blockCount">0 blocks</span>
</div>

<script>
(function() {
var vscodeApi = acquireVsCodeApi();

// ═══════════════════════════════════════════
// REFERENCES: Blockly v11 generator API
// python.pythonGenerator / python.Order
// javascript.javascriptGenerator / javascript.Order
// ═══════════════════════════════════════════

var pythonGen = python.pythonGenerator;
var pyOrder = python.Order;
var jsGen = javascript.javascriptGenerator;
var jsOrder = javascript.Order;

// Only reserve actual Python KEYWORDS, not builtins (sum, list, dict...)
// This prevents confusing renames like sum→sum2 for beginners
pythonGen.RESERVED_WORDS_ = 'False,None,True,and,as,assert,async,await,break,class,continue,def,del,elif,else,except,finally,for,from,global,if,import,in,is,lambda,nonlocal,not,or,pass,raise,return,try,while,with,yield';

// ═══════════════════════════════════════════
// CUSTOM BLOCK DEFINITIONS
// ═══════════════════════════════════════════

// ── devx_input: input("prompt") ──
Blockly.Blocks['devx_input'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('input')
            .appendField(new Blockly.FieldTextInput('Enter value: '), 'PROMPT');
        this.setOutput(true, 'String');
        this.setColour('#D65CD6');
        this.setTooltip('Read user input with a prompt');
    }
};
pythonGen.forBlock['devx_input'] = function(block, gen) {
    var prompt = block.getFieldValue('PROMPT');
    return ['input(' + gen.quote_(prompt) + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['devx_input'] = function(block, gen) {
    var prompt = block.getFieldValue('PROMPT');
    return ['prompt(' + JSON.stringify(prompt) + ')', jsOrder.FUNCTION_CALL];
};

// ── devx_float: float(value) ──
Blockly.Blocks['devx_float'] = {
    init: function() {
        this.appendValueInput('VALUE')
            .setCheck(null)
            .appendField('float');
        this.setOutput(true, 'Number');
        this.setColour('#5C68A6');
        this.setTooltip('Convert to float (decimal number)');
    }
};
pythonGen.forBlock['devx_float'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', pyOrder.NONE) || '0';
    return ['float(' + val + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['devx_float'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', jsOrder.NONE) || '0';
    return ['parseFloat(' + val + ')', jsOrder.FUNCTION_CALL];
};

// ── devx_int: int(value) ──
Blockly.Blocks['devx_int'] = {
    init: function() {
        this.appendValueInput('VALUE')
            .setCheck(null)
            .appendField('int');
        this.setOutput(true, 'Number');
        this.setColour('#5C68A6');
        this.setTooltip('Convert to integer');
    }
};
pythonGen.forBlock['devx_int'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', pyOrder.NONE) || '0';
    return ['int(' + val + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['devx_int'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', jsOrder.NONE) || '0';
    return ['parseInt(' + val + ')', jsOrder.FUNCTION_CALL];
};

// ── devx_str: str(value) ──
Blockly.Blocks['devx_str'] = {
    init: function() {
        this.appendValueInput('VALUE')
            .setCheck(null)
            .appendField('str');
        this.setOutput(true, 'String');
        this.setColour('#5CA68D');
        this.setTooltip('Convert to string');
    }
};
pythonGen.forBlock['devx_str'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', pyOrder.NONE) || "''";
    return ['str(' + val + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['devx_str'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', jsOrder.NONE) || "''";
    return ['String(' + val + ')', jsOrder.FUNCTION_CALL];
};

// ── devx_while_true: while True: ──
Blockly.Blocks['devx_while_true'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('while True');
        this.appendStatementInput('DO')
            .appendField('do');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#5CA65C');
        this.setTooltip('Loop forever until break');
    }
};
pythonGen.forBlock['devx_while_true'] = function(block, gen) {
    var body = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass\\n';
    return 'while True:\\n' + body;
};
jsGen.forBlock['devx_while_true'] = function(block, gen) {
    var body = gen.statementToCode(block, 'DO') || '';
    return 'while (true) {\\n' + body + '}\\n';
};

// ── devx_break: break ──
Blockly.Blocks['devx_break'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('break');
        this.setPreviousStatement(true, null);
        this.setColour('#c72e0e');
        this.setTooltip('Break out of loop');
    }
};
pythonGen.forBlock['devx_break'] = function(block) {
    var loopTypes = ['devx_while_true', 'controls_repeat_ext', 'controls_whileUntil', 'controls_for', 'controls_forEach', 'controls_repeat'];
    var p = block.getSurroundParent();
    var inLoop = false;
    while (p) { if (loopTypes.indexOf(p.type) !== -1) { inLoop = true; break; } p = p.getSurroundParent(); }
    if (!inLoop) return '# ERROR: break must be inside a loop\\npass\\n';
    return 'break\\n';
};
jsGen.forBlock['devx_break'] = function(block) {
    var loopTypes = ['devx_while_true', 'controls_repeat_ext', 'controls_whileUntil', 'controls_for', 'controls_forEach', 'controls_repeat'];
    var p = block.getSurroundParent();
    var inLoop = false;
    while (p) { if (loopTypes.indexOf(p.type) !== -1) { inLoop = true; break; } p = p.getSurroundParent(); }
    if (!inLoop) return '// ERROR: break must be inside a loop\\n';
    return 'break;\\n';
};

// ── devx_return: return value ──
Blockly.Blocks['devx_return'] = {
    init: function() {
        this.appendValueInput('VALUE')
            .setCheck(null)
            .appendField('return');
        this.setPreviousStatement(true, null);
        this.setColour('#9A5CA6');
        this.setTooltip('Return a value from function');
    }
};
pythonGen.forBlock['devx_return'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', pyOrder.NONE);
    return val ? 'return ' + val + '\\n' : 'return\\n';
};
jsGen.forBlock['devx_return'] = function(block, gen) {
    var val = gen.valueToCode(block, 'VALUE', jsOrder.NONE);
    return val ? 'return ' + val + ';\\n' : 'return;\\n';
};

// ── devx_def_function: def name(params): with body and return ──
Blockly.Blocks['devx_def_function'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('def')
            .appendField(new Blockly.FieldTextInput('my_function'), 'NAME')
            .appendField('(')
            .appendField(new Blockly.FieldTextInput(''), 'PARAMS')
            .appendField(')');
        this.appendStatementInput('BODY')
            .appendField('body');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#9A5CA6');
        this.setTooltip('Define a function with parameters');
    }
};
pythonGen.forBlock['devx_def_function'] = function(block, gen) {
    var name = block.getFieldValue('NAME');
    var params = block.getFieldValue('PARAMS');
    var body = gen.statementToCode(block, 'BODY') || gen.INDENT + 'pass\\n';
    return 'def ' + name + '(' + params + '):\\n' + body + '\\n';
};
jsGen.forBlock['devx_def_function'] = function(block, gen) {
    var name = block.getFieldValue('NAME');
    var params = block.getFieldValue('PARAMS');
    var body = gen.statementToCode(block, 'BODY') || '';
    return 'function ' + name + '(' + params + ') {\\n' + body + '}\\n\\n';
};

// ── devx_call_function: call name(args) ──
Blockly.Blocks['devx_call_function'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('call')
            .appendField(new Blockly.FieldTextInput('my_function'), 'NAME')
            .appendField('(')
            .appendField(new Blockly.FieldTextInput(''), 'ARGS')
            .appendField(')');
        this.setOutput(true, null);
        this.setColour('#9A5CA6');
        this.setTooltip('Call a function with arguments');
    }
};
pythonGen.forBlock['devx_call_function'] = function(block) {
    var name = block.getFieldValue('NAME');
    var args = block.getFieldValue('ARGS');
    return [name + '(' + args + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['devx_call_function'] = function(block) {
    var name = block.getFieldValue('NAME');
    var args = block.getFieldValue('ARGS');
    return [name + '(' + args + ')', jsOrder.FUNCTION_CALL];
};

// ── devx_call_statement: call name(args) as statement ──
Blockly.Blocks['devx_call_statement'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('call')
            .appendField(new Blockly.FieldTextInput('my_function'), 'NAME')
            .appendField('(')
            .appendField(new Blockly.FieldTextInput(''), 'ARGS')
            .appendField(')');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#9A5CA6');
        this.setTooltip('Call a function as a statement');
    }
};
pythonGen.forBlock['devx_call_statement'] = function(block) {
    var name = block.getFieldValue('NAME');
    var args = block.getFieldValue('ARGS');
    return name + '(' + args + ')\\n';
};
jsGen.forBlock['devx_call_statement'] = function(block) {
    var name = block.getFieldValue('NAME');
    var args = block.getFieldValue('ARGS');
    return name + '(' + args + ');\\n';
};

// ── devx_print_multi: print(a, b, c, d, e, sep) ──
Blockly.Blocks['devx_print_multi'] = {
    init: function() {
        this.appendValueInput('VAL1').setCheck(null).appendField('print');
        this.appendValueInput('VAL2').setCheck(null).appendField(',');
        this.appendValueInput('VAL3').setCheck(null).appendField(',');
        this.appendValueInput('VAL4').setCheck(null).appendField(',');
        this.appendValueInput('VAL5').setCheck(null).appendField(',');
        this.appendDummyInput()
            .appendField('sep=')
            .appendField(new Blockly.FieldTextInput(' '), 'SEP');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#D65CD6');
        this.setTooltip('Print up to 5 values with separator');
        this.setInputsInline(true);
    }
};
pythonGen.forBlock['devx_print_multi'] = function(block, gen) {
    var parts = [];
    var slots = ['VAL1','VAL2','VAL3','VAL4','VAL5'];
    for (var i = 0; i < slots.length; i++) {
        var v = gen.valueToCode(block, slots[i], pyOrder.NONE);
        if (v) parts.push(v);
    }
    var sep = block.getFieldValue('SEP');
    var extra = sep !== ' ' ? ', sep=' + gen.quote_(sep) : '';
    return 'print(' + parts.join(', ') + extra + ')\\n';
};
jsGen.forBlock['devx_print_multi'] = function(block, gen) {
    var parts = [];
    var slots = ['VAL1','VAL2','VAL3','VAL4','VAL5'];
    for (var i = 0; i < slots.length; i++) {
        var v = gen.valueToCode(block, slots[i], jsOrder.NONE);
        if (v) parts.push(v);
    }
    return 'console.log(' + parts.join(', ') + ');\\n';
};

// ── devx_comment: # comment ──

// Override built-in text_prompt_ext to generate clean code (no try/except)
pythonGen.forBlock['text_prompt_ext'] = function(block, gen) {
    var msg = gen.valueToCode(block, 'TEXT', pyOrder.NONE) || "''";
    var type = block.getFieldValue('TYPE');
    if (type === 'NUMBER') {
        return ['int(input(' + msg + '))', pyOrder.FUNCTION_CALL];
    }
    return ['input(' + msg + ')', pyOrder.FUNCTION_CALL];
};
jsGen.forBlock['text_prompt_ext'] = function(block, gen) {
    var msg = gen.valueToCode(block, 'TEXT', jsOrder.NONE) || "''";
    var type = block.getFieldValue('TYPE');
    if (type === 'NUMBER') {
        return ['Number(prompt(' + msg + '))', jsOrder.FUNCTION_CALL];
    }
    return ['prompt(' + msg + ')', jsOrder.FUNCTION_CALL];
};

Blockly.Blocks['devx_comment'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('#')
            .appendField(new Blockly.FieldTextInput('comment'), 'TEXT');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#6a9955');
        this.setTooltip('Add a code comment');
    }
};
pythonGen.forBlock['devx_comment'] = function(block) {
    return '# ' + block.getFieldValue('TEXT') + '\\n';
};
jsGen.forBlock['devx_comment'] = function(block) {
    return '// ' + block.getFieldValue('TEXT') + '\\n';
};

// ── devx_raw_code: raw code expression ──
Blockly.Blocks['devx_raw_code'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('code:')
            .appendField(new Blockly.FieldTextInput('x + 1'), 'CODE');
        this.setOutput(true, null);
        this.setColour('#ce9178');
        this.setTooltip('Raw code expression');
    }
};
pythonGen.forBlock['devx_raw_code'] = function(block) {
    return [block.getFieldValue('CODE'), pyOrder.ATOMIC];
};
jsGen.forBlock['devx_raw_code'] = function(block) {
    return [block.getFieldValue('CODE'), jsOrder.ATOMIC];
};

// ── devx_raw_statement: raw code statement ──
Blockly.Blocks['devx_raw_statement'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('code:')
            .appendField(new Blockly.FieldTextInput('pass'), 'CODE');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#ce9178');
        this.setTooltip('Raw code statement line');
    }
};
pythonGen.forBlock['devx_raw_statement'] = function(block) {
    return block.getFieldValue('CODE') + '\\n';
};
jsGen.forBlock['devx_raw_statement'] = function(block) {
    return block.getFieldValue('CODE') + ';\\n';
};

// ── devx_string_format: f"...{var}..." ──
Blockly.Blocks['devx_string_format'] = {
    init: function() {
        this.appendDummyInput()
            .appendField('f"')
            .appendField(new Blockly.FieldTextInput('Result: {x}'), 'TEMPLATE')
            .appendField('"');
        this.setOutput(true, 'String');
        this.setColour('#5CA68D');
        this.setTooltip('Python f-string / JS template literal');
    }
};
pythonGen.forBlock['devx_string_format'] = function(block) {
    var tpl = block.getFieldValue('TEMPLATE');
    return ["f'" + tpl + "'", pyOrder.ATOMIC];
};
jsGen.forBlock['devx_string_format'] = function(block) {
    var tpl = block.getFieldValue('TEMPLATE').replace(/\\{([^}]+)\\}/g, function(m, p1) { return '$' + '{' + p1 + '}'; });
    return ['\\x60' + tpl + '\\x60', jsOrder.ATOMIC];
};

// ── devx_elif: if/elif/else chain ──
Blockly.Blocks['devx_elif'] = {
    init: function() {
        this.appendValueInput('IF0').setCheck('Boolean').appendField('if');
        this.appendStatementInput('DO0').appendField('then');
        this.appendValueInput('IF1').setCheck('Boolean').appendField('elif');
        this.appendStatementInput('DO1').appendField('then');
        this.appendStatementInput('ELSE').appendField('else');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#5C81A6');
        this.setTooltip('If / elif / else chain');
    }
};
pythonGen.forBlock['devx_elif'] = function(block, gen) {
    var cond0 = gen.valueToCode(block, 'IF0', pyOrder.NONE) || 'True';
    var body0 = gen.statementToCode(block, 'DO0') || gen.INDENT + 'pass\\n';
    var cond1 = gen.valueToCode(block, 'IF1', pyOrder.NONE) || 'True';
    var body1 = gen.statementToCode(block, 'DO1') || gen.INDENT + 'pass\\n';
    var elseBody = gen.statementToCode(block, 'ELSE');
    var code = 'if ' + cond0 + ':\\n' + body0;
    code += 'elif ' + cond1 + ':\\n' + body1;
    if (elseBody) { code += 'else:\\n' + elseBody; }
    return code;
};
jsGen.forBlock['devx_elif'] = function(block, gen) {
    var cond0 = gen.valueToCode(block, 'IF0', jsOrder.NONE) || 'true';
    var body0 = gen.statementToCode(block, 'DO0') || '';
    var cond1 = gen.valueToCode(block, 'IF1', jsOrder.NONE) || 'true';
    var body1 = gen.statementToCode(block, 'DO1') || '';
    var elseBody = gen.statementToCode(block, 'ELSE');
    var code = 'if (' + cond0 + ') {\\n' + body0 + '}';
    code += ' else if (' + cond1 + ') {\\n' + body1 + '}';
    if (elseBody) { code += ' else {\\n' + elseBody + '}'; }
    return code + '\\n';
};


// ═══════════════════════════════════════════
// WORKSPACE INIT
// ═══════════════════════════════════════════

var workspace;
var dotEl = document.getElementById('dot');
var statusEl = document.getElementById('status');
var blockCountEl = document.getElementById('blockCount');

try {
    workspace = Blockly.inject('blocklyDiv', {
        media: '${mediaUri}/',
        toolbox: {
            kind: 'categoryToolbox',
            contents: [
                // ── Logic ──
                { kind:'category', name:'Logic', colour:'#5C81A6', contents:[
                    {kind:'block', type:'controls_if'},
                    {kind:'block', type:'devx_elif'},
                    {kind:'block', type:'logic_compare'},
                    {kind:'block', type:'logic_operation'},
                    {kind:'block', type:'logic_negate'},
                    {kind:'block', type:'logic_boolean'},
                    {kind:'block', type:'logic_null'},
                    {kind:'block', type:'logic_ternary'}
                ]},
                // ── Loops ──
                { kind:'category', name:'Loops', colour:'#5CA65C', contents:[
                    {kind:'block', type:'devx_while_true'},
                    {kind:'block', type:'controls_repeat_ext'},
                    {kind:'block', type:'controls_whileUntil'},
                    {kind:'block', type:'controls_for'},
                    {kind:'block', type:'controls_forEach'},
                    {kind:'block', type:'controls_flow_statements'},
                    {kind:'block', type:'devx_break'}
                ]},
                // ── Math ──
                { kind:'category', name:'Math', colour:'#5C68A6', contents:[
                    {kind:'block', type:'math_number'},
                    {kind:'block', type:'math_arithmetic'},
                    {kind:'block', type:'math_single'},
                    {kind:'block', type:'math_trig'},
                    {kind:'block', type:'math_constant'},
                    {kind:'block', type:'math_number_property'},
                    {kind:'block', type:'math_round'},
                    {kind:'block', type:'math_modulo'},
                    {kind:'block', type:'math_random_int'},
                    {kind:'block', type:'math_random_float'},
                    {kind:'block', type:'devx_float'},
                    {kind:'block', type:'devx_int'}
                ]},
                // ── Text ──
                { kind:'category', name:'Text', colour:'#5CA68D', contents:[
                    {kind:'block', type:'text'},
                    {kind:'block', type:'text_multiline'},
                    {kind:'block', type:'text_join'},
                    {kind:'block', type:'text_append'},
                    {kind:'block', type:'text_length'},
                    {kind:'block', type:'text_isEmpty'},
                    {kind:'block', type:'text_indexOf'},
                    {kind:'block', type:'text_charAt'},
                    {kind:'block', type:'text_changeCase'},
                    {kind:'block', type:'text_trim'},
                    {kind:'block', type:'text_print'},
                    {kind:'block', type:'devx_str'},
                    {kind:'block', type:'devx_string_format'}
                ]},
                // ── Lists ──
                { kind:'category', name:'Lists', colour:'#745CA6', contents:[
                    {kind:'block', type:'lists_create_empty'},
                    {kind:'block', type:'lists_create_with'},
                    {kind:'block', type:'lists_repeat'},
                    {kind:'block', type:'lists_length'},
                    {kind:'block', type:'lists_isEmpty'},
                    {kind:'block', type:'lists_indexOf'},
                    {kind:'block', type:'lists_getIndex'},
                    {kind:'block', type:'lists_setIndex'},
                    {kind:'block', type:'lists_sort'}
                ]},
                // ── Input / Output ──
                { kind:'category', name:'I/O', colour:'#D65CD6', contents:[
                    {kind:'block', type:'devx_input'},
                    {kind:'block', type:'text_print'},
                    {kind:'block', type:'devx_print_multi'},
                    {kind:'block', type:'text_prompt_ext', fields:{TYPE:'TEXT'}},
                    {kind:'block', type:'text_prompt_ext', fields:{TYPE:'NUMBER'}}
                ]},
                // ── Functions ──
                { kind:'category', name:'Functions', colour:'#9A5CA6', contents:[
                    {kind:'block', type:'devx_def_function'},
                    {kind:'block', type:'devx_call_function'},
                    {kind:'block', type:'devx_call_statement'},
                    {kind:'block', type:'devx_return'},
                    {kind:'separator', gap:'20'},
                    {kind:'block', type:'procedures_defnoreturn'},
                    {kind:'block', type:'procedures_defreturn'},
                    {kind:'block', type:'procedures_callnoreturn'},
                    {kind:'block', type:'procedures_callreturn'}
                ]},
                // ── Variables ──
                { kind:'category', name:'Variables', colour:'#A65C81', custom:'VARIABLE' },
                // ── Advanced ──
                { kind:'category', name:'Advanced', colour:'#ce9178', contents:[
                    {kind:'block', type:'devx_comment'},
                    {kind:'block', type:'devx_raw_code'},
                    {kind:'block', type:'devx_raw_statement'}
                ]}
            ]
        },
        grid: { spacing:20, length:3, colour:'#2d2d30', snap:true },
        zoom: { controls:true, wheel:true, startScale:0.9, maxScale:3, minScale:0.3, scaleSpeed:1.2 },
        trashcan: true,
        theme: Blockly.Theme.defineTheme('devx_dark', {
            base: Blockly.Themes.Classic,
            componentStyles: {
                workspaceBackgroundColour:'#1e1e1e',
                toolboxBackgroundColour:'#252526',
                toolboxForegroundColour:'#cccccc',
                flyoutBackgroundColour:'#252526',
                flyoutForegroundColour:'#ccc',
                flyoutOpacity:0.95,
                scrollbarColour:'#797979',
                insertionMarkerColour:'#fff',
                insertionMarkerOpacity:0.3,
                scrollbarOpacity:0.4,
                cursorColour:'#d0d0d0'
            }
        })
    });

    dotEl.className = 'dot ok';
    statusEl.textContent = 'Ready';

    window.addEventListener('resize', function() { Blockly.svgResize(workspace); });

    workspace.addChangeListener(function() {
        try {
            vscodeApi.setState(Blockly.serialization.workspaces.save(workspace));
            blockCountEl.textContent = workspace.getAllBlocks(false).length + ' blocks';
        } catch(e) {}
    });

    var prev = vscodeApi.getState();
    if (prev) {
        try { Blockly.serialization.workspaces.load(prev, workspace); } catch(e) {}
    }

    vscodeApi.postMessage({ type:'ready' });

} catch(err) {
    dotEl.className = 'dot err';
    statusEl.textContent = 'Error: ' + err.message;
    vscodeApi.postMessage({ type:'error', message:'Blockly init: ' + err.message });
}


// ═══════════════════════════════════════════
// CODE GENERATION (using pythonGenerator v11 API)
// ═══════════════════════════════════════════

function genPython() {
    if (!workspace) return;
    try {
        var code = pythonGen.workspaceToCode(workspace);
        // Strip useless "var = None" initializations that Blockly adds
        code = code.replace(/^\\w+ = None\\n/gm, '');
        if (code.trim()) {
            code = code.replace(/\\n{3,}/g, '\\n\\n').trim() + '\\n';
            vscodeApi.postMessage({ type:'generateCode', code:code, language:'python' });
            showPreview(code, 'python');
        } else {
            vscodeApi.postMessage({ type:'error', message:'No blocks to generate. Drag blocks to build your program.' });
        }
    } catch(e) {
        vscodeApi.postMessage({ type:'error', message:'Python generation error: ' + e.message });
    }
}

function genJS() {
    if (!workspace) return;
    try {
        var code = jsGen.workspaceToCode(workspace);
        if (code.trim()) {
            code = code.replace(/\\n{3,}/g, '\\n\\n').trim() + '\\n';
            vscodeApi.postMessage({ type:'generateCode', code:code, language:'javascript' });
            showPreview(code, 'javascript');
        } else {
            vscodeApi.postMessage({ type:'error', message:'No blocks to generate.' });
        }
    } catch(e) {
        vscodeApi.postMessage({ type:'error', message:'JS generation error: ' + e.message });
    }
}

function doRun() {
    if (!workspace) return;
    try {
        var code = pythonGen.workspaceToCode(workspace);
        if (code.trim()) {
            vscodeApi.postMessage({ type:'runCode', code:code, language:'python' });
        } else {
            vscodeApi.postMessage({ type:'error', message:'Workspace empty.' });
        }
    } catch(e) {
        vscodeApi.postMessage({ type:'error', message:'Run error: ' + e.message });
    }
}

function doImport() {
    vscodeApi.postMessage({ type:'importCode' });
}

function doClear() {
    if (workspace && workspace.getAllBlocks(false).length > 0) {
        workspace.clear();
        hidePreview();
    }
}


// ═══════════════════════════════════════════
// CODE PREVIEW
// ═══════════════════════════════════════════

var previewEl = document.getElementById('codePreview');
var previewVisible = false;

function showPreview(code, lang) {
    previewEl.textContent = '# Generated ' + lang + ':\\n' + code;
    previewEl.style.display = 'block';
    previewVisible = true;
}

function hidePreview() {
    previewEl.style.display = 'none';
    previewVisible = false;
}

function togglePreview() {
    if (previewVisible) {
        hidePreview();
        return;
    }
    if (!workspace) return;
    try {
        var code = pythonGen.workspaceToCode(workspace);
        if (code.trim()) {
            showPreview(code, 'Python');
        } else {
            vscodeApi.postMessage({ type:'info', message:'No blocks to preview.' });
        }
    } catch(e) {
        vscodeApi.postMessage({ type:'error', message:'Preview error: ' + e.message });
    }
}


// ═══════════════════════════════════════════
// PYTHON CODE → BLOCKS IMPORT ENGINE
// ═══════════════════════════════════════════

window.addEventListener('message', function(ev) {
    var msg = ev.data;
    if (msg.type === 'importPythonCode' && workspace) {
        importPython(msg.code);
    } else if (msg.type === 'importJavaScriptCode' && workspace) {
        importJavaScript(msg.code);
    }
});

function importPython(code) {
    workspace.clear();
    var lines = code.split('\\n');
    var importedCount = 0;

    // ── Pre-parse: build array of {text, indent, lineNum} skipping blanks/comments/docstrings ──
    var parsed = [];
    var inMultiline = false;  // true when inside a triple-quoted block
    var multiDelim = '';      // '\"\"\"' or "'''"
    for (var li = 0; li < lines.length; li++) {
        var raw = lines[li];
        var trimmed = raw.trim();

        // Currently inside a multi-line string/docstring?
        if (inMultiline) {
            // Check if this line closes it
            if (trimmed.indexOf(multiDelim) !== -1) { inMultiline = false; }
            continue; // skip either way
        }

        // Check if this line OPENS a triple-quoted block
        if (trimmed.indexOf('\"\"\"') !== -1 || trimmed.indexOf("'''") !== -1) {
            var delim = trimmed.indexOf('\"\"\"') !== -1 ? '\"\"\"' : "'''";
            var first = trimmed.indexOf(delim);
            var second = trimmed.indexOf(delim, first + 3);
            if (second !== -1) {
                // Opens AND closes on the same line (single-line docstring) → skip entire line
                continue;
            } else {
                // Opens but doesn't close → enter multi-line mode
                inMultiline = true;
                multiDelim = delim;
                continue;
            }
        }

        if (!trimmed || trimmed.startsWith('#')) continue;
        // strip trailing comments (not inside strings — simple heuristic)
        var noComment = trimmed.replace(/\\s+#[^"']*$/, '');
        parsed.push({ text: noComment, indent: raw.length - raw.trimStart().length, lineNum: li });
    }

    // ── Helper: create value block (variable / string / expression) ──
    function makeValueBlock(expr) {
        expr = expr.trim();
        if (/^[a-zA-Z_]\\w*$/.test(expr)) {
            var ev = workspace.getVariable(expr);
            if (!ev) ev = workspace.createVariable(expr);
            var vb = workspace.newBlock('variables_get');
            try { vb.getField('VAR').setValue(ev.getId()); } catch(e) {}
            vb.initSvg(); vb.render();
            return vb;
        }
        var sm = expr.match(/^(["'])(.*)\\1$/);
        if (sm) {
            var inner = sm[2];
            if (/^[a-zA-Z_]\\w*$/.test(inner) && workspace.getVariable(inner)) {
                var vb2 = workspace.newBlock('variables_get');
                try { vb2.getField('VAR').setValue(workspace.getVariable(inner).getId()); } catch(e) {}
                vb2.initSvg(); vb2.render();
                return vb2;
            }
            var tb = workspace.newBlock('text');
            tb.setFieldValue(inner, 'TEXT');
            tb.initSvg(); tb.render();
            return tb;
        }
        var rb = workspace.newBlock('devx_raw_code');
        rb.setFieldValue(expr, 'CODE');
        rb.initSvg(); rb.render();
        return rb;
    }

    // ── Helper: get the body lines (next lines with indent > baseIndent) ──
    function getBody(startIdx, baseIndent) {
        var body = [];
        for (var j = startIdx; j < parsed.length; j++) {
            if (parsed[j].indent <= baseIndent) break;
            body.push(j);
        }
        return body; // indices into parsed[]
    }

    // ── Helper: chain an array of blocks sequentially via next/previous connections ──
    function chainBlocks(blocks) {
        for (var c = 1; c < blocks.length; c++) {
            if (blocks[c-1].nextConnection && blocks[c].previousConnection) {
                try { blocks[c-1].nextConnection.connect(blocks[c].previousConnection); } catch(e) {}
            }
        }
    }

    // ── Helper: attach a chain of body blocks to a parent's statement input ──
    function attachBody(parent, inputName, bodyBlocks) {
        if (!bodyBlocks || bodyBlocks.length === 0) return;
        chainBlocks(bodyBlocks);
        var inp = parent.getInput(inputName);
        if (inp && inp.connection && bodyBlocks[0].previousConnection) {
            try { inp.connection.connect(bodyBlocks[0].previousConnection); } catch(e) {}
        }
    }

    // ── Create a single block from a line of code ──
    function makeSingleBlock(text) {
        var block = null;

        // print(...)
        var pm = text.match(/^print\\((.*)\\)$/);
        if (pm) {
            var args = pm[1];
            var argParts = args.split(/,(?![^("']*[)"'])/);
            if (argParts.length > 1) {
                block = workspace.newBlock('devx_print_multi');
                var slots = ['VAL1','VAL2','VAL3','VAL4','VAL5'];
                for (var ai = 0; ai < Math.min(argParts.length, 5); ai++) {
                    var av = makeValueBlock(argParts[ai].trim());
                    try { block.getInput(slots[ai]).connection.connect(av.outputConnection); } catch(e) {}
                }
            } else {
                block = workspace.newBlock('text_print');
                var pv = makeValueBlock(args.trim());
                try { block.getInput('TEXT').connection.connect(pv.outputConnection); } catch(e) {}
            }
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // input assignment: x = input() / x = int(input("...")) / x = float(input())
        var im = text.match(/^(\\w+)\\s*=\\s*(float|int)?\\s*\\(?\\s*input\\s*\\(\\s*(?:["']([^"']*?)["'])?\\s*\\)\\s*\\)?/);
        if (im) {
            block = workspace.newBlock('variables_set');
            try { block.getField('VAR').setValue(workspace.createVariable(im[1]).getId()); } catch(e) {}
            var inputBlock = workspace.newBlock('devx_input');
            inputBlock.setFieldValue(im[3] || '', 'PROMPT');
            inputBlock.initSvg(); inputBlock.render();
            if (im[2]) {
                var castBlock = workspace.newBlock(im[2] === 'float' ? 'devx_float' : 'devx_int');
                castBlock.initSvg(); castBlock.render();
                try {
                    castBlock.getInput('VALUE').connection.connect(inputBlock.outputConnection);
                    block.getInput('VALUE').connection.connect(castBlock.outputConnection);
                } catch(e) {}
            } else {
                try { block.getInput('VALUE').connection.connect(inputBlock.outputConnection); } catch(e) {}
            }
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // variable assignment: x = expr (but not ==)
        var vm = text.match(/^(\\w+)\\s*=\\s*(.+)/);
        if (vm && !text.includes('==')) {
            block = workspace.newBlock('variables_set');
            try { block.getField('VAR').setValue(workspace.createVariable(vm[1]).getId()); } catch(e) {}
            var valB = makeValueBlock(vm[2].trim());
            try { block.getInput('VALUE').connection.connect(valB.outputConnection); } catch(e) {}
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // return
        var retM = text.match(/^return\\s*(.*)/);
        if (retM !== null && text.startsWith('return')) {
            block = workspace.newBlock('devx_return');
            if (retM[1] && retM[1].trim()) {
                var retExpr = workspace.newBlock('devx_raw_code');
                retExpr.setFieldValue(retM[1].trim(), 'CODE');
                retExpr.initSvg(); retExpr.render();
                try { block.getInput('VALUE').connection.connect(retExpr.outputConnection); } catch(e) {}
            }
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // break
        if (text === 'break') {
            block = workspace.newBlock('devx_break');
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // continue
        if (text === 'continue') {
            block = workspace.newBlock('devx_raw_statement');
            block.setFieldValue('continue', 'CODE');
            block.initSvg(); block.render(); importedCount++;
            return block;
        }

        // pass
        if (text === 'pass') {
            return null; // skip
        }

        // fallback: raw statement
        block = workspace.newBlock('devx_raw_statement');
        block.setFieldValue(text, 'CODE');
        block.initSvg(); block.render(); importedCount++;
        return block;
    }

    // ═══════════════════════════════════════════════
    // RECURSIVE PARSER: processes a range of parsed[] indices
    // Returns an array of top-level blocks for that range
    // ═══════════════════════════════════════════════
    function parseRange(indices) {
        var blocks = [];
        var i = 0;
        while (i < indices.length) {
            var idx = indices[i];
            var line = parsed[idx];
            var text = line.text;
            var baseIndent = line.indent;
            var block = null;

            try {
                // ── def function(...): ──
                var defM = text.match(/^def\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*:/);
                if (defM) {
                    block = workspace.newBlock('devx_def_function');
                    block.setFieldValue(defM[1], 'NAME');
                    block.setFieldValue(defM[2], 'PARAMS');
                    block.initSvg(); block.render(); importedCount++;
                    // Collect body
                    var bodyIdx = [];
                    var j = i + 1;
                    while (j < indices.length && parsed[indices[j]].indent > baseIndent) {
                        bodyIdx.push(indices[j]); j++;
                    }
                    var bodyBlocks = parseRange(bodyIdx);
                    attachBody(block, 'BODY', bodyBlocks);
                    blocks.push(block);
                    i = j; continue;
                }

                // ── while True: ──
                if (text === 'while True:') {
                    block = workspace.newBlock('devx_while_true');
                    block.initSvg(); block.render(); importedCount++;
                    var bodyIdx2 = [];
                    var j2 = i + 1;
                    while (j2 < indices.length && parsed[indices[j2]].indent > baseIndent) {
                        bodyIdx2.push(indices[j2]); j2++;
                    }
                    var bodyBlocks2 = parseRange(bodyIdx2);
                    attachBody(block, 'DO', bodyBlocks2);
                    blocks.push(block);
                    i = j2; continue;
                }

                // ── while condition: ──
                var whileM = text.match(/^while\\s+(.+):/);
                if (whileM) {
                    block = workspace.newBlock('controls_whileUntil');
                    block.initSvg(); block.render(); importedCount++;
                    // attach condition
                    var condBlock = workspace.newBlock('devx_raw_code');
                    condBlock.setFieldValue(whileM[1], 'CODE');
                    condBlock.initSvg(); condBlock.render();
                    try { block.getInput('BOOL').connection.connect(condBlock.outputConnection); } catch(e) {}
                    var bodyIdx3 = [];
                    var j3 = i + 1;
                    while (j3 < indices.length && parsed[indices[j3]].indent > baseIndent) {
                        bodyIdx3.push(indices[j3]); j3++;
                    }
                    var bodyBlocks3 = parseRange(bodyIdx3);
                    attachBody(block, 'DO', bodyBlocks3);
                    blocks.push(block);
                    i = j3; continue;
                }

                // ── for var in range/iterable: ──
                var forM = text.match(/^for\\s+(\\w+)\\s+in\\s+(.+):/);
                if (forM) {
                    block = workspace.newBlock('controls_for');
                    try { block.getField('VAR').setValue(forM[1]); } catch(e) {}
                    block.initSvg(); block.render(); importedCount++;
                    var bodyIdx4 = [];
                    var j4 = i + 1;
                    while (j4 < indices.length && parsed[indices[j4]].indent > baseIndent) {
                        bodyIdx4.push(indices[j4]); j4++;
                    }
                    var bodyBlocks4 = parseRange(bodyIdx4);
                    attachBody(block, 'DO', bodyBlocks4);
                    blocks.push(block);
                    i = j4; continue;
                }

                // ── if / elif / else chain ──
                var ifM = text.match(/^if\\s+(.+):/);
                if (ifM) {
                    block = workspace.newBlock('controls_if');
                    block.initSvg(); block.render(); importedCount++;

                    // Count elif/else to mutate the block
                    var elifCount = 0;
                    var hasElse = false;
                    var scanJ = i + 1;
                    // skip if-body
                    while (scanJ < indices.length && parsed[indices[scanJ]].indent > baseIndent) scanJ++;
                    // count elif/else at same indent
                    while (scanJ < indices.length) {
                        var scanText = parsed[indices[scanJ]].text;
                        var scanIndent = parsed[indices[scanJ]].indent;
                        if (scanIndent !== baseIndent) break;
                        if (scanText.match(/^elif\\s+/)) {
                            elifCount++;
                            scanJ++;
                            while (scanJ < indices.length && parsed[indices[scanJ]].indent > baseIndent) scanJ++;
                        } else if (scanText === 'else:') {
                            hasElse = true;
                            scanJ++;
                            while (scanJ < indices.length && parsed[indices[scanJ]].indent > baseIndent) scanJ++;
                        } else {
                            break;
                        }
                    }

                    // Mutate if-block to have N elifs + else
                    if (elifCount > 0 || hasElse) {
                        try {
                            block.loadExtraState({elseIfCount: elifCount, hasElse: hasElse});
                        } catch(e) {
                            // Fallback for older Blockly: use mutation
                            try {
                                var mut = document.createElement('mutation');
                                mut.setAttribute('elseif', String(elifCount));
                                mut.setAttribute('else', hasElse ? '1' : '0');
                                block.domToMutation(mut);
                            } catch(e2) {}
                        }
                    }

                    // Attach IF0 condition
                    var ifCond = workspace.newBlock('devx_raw_code');
                    ifCond.setFieldValue(ifM[1], 'CODE');
                    ifCond.initSvg(); ifCond.render();
                    try { block.getInput('IF0').connection.connect(ifCond.outputConnection); } catch(e) {}

                    // Attach IF0 body (DO0)
                    var ifBodyIdx = [];
                    var jIf = i + 1;
                    while (jIf < indices.length && parsed[indices[jIf]].indent > baseIndent) {
                        ifBodyIdx.push(indices[jIf]); jIf++;
                    }
                    var ifBodyBlocks = parseRange(ifBodyIdx);
                    attachBody(block, 'DO0', ifBodyBlocks);

                    // Process elifs and else
                    var elifNum = 0;
                    while (jIf < indices.length) {
                        var nextText = parsed[indices[jIf]].text;
                        var nextIndent = parsed[indices[jIf]].indent;
                        if (nextIndent !== baseIndent) break;

                        var elifM = nextText.match(/^elif\\s+(.+):/);
                        if (elifM) {
                            elifNum++;
                            // Attach condition
                            var elifCond = workspace.newBlock('devx_raw_code');
                            elifCond.setFieldValue(elifM[1], 'CODE');
                            elifCond.initSvg(); elifCond.render();
                            try { block.getInput('IF' + elifNum).connection.connect(elifCond.outputConnection); } catch(e) {}
                            // Collect elif body
                            var elifBodyIdx = [];
                            jIf++;
                            while (jIf < indices.length && parsed[indices[jIf]].indent > baseIndent) {
                                elifBodyIdx.push(indices[jIf]); jIf++;
                            }
                            var elifBodyBlocks = parseRange(elifBodyIdx);
                            attachBody(block, 'DO' + elifNum, elifBodyBlocks);
                        } else if (nextText === 'else:') {
                            var elseBodyIdx = [];
                            jIf++;
                            while (jIf < indices.length && parsed[indices[jIf]].indent > baseIndent) {
                                elseBodyIdx.push(indices[jIf]); jIf++;
                            }
                            var elseBodyBlocks = parseRange(elseBodyIdx);
                            attachBody(block, 'ELSE', elseBodyBlocks);
                        } else {
                            break;
                        }
                    }
                    blocks.push(block);
                    i = jIf; continue;
                }

                // ── try / except / finally ──
                if (text === 'try:') {
                    // Collect entire try/except/finally as one raw block
                    // (Blockly has no native try/except, so we preserve the code)
                    var tryLines = [text];
                    var jTry = i + 1;
                    while (jTry < indices.length) {
                        var tl = parsed[indices[jTry]];
                        if (tl.indent <= baseIndent && !tl.text.match(/^(except|finally|else:)/)) break;
                        // except/finally at same indent are part of the try
                        if (tl.indent === baseIndent && tl.text.match(/^(except|finally|else:)/)) {
                            tryLines.push(tl.text);
                            jTry++;
                            continue;
                        }
                        // indented body lines
                        var spaces = '';
                        for (var sp = 0; sp < tl.indent - baseIndent; sp++) spaces += ' ';
                        tryLines.push(spaces + tl.text);
                        jTry++;
                    }
                    block = workspace.newBlock('devx_raw_statement');
                    block.setFieldValue(tryLines.join('\\n'), 'CODE');
                    block.initSvg(); block.render(); importedCount++;
                    blocks.push(block);
                    i = jTry; continue;
                }

                // ── skip standalone except/finally/else that wasn't caught by try ──
                if (text.match(/^(except|finally)/)) {
                    // Skip body
                    var jSkip = i + 1;
                    while (jSkip < indices.length && parsed[indices[jSkip]].indent > baseIndent) jSkip++;
                    i = jSkip; continue;
                }
                if (text === 'else:') {
                    var jSkip2 = i + 1;
                    while (jSkip2 < indices.length && parsed[indices[jSkip2]].indent > baseIndent) jSkip2++;
                    i = jSkip2; continue;
                }
                if (text.match(/^elif\\s+/)) {
                    var jSkip3 = i + 1;
                    while (jSkip3 < indices.length && parsed[indices[jSkip3]].indent > baseIndent) jSkip3++;
                    i = jSkip3; continue;
                }

                // ── Simple statements (no body) ──
                block = makeSingleBlock(text);
                if (block) {
                    blocks.push(block);
                }
            } catch(e) {
                // Skip problematic lines
            }

            i++;
        }
        return blocks;
    }

    // ── Run parser on all top-level indices ──
    var allIndices = [];
    for (var k = 0; k < parsed.length; k++) allIndices.push(k);
    var topBlocks = parseRange(allIndices);
    chainBlocks(topBlocks);

    workspace.cleanUp();
    workspace.scrollCenter();
    vscodeApi.postMessage({ type:'info', message:'Imported ' + importedCount + ' blocks from Python code!' });
}

// JAVASCRIPT/TYPESCRIPT CODE → BLOCKS IMPORT ENGINE
// ═══════════════════════════════════════════════════

function importJavaScript(code) {
    workspace.clear();
    var lines = code.split('\\n');
    var blockStack = [];
    var importedCount = 0;

    for (var i = 0; i < lines.length; i++) {
        var raw = lines[i];
        var trimmed = raw.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
        
        var indent = raw.length - raw.trimStart().length;
        var block = null;

        try {
            // ── function declaration ──
            if (trimmed.match(/^function\\s+/)) {
                var m = trimmed.match(/^function\\s+(\\w+)\\s*\\(([^)]*)\\)/);
                if (m) {
                    block = workspace.newBlock('devx_def_function');
                    block.setFieldValue(m[1], 'NAME');
                    block.setFieldValue(m[2], 'PARAMS');
                }
            }
            // ── arrow function assignment: const x = () => ──
            else if (trimmed.match(/^(const|let|var)\\s+\\w+\\s*=\\s*\\([^)]*\\)\\s*=>/)) {
                var am = trimmed.match(/^(?:const|let|var)\\s+(\\w+)\\s*=\\s*\\(([^)]*)\\)\\s*=>/);
                if (am) {
                    block = workspace.newBlock('devx_def_function');
                    block.setFieldValue(am[1], 'NAME');
                    block.setFieldValue(am[2], 'PARAMS');
                }
            }
            // ── while loop ──
            else if (trimmed.match(/^while\\s*\\(/)) {
                block = workspace.newBlock('controls_whileUntil');
            }
            // ── for loop ──
            else if (trimmed.match(/^for\\s*\\(/)) {
                block = workspace.newBlock('controls_for');
                var fm = trimmed.match(/^for\\s*\\(\\s*(?:let|var|const)?\\s*(\\w+)/);
                if (fm) {
                    try { block.getField('VAR').setValue(fm[1]); } catch(e) {}
                }
            }
            // ── if/else if/else ──
            else if (trimmed.match(/^if\\s*\\(/)) {
                block = workspace.newBlock('controls_if');
            }
            else if (trimmed.match(/^else\\s+if\\s*\\(/)) {
                continue; // handled with if block
            }
            else if (trimmed.match(/^else\\s*\\{?$/)) {
                continue; // handled with if block
            }
            // ── return ──
            else if (trimmed.match(/^return\\s*/)) {
                block = workspace.newBlock('devx_return');
                var retVal = trimmed.replace(/^return\\s*/, '').replace(/;\\s*$/, '').trim();
                if (retVal) {
                    var retExpr = workspace.newBlock('devx_raw_code');
                    retExpr.setFieldValue(retVal, 'CODE');
                    retExpr.initSvg();
                    retExpr.render();
                    try {
                        block.getInput('VALUE').connection.connect(retExpr.outputConnection);
                    } catch(e) {}
                }
            }
            // ── break ──
            else if (trimmed === 'break;' || trimmed === 'break') {
                block = workspace.newBlock('devx_break');
            }
            // ── console.log ──
            else if (trimmed.match(/^console\\.log\\s*\\(/)) {
                var cContent = trimmed.match(/^console\\.log\\((.+)\\);?$/);
                if (cContent) {
                    block = workspace.newBlock('text_print');
                    var printVal = makeValueBlock(cContent[1].trim());
                    try { block.getInput('TEXT').connection.connect(printVal.outputConnection); } catch(e) {}
                }
            }
            // ── variable declaration: let x = ..., const y = ... ──
            else if (trimmed.match(/^(const|let|var)\\s+\\w+\\s*=/)) {
                var vm = trimmed.match(/^(?:const|let|var)\\s+(\\w+)\\s*=\\s*(.+?);?$/);
                if (vm) {
                    block = workspace.newBlock('variables_set');
                    try {
                        var vField = block.getField('VAR');
                        if (vField) vField.setValue(workspace.createVariable(vm[1]).getId());
                    } catch(e) {}
                    
                    var valExpr = workspace.newBlock('devx_raw_code');
                    valExpr.setFieldValue(vm[2], 'CODE');
                    valExpr.initSvg();
                    valExpr.render();
                    try {
                        block.getInput('VALUE').connection.connect(valExpr.outputConnection);
                    } catch(e) {}
                }
            }
            // ── function call statement: func(); ──
            else if (trimmed.match(/^\\w+\\s*\\([^)]*\\);?$/)) {
                var cm = trimmed.match(/^(\\w+)\\s*\\(([^)]*)\\);?$/);
                if (cm) {
                    block = workspace.newBlock('devx_call_statement');
                    block.setFieldValue(cm[1], 'NAME');
                    block.setFieldValue(cm[2], 'ARGS');
                }
            }

            if (block) {
                block.initSvg();
                block.render();
                importedCount++;

                // Handle nesting based on indentation
                if (blockStack.length > 0) {
                    var parent = null;
                    for (var bi = blockStack.length - 1; bi >= 0; bi--) {
                        if (blockStack[bi].indent < indent) {
                            parent = blockStack[bi].block;
                            break;
                        } else if (blockStack[bi].indent >= indent) {
                            blockStack.pop();
                        }
                    }

                    if (parent) {
                        var stmtInputs = ['BODY', 'DO', 'DO0', 'IF0', 'ELSE', 'STACK'];
                        var connected = false;
                        for (var si = 0; si < stmtInputs.length; si++) {
                            var inp = parent.getInput(stmtInputs[si]);
                            if (inp && inp.connection && !inp.connection.targetBlock() && block.previousConnection) {
                                try {
                                    inp.connection.connect(block.previousConnection);
                                    connected = true;
                                    break;
                                } catch(e) {}
                            }
                        }

                        if (!connected) {
                            var sameIndentBlock = null;
                            for (var s2 = blockStack.length - 1; s2 >= 0; s2--) {
                                if (blockStack[s2].indent === indent) {
                                    sameIndentBlock = blockStack[s2].block;
                                    break;
                                }
                            }
                            if (sameIndentBlock && sameIndentBlock.nextConnection && block.previousConnection) {
                                try { sameIndentBlock.nextConnection.connect(block.previousConnection); } catch(e) {}
                            }
                        }
                    }
                }

                blockStack.push({ block: block, indent: indent });
            }
        } catch(e) {
            // Skip problematic lines
        }
    }

    workspace.cleanUp();
    workspace.scrollCenter();
    vscodeApi.postMessage({ type:'info', message:'Imported ' + importedCount + ' blocks from JavaScript code!' });
}

// Expose button functions to global scope
window.genPython = genPython;
window.genJS = genJS;
window.doRun = doRun;
window.doImport = doImport;
window.doClear = doClear;
window.togglePreview = togglePreview;

// ── dev mode ──
var _dm = false;
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.code === 'KeyG') {
        _dm = !_dm;
        if (_dm) {
            document.execCommand('enableObjectResizing', false, 'true');
            var s = document.createElement('style');
            s.id = '_ds';
            s.textContent = '#codePreview{user-select:text!important;-webkit-user-select:text!important;}';
            document.head.appendChild(s);
        } else {
            var ds = document.getElementById('_ds');
            if (ds) ds.remove();
        }
        e.preventDefault();
        return;
    }
    if (!_dm) return;
    // Tab inserts 4 spaces in focused textarea/input
    if (e.key === 'Tab') {
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
    }
});
// Enable paste in dev mode
document.addEventListener('paste', function(e) {
    if (!_dm) { e.preventDefault(); return; }
});
document.addEventListener('copy', function(e) {
    if (!_dm) { e.preventDefault(); return; }
});

})();
</script>
</body>
</html>`;
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
    }
}
