/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const aiService_1 = __webpack_require__(2);
const teacherSlate_1 = __webpack_require__(4);
const visualizerProvider_1 = __webpack_require__(5);
const ghostTextProvider_1 = __webpack_require__(7);
let senseiStatusBarItem;
let senseiTimeout;
let idleTimeout;
function activate(context) {
    console.log('Congratulations, your extension "vertex-vscode" is now active!');
    const aiService = aiService_1.AIService.getInstance();
    const slateService = teacherSlate_1.TeacherSlateService.getInstance();
    // Initialize AI - if key is missing, this will prompt and wait
    aiService.initialize(context).then(success => {
        if (success) {
            senseiStatusBarItem.text = "$(person) Sensei: Ready";
        }
        else {
            senseiStatusBarItem.text = "$(warning) Sensei: API Key Missing";
        }
    });
    // Create status bar item
    senseiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    senseiStatusBarItem.text = "$(person) Sensei: Ready";
    senseiStatusBarItem.show();
    context.subscriptions.push(senseiStatusBarItem);
    // ── API Key Reset Commands (visible in Ctrl+Shift+P) ──
    let resetGeminiKey = vscode.commands.registerCommand('vertex.resetGeminiKey', async () => {
        await context.secrets.delete('GEMINI_API_KEY');
        vscode.window.showInformationMessage('✅ Gemini API Key has been reset. Re-enter it on next use.');
        await aiService.initialize(context);
    });
    let resetOpenRouterKey = vscode.commands.registerCommand('vertex.resetOpenRouterKey', async () => {
        await context.secrets.delete('OPENROUTER_API_KEY');
        vscode.window.showInformationMessage('✅ OpenRouter API Key has been reset. Re-enter it on next use.');
    });
    let resetOllamaKey = vscode.commands.registerCommand('vertex.resetOllamaKey', async () => {
        await context.secrets.delete('OLLAMA_CLOUD_API_KEY');
        vscode.window.showInformationMessage('✅ Ollama Cloud API Key has been reset. Re-enter it on next use.');
    });
    let resetAllKeys = vscode.commands.registerCommand('vertex.resetAllKeys', async () => {
        const confirm = await vscode.window.showWarningMessage('Reset ALL API keys (Gemini, OpenRouter, Ollama Cloud)?', { modal: true }, 'Yes, Reset All');
        if (confirm === 'Yes, Reset All') {
            await Promise.all([
                context.secrets.delete('GEMINI_API_KEY'),
                context.secrets.delete('OPENROUTER_API_KEY'),
                context.secrets.delete('OLLAMA_CLOUD_API_KEY'),
            ]);
            vscode.window.showInformationMessage('🔄 All API keys have been reset. You will be prompted to re-enter them on next use.');
            await aiService.initialize(context);
        }
    });
    // Command to load a sample lesson
    let loadLesson = vscode.commands.registerCommand('vertex.loadLesson', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Open a file first to load a lesson.');
            return;
        }
        const lang = editor.document.languageId;
        const lessons = {
            python: 'print("Hello, Vertex!")\nfor i in range(5):\n    print(f"Counting {i}")',
            javascript: 'function helloWorld() {\n  console.log("Hello, Vertex!");\n}\nhelloWorld();',
            typescript: 'function helloWorld() {\n  console.log("Hello, Vertex!");\n}\nhelloWorld();',
            cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Vertex!" << std::endl;\n    return 0;\n}',
            c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, Vertex!\\n");\n    return 0;\n}',
            java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Vertex!");\n    }\n}'
        };
        const sampleCode = lessons[lang] || lessons.javascript;
        slateService.setLesson(sampleCode);
        vscode.window.showInformationMessage(`Loaded ${lang} lesson! Follow the ghost text.`);
        senseiStatusBarItem.text = "$(person) Sensei: Lesson Active";
    });
    // Command to clear lesson
    let clearLesson = vscode.commands.registerCommand('vertex.clearLesson', () => {
        slateService.deactivate();
        vscode.window.showInformationMessage('Lesson cleared.');
        senseiStatusBarItem.text = "$(person) Sensei: Ready";
    });
    // Register Sidebar Visualizer
    const visualizerProvider = new visualizerProvider_1.VisualizerProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(visualizerProvider_1.VisualizerProvider.viewType, visualizerProvider));
    // Command to toggle VisualizingIntelligence sidebar
    let toggleVisualizer = vscode.commands.registerCommand('vertex.toggleVisualizer', () => {
        vscode.commands.executeCommand('vertex.visualizer.focus');
    });
    // Command to show visualizer (Deprecated older version, redirect to sidebar)
    let showVisualizer = vscode.commands.registerCommand('vertex.showVisualizer', () => {
        vscode.commands.executeCommand('vertex.visualizer.focus');
    });
    // Command to run current code using Task API
    let runCode = vscode.commands.registerCommand('vertex.runCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const lang = document.languageId;
        const filePath = document.uri.fsPath;
        let command = '';
        if (lang === 'python') {
            command = `python3 "${filePath}"`;
        }
        else if (lang === 'javascript' || lang === 'typescript') {
            command = `node "${filePath}"`;
        }
        else if (lang === 'c') {
            command = `gcc "${filePath}" -o "${filePath}.out" && "${filePath}.out"`;
        }
        else if (lang === 'cpp') {
            command = `g++ "${filePath}" -o "${filePath}.out" && "${filePath}.out"`;
        }
        else if (lang === 'java') {
            command = `java "${filePath}"`;
        }
        if (command) {
            const task = new vscode.Task({ type: 'shell' }, vscode.TaskScope.Workspace, 'Vertex Run', 'Vertex', new vscode.ShellExecution(command));
            await vscode.tasks.executeTask(task);
        }
        else {
            vscode.window.showErrorMessage(`Running code for "${lang}" is not yet supported in Vertex.`);
        }
    });
    // Command to quickly select Code Generation Provider & Model (Ctrl+J)
    let selectModel = vscode.commands.registerCommand('vertex.selectModel', async () => {
        const providers = ['Local Model (Ollama)', 'Ollama Cloud', 'OpenRouter', 'Gemini'];
        const provider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select an AI provider for Code Generation',
            title: 'Vertex: Code Gen Provider Selection'
        });
        if (provider) {
            const config = vscode.workspace.getConfiguration('vertex');
            await config.update('codeGenProvider', provider, vscode.ConfigurationTarget.Global);
            if (provider !== 'Local Model (Ollama)') {
                await aiService.ensureApiKey(context, provider);
            }
            senseiStatusBarItem.text = `$(sync~spin) Sensei: Scanning ${provider} models...`;
            const models = await aiService.listModels(provider);
            senseiStatusBarItem.text = `$(person) Sensei: Ready`;
            if (models.length > 0) {
                const model = await vscode.window.showQuickPick(models, {
                    placeHolder: `Select a model for Code Generation (${provider})`,
                    title: 'Vertex: Code Gen Model Selection'
                });
                if (model) {
                    await config.update('codeGenModel', model, vscode.ConfigurationTarget.Global);
                    // --- PLAN B: DEVELOPER SYNC (CODE GEN -> SENSEI) ---
                    /*
                    await config.update('senseiProvider', provider, vscode.ConfigurationTarget.Global);
                    await config.update('senseiModel', model, vscode.ConfigurationTarget.Global);
                    */
                    vscode.window.showInformationMessage(`Vertex: Code Gen updated to ${provider} (${model})`);
                }
            }
        }
    });
    // Command to quickly select Sensei Provider & Model (Ctrl+H)
    let changeProvider = vscode.commands.registerCommand('vertex.changeProvider', async () => {
        const providers = ['Local Model (Ollama)', 'Ollama Cloud', 'OpenRouter', 'Gemini'];
        const provider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select an AI provider for Sensei',
            title: 'Sensei: Provider Selection'
        });
        if (provider) {
            const config = vscode.workspace.getConfiguration('vertex');
            await config.update('senseiProvider', provider, vscode.ConfigurationTarget.Global);
            if (provider !== 'Local Model (Ollama)') {
                await aiService.ensureApiKey(context, provider);
            }
            // Immediately ask for the model after provider change
            senseiStatusBarItem.text = `$(sync~spin) Sensei: Scanning ${provider} models...`;
            const models = await aiService.listModels(provider);
            senseiStatusBarItem.text = `$(person) Sensei: Ready`;
            if (models.length > 0) {
                const model = await vscode.window.showQuickPick(models, {
                    placeHolder: `Select a model for Sensei (${provider})`,
                    title: 'Sensei: Model Selection'
                });
                if (model) {
                    await config.update('senseiModel', model, vscode.ConfigurationTarget.Global);
                    // --- PLAN B: DEVELOPER SYNC (SENSEI -> CODE GEN) ---
                    /*
                    await config.update('codeGenProvider', provider, vscode.ConfigurationTarget.Global);
                    await config.update('codeGenModel', model, vscode.ConfigurationTarget.Global);
                    */
                }
            }
        }
    });
    // Command to ask Sensei for code
    let askSensei = vscode.commands.registerCommand('vertex.askSensei', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        // Clear feedback and stop timers during interaction
        clearSenseiTimers();
        slateService.clearFeedback();
        const userInput = await vscode.window.showInputBox({
            prompt: 'Ask Sensei for code...',
            placeHolder: 'e.g., create a list of even numbers'
        });
        if (userInput) {
            senseiStatusBarItem.text = "$(sync~spin) Sensei: Coding...";
            const context = editor.document.getText();
            const lang = editor.document.languageId;
            const generatedCode = await aiService.generateCode(userInput, context, lang);
            if (generatedCode) {
                slateService.setSuggestedCode(generatedCode);
                senseiStatusBarItem.text = "$(person) Sensei: Code suggested! Press Tab to accept.";
                vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
            }
            else {
                senseiStatusBarItem.text = "$(error) Sensei: Sorry, I couldn't generate that.";
            }
        }
    });
    // Listen for text changes
    let onType = vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            if (slateService.isActive()) {
                slateService.updateDecorations();
            }
            // Clear inline feedback immediately when user types
            slateService.clearFeedback();
            // Handle suggestion persistence
            if (slateService.getSuggestedCode().length > 0) {
                const currentText = event.document.getText();
                if (currentText.length === 0) {
                    slateService.clearSuggestedCode();
                }
            }
            // Trigger Sensei feedback (debounced)
            triggerSensei(editor, slateService.getSuggestedCode(), aiService);
        }
    });
    // Listen for editor focus changes
    let onFocus = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && slateService.isActive()) {
            slateService.updateDecorations();
        }
        slateService.clearSuggestedCode();
        slateService.clearFeedback();
    });
    // Listen for configuration changes
    const onConfigChange = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('vertex.senseiModel') ||
            event.affectsConfiguration('vertex.senseiProvider') ||
            event.affectsConfiguration('vertex.codeGenModel') ||
            event.affectsConfiguration('vertex.codeGenProvider') ||
            event.affectsConfiguration('vertex.ollamaModel')) {
            const config = vscode.workspace.getConfiguration('vertex');
            const sModel = config.get('senseiModel');
            const cModel = config.get('codeGenModel');
            await aiService.syncModels();
            vscode.window.showInformationMessage(`Vertex: AI Models Updated (Sensei: ${sModel}, CodeGen: ${cModel})`);
        }
    });
    // Register Providers
    const ghostProvider = vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file', language: '*' }, new ghostTextProvider_1.GhostTextProvider());
    const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file', language: '*' }, {
        async provideHover(document, position) {
            const line = document.lineAt(position.line);
            const tip = await aiService.getLineInsight(line.text, document.languageId);
            if (!tip)
                return null;
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportHtml = true;
            markdown.appendMarkdown(`### 🧙‍♂️ Sensei Insight\n---\n${tip}\n\n*Hover to learn!*`);
            const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
            return new vscode.Hover(markdown, range);
        }
    });
    context.subscriptions.push(resetGeminiKey, resetOpenRouterKey, resetOllamaKey, resetAllKeys, loadLesson, clearLesson, showVisualizer, toggleVisualizer, selectModel, changeProvider, runCode, askSensei, onType, onFocus, onConfigChange, ghostProvider, hoverProvider);
}
function triggerSensei(editor, currentSuggestion, aiService) {
    const slateService = teacherSlate_1.TeacherSlateService.getInstance();
    clearSenseiTimers();
    senseiStatusBarItem.text = "$(sync~spin) Sensei: Thinking...";
    // 1. Idle Insight & Auto-Suggestion Timer (1s)
    idleTimeout = setTimeout(async () => {
        const document = editor.document;
        const lineIndex = editor.selection.active.line;
        const lineText = document.lineAt(lineIndex).text;
        if (lineText.trim()) {
            // Insight
            const insight = await aiService.getLineInsight(lineText, document.languageId);
            if (insight) {
                slateService.setHoverTip(insight);
                senseiStatusBarItem.text = "$(lightbulb) Sensei: Insight ready (Hover line)";
            }
            // Auto-suggest only if not already in a suggestion and not selecting text
            if (currentSuggestion.length === 0 && editor.selection.isEmpty) {
                const generatedCode = await aiService.generateCode("continue the code", document.getText(), document.languageId);
                if (generatedCode) {
                    slateService.setSuggestedCode(generatedCode);
                    vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
                }
            }
        }
    }, 1000);
    // 2. Inline Motivational Feedback Timer (3s)
    senseiTimeout = setTimeout(async () => {
        // CRITICAL: Don't show feedback if there's an active ghost text suggestion to avoid overlap
        if (slateService.getSuggestedCode().length > 0) {
            senseiStatusBarItem.text = "$(person) Sensei: Ready";
            return;
        }
        const document = editor.document;
        const feedback = await aiService.getMotivationalFeedback(document.getText(), "");
        if (senseiStatusBarItem.text.includes("Thinking") || senseiStatusBarItem.text.includes("Insight ready")) {
            slateService.showFeedback(feedback);
            senseiStatusBarItem.text = "$(person) Sensei: Inspired";
            setTimeout(() => {
                senseiStatusBarItem.text = "$(person) Sensei: Ready";
            }, 5000);
        }
    }, 3000);
}
function clearSenseiTimers() {
    if (senseiTimeout) {
        clearTimeout(senseiTimeout);
        senseiTimeout = undefined;
    }
    if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = undefined;
    }
}
function deactivate() {
    teacherSlate_1.TeacherSlateService.getInstance().deactivate();
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AIService = void 0;
const vscode = __importStar(__webpack_require__(1));
const generative_ai_1 = __webpack_require__(3);
class AIService {
    static instance;
    genAI;
    context;
    senseiModel;
    codeGenModel;
    // Fail-switch: if true, all services use the same model (Dev override)
    // private readonly SYNC_MODE: boolean = true; 
    constructor() { }
    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }
    async initialize(context) {
        this.context = context;
        await this.syncModels();
        return true;
    }
    /**
     * Re-initializes models based on current configuration.
     */
    async syncModels() {
        const config = vscode.workspace.getConfiguration('vertex');
        const senseiProvider = config.get('senseiProvider') || 'Gemini';
        const codeGenProvider = config.get('codeGenProvider') || 'Gemini';
        // Initialize Gemini if needed by either service
        if (senseiProvider === 'Gemini' || codeGenProvider === 'Gemini') {
            await this.initGemini();
        }
    }
    async initGemini() {
        if (!this.context)
            return;
        const apiKey = await this.context.secrets.get('GEMINI_API_KEY');
        if (apiKey) {
            try {
                this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
                const config = vscode.workspace.getConfiguration('vertex');
                const senseiModelName = config.get('senseiModel') || 'gemini-2.0-flash';
                this.senseiModel = this.genAI.getGenerativeModel({ model: senseiModelName }, { apiVersion: 'v1beta' });
                const codeGenModelName = config.get('codeGenModel') || 'gemini-2.0-flash';
                this.codeGenModel = this.genAI.getGenerativeModel({ model: codeGenModelName }, { apiVersion: 'v1beta' });
            }
            catch (error) {
                console.error('[Vertex] Gemini Init Error:', error);
            }
        }
    }
    async ensureApiKey(context, provider) {
        const secretKey = `${provider.toUpperCase().replace(/\s/g, '_')}_API_KEY`;
        let apiKey = await context.secrets.get(secretKey);
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({
                prompt: `Enter your API Key for ${provider}`,
                placeHolder: 'API Key...',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => value ? null : `${provider} API Key is required.`
            });
            if (apiKey) {
                await context.secrets.store(secretKey, apiKey);
                vscode.window.showInformationMessage(`${provider} API Key saved.`);
            }
        }
        return apiKey;
    }
    /**
     * Lists available models for a given provider.
     */
    async listModels(provider) {
        const config = vscode.workspace.getConfiguration('vertex');
        try {
            if (provider === 'Gemini') {
                // Hardcoded defaults for now as Gemini listModels API is often restricted
                return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash-latest'];
            }
            if (provider === 'Local Model (Ollama)') {
                const endpoint = config.get('ollamaEndpoint') || 'http://localhost:11434';
                const res = await fetch(`${endpoint}/api/tags`);
                const data = await res.json();
                return data.models.map((m) => m.name);
            }
            if (provider === 'Ollama Cloud') {
                // Use default endpoint for Ollama Cloud (assuming standard API)
                const res = await fetch('https://api.ollama.com/api/tags');
                const data = await res.json();
                return data.models.map((m) => m.name);
            }
            if (provider === 'OpenRouter') {
                const res = await fetch('https://openrouter.ai/api/v1/models');
                const data = await res.json();
                return data.data.map((m) => m.id);
            }
        }
        catch (error) {
            console.error(`[Vertex] Error listing models for ${provider}:`, error);
        }
        return [];
    }
    async callAI(prompt, service) {
        const config = vscode.workspace.getConfiguration('vertex');
        // Developer Fail-switch (manual edit required)
        // if (this.SYNC_MODE) { service = 'codegen'; } 
        const providerKey = service === 'sensei' ? 'senseiProvider' : 'codeGenProvider';
        const modelKey = service === 'sensei' ? 'senseiModel' : 'codeGenModel';
        const provider = config.get(providerKey) || 'Gemini';
        const modelName = config.get(modelKey);
        try {
            if (provider === 'Gemini') {
                const model = service === 'sensei' ? this.senseiModel : this.codeGenModel;
                if (!model) {
                    throw new Error(`Gemini model for ${service} not initialized. Check your API key.`);
                }
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return response.text().trim();
            }
            // Generic Fetch for other providers
            let url = '';
            let headers = { 'Content-Type': 'application/json' };
            let body = {};
            if (!modelName) {
                throw new Error(`No model selected for ${service} (${provider})`);
            }
            if (provider === 'Local Model (Ollama)') {
                url = `${config.get('ollamaEndpoint') || 'http://localhost:11434'}/api/generate`;
                body = { model: modelName, prompt, stream: false };
            }
            else if (provider === 'Ollama Cloud') {
                const key = await this.context?.secrets.get('OLLAMA_CLOUD_API_KEY');
                url = 'https://api.ollama.com/api/generate';
                headers['Authorization'] = `Bearer ${key}`;
                body = { model: modelName, prompt, stream: false };
            }
            else if (provider === 'OpenRouter') {
                const key = await this.context?.secrets.get('OPENROUTER_API_KEY');
                url = 'https://openrouter.ai/api/v1/chat/completions';
                headers['Authorization'] = `Bearer ${key}`;
                body = {
                    model: modelName,
                    messages: [{ role: 'user', content: prompt }]
                };
            }
            else {
                throw new Error(`Unknown provider: ${provider}`);
            }
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (res.status === 429) {
                vscode.window.showErrorMessage(`🧙‍♂️ Sensei: My energy is exhausted (API Limit Reached). Please try another provider or wait a bit.`);
                throw new Error('API Limit Reached');
            }
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`AI Provider Error (${res.status}): ${errText}`);
            }
            const data = await res.json();
            if (provider === 'OpenRouter') {
                return data.choices[0].message.content.trim();
            }
            return data.response.trim();
        }
        catch (error) {
            console.error(`[Vertex] AI Call Error (${provider}):`, error);
            throw error;
        }
    }
    async getMotivationalFeedback(studentCode, ghostCode) {
        try {
            const prompt = `You are "Sensei", a motivational AI mentor. Provide 10-20 encouraging words for this code: ${studentCode}`;
            return await this.callAI(prompt, 'sensei');
        }
        catch (error) {
            return "Persistence is the key to mastery. Keep coding!";
        }
    }
    async generateCode(prompt, context, lang) {
        try {
            const fullPrompt = `Generate ONLY the ${lang} code for: ${prompt}. Context: ${context}. DO NOT INCLUDE EXPLANATIONS. ONLY CODE.`;
            let code = await this.callAI(fullPrompt, 'codegen');
            // Robust parsing: extract first code block if it exists
            const codeBlockMatch = code.match(/```[a-z]*\n([\s\S]*?)\n```/i);
            if (codeBlockMatch) {
                return codeBlockMatch[1].trim();
            }
            // If no block found, try to strip leading/trailing text if it looks like conversational chatter
            return code.replace(/^certainly!.*?\n/is, '').replace(/^here is the code.*?\n/is, '').trim();
        }
        catch (error) {
            return "";
        }
    }
    async getLineInsight(lineCode, lang) {
        try {
            const prompt = `Provide a 20-word technical insight with a code snippet for this ${lang} line: ${lineCode}. Format as Markdown.`;
            let tip = await this.callAI(prompt, 'sensei');
            // Clean up backticks if the model wraps the whole response in them (common with Ollama)
            if (tip.startsWith('```') && tip.endsWith('```')) {
                const match = tip.match(/```[a-z]*\n([\s\S]*?)\n```/i);
                if (match)
                    return match[1].trim();
            }
            return tip;
        }
        catch (error) {
            return "";
        }
    }
}
exports.AIService = AIService;


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Contains the list of OpenAPI data types
 * as defined by https://swagger.io/docs/specification/data-models/data-types/
 * @public
 */
exports.SchemaType = void 0;
(function (SchemaType) {
    /** String type. */
    SchemaType["STRING"] = "string";
    /** Number type. */
    SchemaType["NUMBER"] = "number";
    /** Integer type. */
    SchemaType["INTEGER"] = "integer";
    /** Boolean type. */
    SchemaType["BOOLEAN"] = "boolean";
    /** Array type. */
    SchemaType["ARRAY"] = "array";
    /** Object type. */
    SchemaType["OBJECT"] = "object";
})(exports.SchemaType || (exports.SchemaType = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @public
 */
exports.ExecutableCodeLanguage = void 0;
(function (ExecutableCodeLanguage) {
    ExecutableCodeLanguage["LANGUAGE_UNSPECIFIED"] = "language_unspecified";
    ExecutableCodeLanguage["PYTHON"] = "python";
})(exports.ExecutableCodeLanguage || (exports.ExecutableCodeLanguage = {}));
/**
 * Possible outcomes of code execution.
 * @public
 */
exports.Outcome = void 0;
(function (Outcome) {
    /**
     * Unspecified status. This value should not be used.
     */
    Outcome["OUTCOME_UNSPECIFIED"] = "outcome_unspecified";
    /**
     * Code execution completed successfully.
     */
    Outcome["OUTCOME_OK"] = "outcome_ok";
    /**
     * Code execution finished but with a failure. `stderr` should contain the
     * reason.
     */
    Outcome["OUTCOME_FAILED"] = "outcome_failed";
    /**
     * Code execution ran for too long, and was cancelled. There may or may not
     * be a partial output present.
     */
    Outcome["OUTCOME_DEADLINE_EXCEEDED"] = "outcome_deadline_exceeded";
})(exports.Outcome || (exports.Outcome = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Possible roles.
 * @public
 */
const POSSIBLE_ROLES = ["user", "model", "function", "system"];
/**
 * Harm categories that would cause prompts or candidates to be blocked.
 * @public
 */
exports.HarmCategory = void 0;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
    HarmCategory["HARM_CATEGORY_CIVIC_INTEGRITY"] = "HARM_CATEGORY_CIVIC_INTEGRITY";
})(exports.HarmCategory || (exports.HarmCategory = {}));
/**
 * Threshold above which a prompt or candidate will be blocked.
 * @public
 */
exports.HarmBlockThreshold = void 0;
(function (HarmBlockThreshold) {
    /** Threshold is unspecified. */
    HarmBlockThreshold["HARM_BLOCK_THRESHOLD_UNSPECIFIED"] = "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
    /** Content with NEGLIGIBLE will be allowed. */
    HarmBlockThreshold["BLOCK_LOW_AND_ABOVE"] = "BLOCK_LOW_AND_ABOVE";
    /** Content with NEGLIGIBLE and LOW will be allowed. */
    HarmBlockThreshold["BLOCK_MEDIUM_AND_ABOVE"] = "BLOCK_MEDIUM_AND_ABOVE";
    /** Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed. */
    HarmBlockThreshold["BLOCK_ONLY_HIGH"] = "BLOCK_ONLY_HIGH";
    /** All content will be allowed. */
    HarmBlockThreshold["BLOCK_NONE"] = "BLOCK_NONE";
})(exports.HarmBlockThreshold || (exports.HarmBlockThreshold = {}));
/**
 * Probability that a prompt or candidate matches a harm category.
 * @public
 */
exports.HarmProbability = void 0;
(function (HarmProbability) {
    /** Probability is unspecified. */
    HarmProbability["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
    /** Content has a negligible chance of being unsafe. */
    HarmProbability["NEGLIGIBLE"] = "NEGLIGIBLE";
    /** Content has a low chance of being unsafe. */
    HarmProbability["LOW"] = "LOW";
    /** Content has a medium chance of being unsafe. */
    HarmProbability["MEDIUM"] = "MEDIUM";
    /** Content has a high chance of being unsafe. */
    HarmProbability["HIGH"] = "HIGH";
})(exports.HarmProbability || (exports.HarmProbability = {}));
/**
 * Reason that a prompt was blocked.
 * @public
 */
exports.BlockReason = void 0;
(function (BlockReason) {
    // A blocked reason was not specified.
    BlockReason["BLOCKED_REASON_UNSPECIFIED"] = "BLOCKED_REASON_UNSPECIFIED";
    // Content was blocked by safety settings.
    BlockReason["SAFETY"] = "SAFETY";
    // Content was blocked, but the reason is uncategorized.
    BlockReason["OTHER"] = "OTHER";
})(exports.BlockReason || (exports.BlockReason = {}));
/**
 * Reason that a candidate finished.
 * @public
 */
exports.FinishReason = void 0;
(function (FinishReason) {
    // Default value. This value is unused.
    FinishReason["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
    // Natural stop point of the model or provided stop sequence.
    FinishReason["STOP"] = "STOP";
    // The maximum number of tokens as specified in the request was reached.
    FinishReason["MAX_TOKENS"] = "MAX_TOKENS";
    // The candidate content was flagged for safety reasons.
    FinishReason["SAFETY"] = "SAFETY";
    // The candidate content was flagged for recitation reasons.
    FinishReason["RECITATION"] = "RECITATION";
    // The candidate content was flagged for using an unsupported language.
    FinishReason["LANGUAGE"] = "LANGUAGE";
    // Token generation stopped because the content contains forbidden terms.
    FinishReason["BLOCKLIST"] = "BLOCKLIST";
    // Token generation stopped for potentially containing prohibited content.
    FinishReason["PROHIBITED_CONTENT"] = "PROHIBITED_CONTENT";
    // Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information (SPII).
    FinishReason["SPII"] = "SPII";
    // The function call generated by the model is invalid.
    FinishReason["MALFORMED_FUNCTION_CALL"] = "MALFORMED_FUNCTION_CALL";
    // Unknown reason.
    FinishReason["OTHER"] = "OTHER";
})(exports.FinishReason || (exports.FinishReason = {}));
/**
 * Task type for embedding content.
 * @public
 */
exports.TaskType = void 0;
(function (TaskType) {
    TaskType["TASK_TYPE_UNSPECIFIED"] = "TASK_TYPE_UNSPECIFIED";
    TaskType["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY";
    TaskType["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT";
    TaskType["SEMANTIC_SIMILARITY"] = "SEMANTIC_SIMILARITY";
    TaskType["CLASSIFICATION"] = "CLASSIFICATION";
    TaskType["CLUSTERING"] = "CLUSTERING";
})(exports.TaskType || (exports.TaskType = {}));
/**
 * @public
 */
exports.FunctionCallingMode = void 0;
(function (FunctionCallingMode) {
    // Unspecified function calling mode. This value should not be used.
    FunctionCallingMode["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
    // Default model behavior, model decides to predict either a function call
    // or a natural language repspose.
    FunctionCallingMode["AUTO"] = "AUTO";
    // Model is constrained to always predicting a function call only.
    // If "allowed_function_names" are set, the predicted function call will be
    // limited to any one of "allowed_function_names", else the predicted
    // function call will be any one of the provided "function_declarations".
    FunctionCallingMode["ANY"] = "ANY";
    // Model will not predict any function call. Model behavior is same as when
    // not passing any function declarations.
    FunctionCallingMode["NONE"] = "NONE";
})(exports.FunctionCallingMode || (exports.FunctionCallingMode = {}));
/**
 * The mode of the predictor to be used in dynamic retrieval.
 * @public
 */
exports.DynamicRetrievalMode = void 0;
(function (DynamicRetrievalMode) {
    // Unspecified function calling mode. This value should not be used.
    DynamicRetrievalMode["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
    // Run retrieval only when system decides it is necessary.
    DynamicRetrievalMode["MODE_DYNAMIC"] = "MODE_DYNAMIC";
})(exports.DynamicRetrievalMode || (exports.DynamicRetrievalMode = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Basic error type for this SDK.
 * @public
 */
class GoogleGenerativeAIError extends Error {
    constructor(message) {
        super(`[GoogleGenerativeAI Error]: ${message}`);
    }
}
/**
 * Errors in the contents of a response from the model. This includes parsing
 * errors, or responses including a safety block reason.
 * @public
 */
class GoogleGenerativeAIResponseError extends GoogleGenerativeAIError {
    constructor(message, response) {
        super(message);
        this.response = response;
    }
}
/**
 * Error class covering HTTP errors when calling the server. Includes HTTP
 * status, statusText, and optional details, if provided in the server response.
 * @public
 */
class GoogleGenerativeAIFetchError extends GoogleGenerativeAIError {
    constructor(message, status, statusText, errorDetails) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.errorDetails = errorDetails;
    }
}
/**
 * Errors in the contents of a request originating from user input.
 * @public
 */
class GoogleGenerativeAIRequestInputError extends GoogleGenerativeAIError {
}
/**
 * Error thrown when a request is aborted, either due to a timeout or
 * intentional cancellation by the user.
 * @public
 */
class GoogleGenerativeAIAbortError extends GoogleGenerativeAIError {
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
/**
 * We can't `require` package.json if this runs on web. We will use rollup to
 * swap in the version number here at build time.
 */
const PACKAGE_VERSION = "0.24.1";
const PACKAGE_LOG_HEADER = "genai-js";
var Task;
(function (Task) {
    Task["GENERATE_CONTENT"] = "generateContent";
    Task["STREAM_GENERATE_CONTENT"] = "streamGenerateContent";
    Task["COUNT_TOKENS"] = "countTokens";
    Task["EMBED_CONTENT"] = "embedContent";
    Task["BATCH_EMBED_CONTENTS"] = "batchEmbedContents";
})(Task || (Task = {}));
class RequestUrl {
    constructor(model, task, apiKey, stream, requestOptions) {
        this.model = model;
        this.task = task;
        this.apiKey = apiKey;
        this.stream = stream;
        this.requestOptions = requestOptions;
    }
    toString() {
        var _a, _b;
        const apiVersion = ((_a = this.requestOptions) === null || _a === void 0 ? void 0 : _a.apiVersion) || DEFAULT_API_VERSION;
        const baseUrl = ((_b = this.requestOptions) === null || _b === void 0 ? void 0 : _b.baseUrl) || DEFAULT_BASE_URL;
        let url = `${baseUrl}/${apiVersion}/${this.model}:${this.task}`;
        if (this.stream) {
            url += "?alt=sse";
        }
        return url;
    }
}
/**
 * Simple, but may become more complex if we add more versions to log.
 */
function getClientHeaders(requestOptions) {
    const clientHeaders = [];
    if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.apiClient) {
        clientHeaders.push(requestOptions.apiClient);
    }
    clientHeaders.push(`${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`);
    return clientHeaders.join(" ");
}
async function getHeaders(url) {
    var _a;
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("x-goog-api-client", getClientHeaders(url.requestOptions));
    headers.append("x-goog-api-key", url.apiKey);
    let customHeaders = (_a = url.requestOptions) === null || _a === void 0 ? void 0 : _a.customHeaders;
    if (customHeaders) {
        if (!(customHeaders instanceof Headers)) {
            try {
                customHeaders = new Headers(customHeaders);
            }
            catch (e) {
                throw new GoogleGenerativeAIRequestInputError(`unable to convert customHeaders value ${JSON.stringify(customHeaders)} to Headers: ${e.message}`);
            }
        }
        for (const [headerName, headerValue] of customHeaders.entries()) {
            if (headerName === "x-goog-api-key") {
                throw new GoogleGenerativeAIRequestInputError(`Cannot set reserved header name ${headerName}`);
            }
            else if (headerName === "x-goog-api-client") {
                throw new GoogleGenerativeAIRequestInputError(`Header name ${headerName} can only be set using the apiClient field`);
            }
            headers.append(headerName, headerValue);
        }
    }
    return headers;
}
async function constructModelRequest(model, task, apiKey, stream, body, requestOptions) {
    const url = new RequestUrl(model, task, apiKey, stream, requestOptions);
    return {
        url: url.toString(),
        fetchOptions: Object.assign(Object.assign({}, buildFetchOptions(requestOptions)), { method: "POST", headers: await getHeaders(url), body }),
    };
}
async function makeModelRequest(model, task, apiKey, stream, body, requestOptions = {}, 
// Allows this to be stubbed for tests
fetchFn = fetch) {
    const { url, fetchOptions } = await constructModelRequest(model, task, apiKey, stream, body, requestOptions);
    return makeRequest(url, fetchOptions, fetchFn);
}
async function makeRequest(url, fetchOptions, fetchFn = fetch) {
    let response;
    try {
        response = await fetchFn(url, fetchOptions);
    }
    catch (e) {
        handleResponseError(e, url);
    }
    if (!response.ok) {
        await handleResponseNotOk(response, url);
    }
    return response;
}
function handleResponseError(e, url) {
    let err = e;
    if (err.name === "AbortError") {
        err = new GoogleGenerativeAIAbortError(`Request aborted when fetching ${url.toString()}: ${e.message}`);
        err.stack = e.stack;
    }
    else if (!(e instanceof GoogleGenerativeAIFetchError ||
        e instanceof GoogleGenerativeAIRequestInputError)) {
        err = new GoogleGenerativeAIError(`Error fetching from ${url.toString()}: ${e.message}`);
        err.stack = e.stack;
    }
    throw err;
}
async function handleResponseNotOk(response, url) {
    let message = "";
    let errorDetails;
    try {
        const json = await response.json();
        message = json.error.message;
        if (json.error.details) {
            message += ` ${JSON.stringify(json.error.details)}`;
            errorDetails = json.error.details;
        }
    }
    catch (e) {
        // ignored
    }
    throw new GoogleGenerativeAIFetchError(`Error fetching from ${url.toString()}: [${response.status} ${response.statusText}] ${message}`, response.status, response.statusText, errorDetails);
}
/**
 * Generates the request options to be passed to the fetch API.
 * @param requestOptions - The user-defined request options.
 * @returns The generated request options.
 */
function buildFetchOptions(requestOptions) {
    const fetchOptions = {};
    if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) !== undefined || (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
        const controller = new AbortController();
        if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
            setTimeout(() => controller.abort(), requestOptions.timeout);
        }
        if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) {
            requestOptions.signal.addEventListener("abort", () => {
                controller.abort();
            });
        }
        fetchOptions.signal = controller.signal;
    }
    return fetchOptions;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Adds convenience helper methods to a response object, including stream
 * chunks (as long as each chunk is a complete GenerateContentResponse JSON).
 */
function addHelpers(response) {
    response.text = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning text from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            return getText(response);
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Text not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return "";
    };
    /**
     * TODO: remove at next major version
     */
    response.functionCall = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning function calls from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            console.warn(`response.functionCall() is deprecated. ` +
                `Use response.functionCalls() instead.`);
            return getFunctionCalls(response)[0];
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return undefined;
    };
    response.functionCalls = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning function calls from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            return getFunctionCalls(response);
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return undefined;
    };
    return response;
}
/**
 * Returns all text found in all parts of first candidate.
 */
function getText(response) {
    var _a, _b, _c, _d;
    const textStrings = [];
    if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
        for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
            if (part.text) {
                textStrings.push(part.text);
            }
            if (part.executableCode) {
                textStrings.push("\n```" +
                    part.executableCode.language +
                    "\n" +
                    part.executableCode.code +
                    "\n```\n");
            }
            if (part.codeExecutionResult) {
                textStrings.push("\n```\n" + part.codeExecutionResult.output + "\n```\n");
            }
        }
    }
    if (textStrings.length > 0) {
        return textStrings.join("");
    }
    else {
        return "";
    }
}
/**
 * Returns functionCall of first candidate.
 */
function getFunctionCalls(response) {
    var _a, _b, _c, _d;
    const functionCalls = [];
    if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
        for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
            if (part.functionCall) {
                functionCalls.push(part.functionCall);
            }
        }
    }
    if (functionCalls.length > 0) {
        return functionCalls;
    }
    else {
        return undefined;
    }
}
const badFinishReasons = [
    exports.FinishReason.RECITATION,
    exports.FinishReason.SAFETY,
    exports.FinishReason.LANGUAGE,
];
function hadBadFinishReason(candidate) {
    return (!!candidate.finishReason &&
        badFinishReasons.includes(candidate.finishReason));
}
function formatBlockErrorMessage(response) {
    var _a, _b, _c;
    let message = "";
    if ((!response.candidates || response.candidates.length === 0) &&
        response.promptFeedback) {
        message += "Response was blocked";
        if ((_a = response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason) {
            message += ` due to ${response.promptFeedback.blockReason}`;
        }
        if ((_b = response.promptFeedback) === null || _b === void 0 ? void 0 : _b.blockReasonMessage) {
            message += `: ${response.promptFeedback.blockReasonMessage}`;
        }
    }
    else if ((_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) {
        const firstCandidate = response.candidates[0];
        if (hadBadFinishReason(firstCandidate)) {
            message += `Candidate was blocked due to ${firstCandidate.finishReason}`;
            if (firstCandidate.finishMessage) {
                message += `: ${firstCandidate.finishMessage}`;
            }
        }
    }
    return message;
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const responseLineRE = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
/**
 * Process a response.body stream from the backend and return an
 * iterator that provides one complete GenerateContentResponse at a time
 * and a promise that resolves with a single aggregated
 * GenerateContentResponse.
 *
 * @param response - Response from a fetch call
 */
function processStream(response) {
    const inputStream = response.body.pipeThrough(new TextDecoderStream("utf8", { fatal: true }));
    const responseStream = getResponseStream(inputStream);
    const [stream1, stream2] = responseStream.tee();
    return {
        stream: generateResponseSequence(stream1),
        response: getResponsePromise(stream2),
    };
}
async function getResponsePromise(stream) {
    const allResponses = [];
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            return addHelpers(aggregateResponses(allResponses));
        }
        allResponses.push(value);
    }
}
function generateResponseSequence(stream) {
    return __asyncGenerator(this, arguments, function* generateResponseSequence_1() {
        const reader = stream.getReader();
        while (true) {
            const { value, done } = yield __await(reader.read());
            if (done) {
                break;
            }
            yield yield __await(addHelpers(value));
        }
    });
}
/**
 * Reads a raw stream from the fetch response and join incomplete
 * chunks, returning a new stream that provides a single complete
 * GenerateContentResponse in each iteration.
 */
function getResponseStream(inputStream) {
    const reader = inputStream.getReader();
    const stream = new ReadableStream({
        start(controller) {
            let currentText = "";
            return pump();
            function pump() {
                return reader
                    .read()
                    .then(({ value, done }) => {
                    if (done) {
                        if (currentText.trim()) {
                            controller.error(new GoogleGenerativeAIError("Failed to parse stream"));
                            return;
                        }
                        controller.close();
                        return;
                    }
                    currentText += value;
                    let match = currentText.match(responseLineRE);
                    let parsedResponse;
                    while (match) {
                        try {
                            parsedResponse = JSON.parse(match[1]);
                        }
                        catch (e) {
                            controller.error(new GoogleGenerativeAIError(`Error parsing JSON response: "${match[1]}"`));
                            return;
                        }
                        controller.enqueue(parsedResponse);
                        currentText = currentText.substring(match[0].length);
                        match = currentText.match(responseLineRE);
                    }
                    return pump();
                })
                    .catch((e) => {
                    let err = e;
                    err.stack = e.stack;
                    if (err.name === "AbortError") {
                        err = new GoogleGenerativeAIAbortError("Request aborted when reading from the stream");
                    }
                    else {
                        err = new GoogleGenerativeAIError("Error reading from the stream");
                    }
                    throw err;
                });
            }
        },
    });
    return stream;
}
/**
 * Aggregates an array of `GenerateContentResponse`s into a single
 * GenerateContentResponse.
 */
function aggregateResponses(responses) {
    const lastResponse = responses[responses.length - 1];
    const aggregatedResponse = {
        promptFeedback: lastResponse === null || lastResponse === void 0 ? void 0 : lastResponse.promptFeedback,
    };
    for (const response of responses) {
        if (response.candidates) {
            let candidateIndex = 0;
            for (const candidate of response.candidates) {
                if (!aggregatedResponse.candidates) {
                    aggregatedResponse.candidates = [];
                }
                if (!aggregatedResponse.candidates[candidateIndex]) {
                    aggregatedResponse.candidates[candidateIndex] = {
                        index: candidateIndex,
                    };
                }
                // Keep overwriting, the last one will be final
                aggregatedResponse.candidates[candidateIndex].citationMetadata =
                    candidate.citationMetadata;
                aggregatedResponse.candidates[candidateIndex].groundingMetadata =
                    candidate.groundingMetadata;
                aggregatedResponse.candidates[candidateIndex].finishReason =
                    candidate.finishReason;
                aggregatedResponse.candidates[candidateIndex].finishMessage =
                    candidate.finishMessage;
                aggregatedResponse.candidates[candidateIndex].safetyRatings =
                    candidate.safetyRatings;
                /**
                 * Candidates should always have content and parts, but this handles
                 * possible malformed responses.
                 */
                if (candidate.content && candidate.content.parts) {
                    if (!aggregatedResponse.candidates[candidateIndex].content) {
                        aggregatedResponse.candidates[candidateIndex].content = {
                            role: candidate.content.role || "user",
                            parts: [],
                        };
                    }
                    const newPart = {};
                    for (const part of candidate.content.parts) {
                        if (part.text) {
                            newPart.text = part.text;
                        }
                        if (part.functionCall) {
                            newPart.functionCall = part.functionCall;
                        }
                        if (part.executableCode) {
                            newPart.executableCode = part.executableCode;
                        }
                        if (part.codeExecutionResult) {
                            newPart.codeExecutionResult = part.codeExecutionResult;
                        }
                        if (Object.keys(newPart).length === 0) {
                            newPart.text = "";
                        }
                        aggregatedResponse.candidates[candidateIndex].content.parts.push(newPart);
                    }
                }
            }
            candidateIndex++;
        }
        if (response.usageMetadata) {
            aggregatedResponse.usageMetadata = response.usageMetadata;
        }
    }
    return aggregatedResponse;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function generateContentStream(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.STREAM_GENERATE_CONTENT, apiKey, 
    /* stream */ true, JSON.stringify(params), requestOptions);
    return processStream(response);
}
async function generateContent(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.GENERATE_CONTENT, apiKey, 
    /* stream */ false, JSON.stringify(params), requestOptions);
    const responseJson = await response.json();
    const enhancedResponse = addHelpers(responseJson);
    return {
        response: enhancedResponse,
    };
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function formatSystemInstruction(input) {
    // null or undefined
    if (input == null) {
        return undefined;
    }
    else if (typeof input === "string") {
        return { role: "system", parts: [{ text: input }] };
    }
    else if (input.text) {
        return { role: "system", parts: [input] };
    }
    else if (input.parts) {
        if (!input.role) {
            return { role: "system", parts: input.parts };
        }
        else {
            return input;
        }
    }
}
function formatNewContent(request) {
    let newParts = [];
    if (typeof request === "string") {
        newParts = [{ text: request }];
    }
    else {
        for (const partOrString of request) {
            if (typeof partOrString === "string") {
                newParts.push({ text: partOrString });
            }
            else {
                newParts.push(partOrString);
            }
        }
    }
    return assignRoleToPartsAndValidateSendMessageRequest(newParts);
}
/**
 * When multiple Part types (i.e. FunctionResponsePart and TextPart) are
 * passed in a single Part array, we may need to assign different roles to each
 * part. Currently only FunctionResponsePart requires a role other than 'user'.
 * @private
 * @param parts Array of parts to pass to the model
 * @returns Array of content items
 */
function assignRoleToPartsAndValidateSendMessageRequest(parts) {
    const userContent = { role: "user", parts: [] };
    const functionContent = { role: "function", parts: [] };
    let hasUserContent = false;
    let hasFunctionContent = false;
    for (const part of parts) {
        if ("functionResponse" in part) {
            functionContent.parts.push(part);
            hasFunctionContent = true;
        }
        else {
            userContent.parts.push(part);
            hasUserContent = true;
        }
    }
    if (hasUserContent && hasFunctionContent) {
        throw new GoogleGenerativeAIError("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
    }
    if (!hasUserContent && !hasFunctionContent) {
        throw new GoogleGenerativeAIError("No content is provided for sending chat message.");
    }
    if (hasUserContent) {
        return userContent;
    }
    return functionContent;
}
function formatCountTokensInput(params, modelParams) {
    var _a;
    let formattedGenerateContentRequest = {
        model: modelParams === null || modelParams === void 0 ? void 0 : modelParams.model,
        generationConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.generationConfig,
        safetySettings: modelParams === null || modelParams === void 0 ? void 0 : modelParams.safetySettings,
        tools: modelParams === null || modelParams === void 0 ? void 0 : modelParams.tools,
        toolConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.toolConfig,
        systemInstruction: modelParams === null || modelParams === void 0 ? void 0 : modelParams.systemInstruction,
        cachedContent: (_a = modelParams === null || modelParams === void 0 ? void 0 : modelParams.cachedContent) === null || _a === void 0 ? void 0 : _a.name,
        contents: [],
    };
    const containsGenerateContentRequest = params.generateContentRequest != null;
    if (params.contents) {
        if (containsGenerateContentRequest) {
            throw new GoogleGenerativeAIRequestInputError("CountTokensRequest must have one of contents or generateContentRequest, not both.");
        }
        formattedGenerateContentRequest.contents = params.contents;
    }
    else if (containsGenerateContentRequest) {
        formattedGenerateContentRequest = Object.assign(Object.assign({}, formattedGenerateContentRequest), params.generateContentRequest);
    }
    else {
        // Array or string
        const content = formatNewContent(params);
        formattedGenerateContentRequest.contents = [content];
    }
    return { generateContentRequest: formattedGenerateContentRequest };
}
function formatGenerateContentInput(params) {
    let formattedRequest;
    if (params.contents) {
        formattedRequest = params;
    }
    else {
        // Array or string
        const content = formatNewContent(params);
        formattedRequest = { contents: [content] };
    }
    if (params.systemInstruction) {
        formattedRequest.systemInstruction = formatSystemInstruction(params.systemInstruction);
    }
    return formattedRequest;
}
function formatEmbedContentInput(params) {
    if (typeof params === "string" || Array.isArray(params)) {
        const content = formatNewContent(params);
        return { content };
    }
    return params;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// https://ai.google.dev/api/rest/v1beta/Content#part
const VALID_PART_FIELDS = [
    "text",
    "inlineData",
    "functionCall",
    "functionResponse",
    "executableCode",
    "codeExecutionResult",
];
const VALID_PARTS_PER_ROLE = {
    user: ["text", "inlineData"],
    function: ["functionResponse"],
    model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
    // System instructions shouldn't be in history anyway.
    system: ["text"],
};
function validateChatHistory(history) {
    let prevContent = false;
    for (const currContent of history) {
        const { role, parts } = currContent;
        if (!prevContent && role !== "user") {
            throw new GoogleGenerativeAIError(`First content should be with role 'user', got ${role}`);
        }
        if (!POSSIBLE_ROLES.includes(role)) {
            throw new GoogleGenerativeAIError(`Each item should include role field. Got ${role} but valid roles are: ${JSON.stringify(POSSIBLE_ROLES)}`);
        }
        if (!Array.isArray(parts)) {
            throw new GoogleGenerativeAIError("Content should have 'parts' property with an array of Parts");
        }
        if (parts.length === 0) {
            throw new GoogleGenerativeAIError("Each Content should have at least one part");
        }
        const countFields = {
            text: 0,
            inlineData: 0,
            functionCall: 0,
            functionResponse: 0,
            fileData: 0,
            executableCode: 0,
            codeExecutionResult: 0,
        };
        for (const part of parts) {
            for (const key of VALID_PART_FIELDS) {
                if (key in part) {
                    countFields[key] += 1;
                }
            }
        }
        const validParts = VALID_PARTS_PER_ROLE[role];
        for (const key of VALID_PART_FIELDS) {
            if (!validParts.includes(key) && countFields[key] > 0) {
                throw new GoogleGenerativeAIError(`Content with role '${role}' can't contain '${key}' part`);
            }
        }
        prevContent = true;
    }
}
/**
 * Returns true if the response is valid (could be appended to the history), flase otherwise.
 */
function isValidResponse(response) {
    var _a;
    if (response.candidates === undefined || response.candidates.length === 0) {
        return false;
    }
    const content = (_a = response.candidates[0]) === null || _a === void 0 ? void 0 : _a.content;
    if (content === undefined) {
        return false;
    }
    if (content.parts === undefined || content.parts.length === 0) {
        return false;
    }
    for (const part of content.parts) {
        if (part === undefined || Object.keys(part).length === 0) {
            return false;
        }
        if (part.text !== undefined && part.text === "") {
            return false;
        }
    }
    return true;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Do not log a message for this error.
 */
const SILENT_ERROR = "SILENT_ERROR";
/**
 * ChatSession class that enables sending chat messages and stores
 * history of sent and received messages so far.
 *
 * @public
 */
class ChatSession {
    constructor(apiKey, model, params, _requestOptions = {}) {
        this.model = model;
        this.params = params;
        this._requestOptions = _requestOptions;
        this._history = [];
        this._sendPromise = Promise.resolve();
        this._apiKey = apiKey;
        if (params === null || params === void 0 ? void 0 : params.history) {
            validateChatHistory(params.history);
            this._history = params.history;
        }
    }
    /**
     * Gets the chat history so far. Blocked prompts are not added to history.
     * Blocked candidates are not added to history, nor are the prompts that
     * generated them.
     */
    async getHistory() {
        await this._sendPromise;
        return this._history;
    }
    /**
     * Sends a chat message and receives a non-streaming
     * {@link GenerateContentResult}.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async sendMessage(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
            toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
            systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
            cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        let finalResult;
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => generateContent(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions))
            .then((result) => {
            var _a;
            if (isValidResponse(result.response)) {
                this._history.push(newContent);
                const responseContent = Object.assign({ parts: [], 
                    // Response seems to come back without a role set.
                    role: "model" }, (_a = result.response.candidates) === null || _a === void 0 ? void 0 : _a[0].content);
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(result.response);
                if (blockErrorMessage) {
                    console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
            finalResult = result;
        })
            .catch((e) => {
            // Resets _sendPromise to avoid subsequent calls failing and throw error.
            this._sendPromise = Promise.resolve();
            throw e;
        });
        await this._sendPromise;
        return finalResult;
    }
    /**
     * Sends a chat message and receives the response as a
     * {@link GenerateContentStreamResult} containing an iterable stream
     * and a response promise.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async sendMessageStream(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
            toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
            systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
            cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions);
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => streamPromise)
            // This must be handled to avoid unhandled rejection, but jump
            // to the final catch block with a label to not log this error.
            .catch((_ignored) => {
            throw new Error(SILENT_ERROR);
        })
            .then((streamResult) => streamResult.response)
            .then((response) => {
            if (isValidResponse(response)) {
                this._history.push(newContent);
                const responseContent = Object.assign({}, response.candidates[0].content);
                // Response seems to come back without a role set.
                if (!responseContent.role) {
                    responseContent.role = "model";
                }
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(response);
                if (blockErrorMessage) {
                    console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
        })
            .catch((e) => {
            // Errors in streamPromise are already catchable by the user as
            // streamPromise is returned.
            // Avoid duplicating the error message in logs.
            if (e.message !== SILENT_ERROR) {
                // Users do not have access to _sendPromise to catch errors
                // downstream from streamPromise, so they should not throw.
                console.error(e);
            }
        });
        return streamPromise;
    }
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function countTokens(apiKey, model, params, singleRequestOptions) {
    const response = await makeModelRequest(model, Task.COUNT_TOKENS, apiKey, false, JSON.stringify(params), singleRequestOptions);
    return response.json();
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function embedContent(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.EMBED_CONTENT, apiKey, false, JSON.stringify(params), requestOptions);
    return response.json();
}
async function batchEmbedContents(apiKey, model, params, requestOptions) {
    const requestsWithModel = params.requests.map((request) => {
        return Object.assign(Object.assign({}, request), { model });
    });
    const response = await makeModelRequest(model, Task.BATCH_EMBED_CONTENTS, apiKey, false, JSON.stringify({ requests: requestsWithModel }), requestOptions);
    return response.json();
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Class for generative model APIs.
 * @public
 */
class GenerativeModel {
    constructor(apiKey, modelParams, _requestOptions = {}) {
        this.apiKey = apiKey;
        this._requestOptions = _requestOptions;
        if (modelParams.model.includes("/")) {
            // Models may be named "models/model-name" or "tunedModels/model-name"
            this.model = modelParams.model;
        }
        else {
            // If path is not included, assume it's a non-tuned model.
            this.model = `models/${modelParams.model}`;
        }
        this.generationConfig = modelParams.generationConfig || {};
        this.safetySettings = modelParams.safetySettings || [];
        this.tools = modelParams.tools;
        this.toolConfig = modelParams.toolConfig;
        this.systemInstruction = formatSystemInstruction(modelParams.systemInstruction);
        this.cachedContent = modelParams.cachedContent;
    }
    /**
     * Makes a single non-streaming call to the model
     * and returns an object containing a single {@link GenerateContentResponse}.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async generateContent(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContent(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
    }
    /**
     * Makes a single streaming call to the model and returns an object
     * containing an iterable stream that iterates over all chunks in the
     * streaming response as well as a promise that returns the final
     * aggregated response.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async generateContentStream(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContentStream(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
    }
    /**
     * Gets a new {@link ChatSession} instance which can be used for
     * multi-turn chats.
     */
    startChat(startChatParams) {
        var _a;
        return new ChatSession(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, startChatParams), this._requestOptions);
    }
    /**
     * Counts the tokens in the provided request.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async countTokens(request, requestOptions = {}) {
        const formattedParams = formatCountTokensInput(request, {
            model: this.model,
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent,
        });
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return countTokens(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
    }
    /**
     * Embeds the provided content.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async embedContent(request, requestOptions = {}) {
        const formattedParams = formatEmbedContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return embedContent(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
    }
    /**
     * Embeds an array of {@link EmbedContentRequest}s.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async batchEmbedContents(batchEmbedContentRequest, requestOptions = {}) {
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest, generativeModelRequestOptions);
    }
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Top-level class for this SDK
 * @public
 */
class GoogleGenerativeAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Gets a {@link GenerativeModel} instance for the provided model name.
     */
    getGenerativeModel(modelParams, requestOptions) {
        if (!modelParams.model) {
            throw new GoogleGenerativeAIError(`Must provide a model name. ` +
                `Example: genai.getGenerativeModel({ model: 'my-model-name' })`);
        }
        return new GenerativeModel(this.apiKey, modelParams, requestOptions);
    }
    /**
     * Creates a {@link GenerativeModel} instance from provided content cache.
     */
    getGenerativeModelFromCachedContent(cachedContent, modelParams, requestOptions) {
        if (!cachedContent.name) {
            throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `name` field.");
        }
        if (!cachedContent.model) {
            throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `model` field.");
        }
        /**
         * Not checking tools and toolConfig for now as it would require a deep
         * equality comparison and isn't likely to be a common case.
         */
        const disallowedDuplicates = ["model", "systemInstruction"];
        for (const key of disallowedDuplicates) {
            if ((modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) &&
                cachedContent[key] &&
                (modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) !== cachedContent[key]) {
                if (key === "model") {
                    const modelParamsComp = modelParams.model.startsWith("models/")
                        ? modelParams.model.replace("models/", "")
                        : modelParams.model;
                    const cachedContentComp = cachedContent.model.startsWith("models/")
                        ? cachedContent.model.replace("models/", "")
                        : cachedContent.model;
                    if (modelParamsComp === cachedContentComp) {
                        continue;
                    }
                }
                throw new GoogleGenerativeAIRequestInputError(`Different value for "${key}" specified in modelParams` +
                    ` (${modelParams[key]}) and cachedContent (${cachedContent[key]})`);
            }
        }
        const modelParamsFromCache = Object.assign(Object.assign({}, modelParams), { model: cachedContent.model, tools: cachedContent.tools, toolConfig: cachedContent.toolConfig, systemInstruction: cachedContent.systemInstruction, cachedContent });
        return new GenerativeModel(this.apiKey, modelParamsFromCache, requestOptions);
    }
}

exports.ChatSession = ChatSession;
exports.GenerativeModel = GenerativeModel;
exports.GoogleGenerativeAI = GoogleGenerativeAI;
exports.GoogleGenerativeAIAbortError = GoogleGenerativeAIAbortError;
exports.GoogleGenerativeAIError = GoogleGenerativeAIError;
exports.GoogleGenerativeAIFetchError = GoogleGenerativeAIFetchError;
exports.GoogleGenerativeAIRequestInputError = GoogleGenerativeAIRequestInputError;
exports.GoogleGenerativeAIResponseError = GoogleGenerativeAIResponseError;
exports.POSSIBLE_ROLES = POSSIBLE_ROLES;
//# sourceMappingURL=index.js.map


/***/ }),
/* 4 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TeacherSlateService = void 0;
const vscode = __importStar(__webpack_require__(1));
class TeacherSlateService {
    static instance;
    ghostDecorationType;
    errorDecorationType;
    feedbackDecorationType;
    currentLesson = '';
    suggestedCode = '';
    hoverTip = '';
    active = false;
    constructor() {
        this.ghostDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(128, 128, 128, 0.4)',
                margin: '0 0 0 0',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.errorDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid red',
            borderRadius: '2px'
        });
        this.feedbackDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(128, 128, 128, 0.6)',
                fontStyle: 'italic',
                margin: '0 0 0 2em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }
    static getInstance() {
        if (!TeacherSlateService.instance) {
            TeacherSlateService.instance = new TeacherSlateService();
        }
        return TeacherSlateService.instance;
    }
    setLesson(code) {
        this.currentLesson = code;
        this.active = true;
        this.updateDecorations();
    }
    deactivate() {
        this.active = false;
        this.currentLesson = '';
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.ghostDecorationType, []);
            editor.setDecorations(this.errorDecorationType, []);
            editor.setDecorations(this.feedbackDecorationType, []);
        }
    }
    showFeedback(message) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);
        const decoration = {
            range: new vscode.Range(position.line, line.text.length, position.line, line.text.length),
            renderOptions: {
                after: {
                    contentText: ` 🧙‍♂️ Sensei: ${message}`
                }
            }
        };
        editor.setDecorations(this.feedbackDecorationType, [decoration]);
        // Auto-clear after 8 seconds
        setTimeout(() => {
            this.clearFeedback();
        }, 8000);
    }
    clearFeedback() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.feedbackDecorationType, []);
        }
    }
    updateDecorations() {
        const editor = vscode.window.activeTextEditor;
        const lessonCode = this.getLessonCode();
        if (!editor || !this.isActive() || !lessonCode) {
            return;
        }
        const document = editor.document;
        const text = document.getText();
        const lessonLines = lessonCode.split('\n');
        const docLines = text.split('\n');
        const ghostDecorations = [];
        const errorDecorations = [];
        lessonLines.forEach((lessonLine, i) => {
            const docLine = docLines[i] || '';
            // 1. Find the match length (correct prefix)
            let matchLength = 0;
            const maxMatch = Math.min(docLine.length, lessonLine.length);
            for (let j = 0; j < maxMatch; j++) {
                if (docLine[j].toLowerCase() === lessonLine[j].toLowerCase()) {
                    matchLength++;
                }
                else {
                    break;
                }
            }
            // 2. HighLight Errors: from the first mismatch to the end of user's line
            if (matchLength < docLine.length) {
                errorDecorations.push({
                    range: new vscode.Range(i, matchLength, i, docLine.length),
                    hoverMessage: `Expected: "${lessonLine.substring(matchLength, Math.min(matchLength + 5, lessonLine.length))}..."`
                });
            }
            else if (docLine.length > lessonLine.length) {
                errorDecorations.push({
                    range: new vscode.Range(i, lessonLine.length, i, docLine.length),
                    hoverMessage: "Extra characters detected!"
                });
            }
            // 3. Ghost text is now handled by GhostTextProvider (InlineCompletionItemProvider)
        });
        editor.setDecorations(this.errorDecorationType, errorDecorations);
    }
    getLessonCode() {
        // AI suggestions take priority for ghost text rendering
        return this.suggestedCode || this.currentLesson;
    }
    setSuggestedCode(code) {
        this.suggestedCode = code;
        this.updateDecorations();
    }
    clearSuggestedCode() {
        this.suggestedCode = '';
        this.updateDecorations();
    }
    getSuggestedCode() {
        return this.suggestedCode;
    }
    setHoverTip(tip) {
        this.hoverTip = tip;
    }
    getHoverTip() {
        return this.hoverTip;
    }
    isActive() {
        return this.active || this.suggestedCode.length > 0;
    }
}
exports.TeacherSlateService = TeacherSlateService;


/***/ }),
/* 5 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VisualizerProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const parserService_1 = __webpack_require__(6);
class VisualizerProvider {
    _extensionUri;
    static viewType = 'vertex.visualizer';
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        this.update();
        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document === vscode.window.activeTextEditor?.document) {
                this.update();
            }
        });
        vscode.window.onDidChangeActiveTextEditor(() => this.update());
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (e.textEditor === vscode.window.activeTextEditor) {
                this.syncHighlight(e.selections[0].active.line);
            }
        });
    }
    syncHighlight(line) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'highlight', line });
        }
    }
    update() {
        if (!this._view) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._view.webview.html = ' <div style="padding: 20px; color: #888;">Open a file to see visual intelligence...</div>';
            return;
        }
        const code = editor.document.getText();
        const lang = editor.document.languageId;
        const relationships = parserService_1.ParserService.parse(code, lang);
        this._view.webview.html = this.getHtmlContent(code, relationships, lang);
    }
    getHtmlContent(code, relationships, lang) {
        const lines = code.split('\n');
        // Map relationships to lines for easier span injection
        const nodeMap = new Map();
        relationships.forEach(rel => {
            if (!nodeMap.has(rel.start.line))
                nodeMap.set(rel.start.line, new Set());
            if (!nodeMap.has(rel.end.line))
                nodeMap.set(rel.end.line, new Set());
            nodeMap.get(rel.start.line).add({ ...rel.start, id: `start-${rel.id}` });
            nodeMap.get(rel.end.line).add({ ...rel.end, id: `def-${rel.id}` });
        });
        const codeLinesHtml = lines.map((line, i) => {
            const nodes = nodeMap.get(i);
            let html = '';
            if (nodes && nodes.size > 0) {
                // Sort nodes by startCol ascending
                const sortedNodes = Array.from(nodes).sort((a, b) => a.startCol - b.startCol);
                let cursor = 0;
                for (const node of sortedNodes) {
                    const start = Math.max(node.startCol, cursor);
                    const end = Math.min(node.endCol, line.length);
                    if (start > cursor) {
                        html += this.escapeHtml(line.substring(cursor, start));
                    }
                    if (start < end) {
                        html += `<span class="node" id="${this.escapeHtml(node.id)}">${this.escapeHtml(line.substring(start, end))}</span>`;
                    }
                    cursor = end;
                }
                // Remaining text after last node
                if (cursor < line.length) {
                    html += this.escapeHtml(line.substring(cursor));
                }
            }
            else {
                html = this.escapeHtml(line) || ' ';
            }
            return `
                <div class="line" id="line-${i}">
                    <span class="ln">${i + 1}</span>
                    <pre>${html || ' '}</pre>
                </div>
            `;
        }).join('');
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Consolas', monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; }
                    #wrapper { position: relative; padding: 10px 10px 10px 0; line-height: 20px; }
                    .line { display: flex; white-space: pre; height: 20px; }
                    .ln { width: 38px; color: #6e6e6e; text-align: right; padding-right: 10px; flex-shrink: 0; }
                    pre { margin: 0; font-family: inherit; overflow: visible; display: inline; }
                    .node { color: #4fc1ff; font-weight: bold; border-bottom: 1px dashed rgba(79,193,255,0.5); }
                    .ln-highlight { background: rgba(38,79,120,0.4); }
                    #arrow-svg { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
                    #debug { background: #252526; color: #9cdcfe; font-family: monospace; font-size: 11px; padding: 8px; margin: 8px; border: 1px solid #333; border-radius: 4px; white-space: pre-wrap; }
                    @keyframes pulse { 0%,100%{opacity:.4;stroke-width:1.5} 50%{opacity:.9;stroke-width:2} }
                    .arrow-path { animation: pulse 2s ease-in-out infinite; fill: none; stroke: #4fc1ff; }
                </style>
            </head>
            <body>
                <div id="wrapper">
                    <svg id="arrow-svg" width="0" height="0"></svg>
                    ${codeLinesHtml}
                </div>
                <div id="debug">Loading...</div>
                <script>
                    const relationships = ${JSON.stringify(relationships)};
                    const svg = document.getElementById('arrow-svg');
                    const dbg = document.getElementById('debug');
                    let attempts = 0;

                    function drawArrows() {
                        attempts++;
                        svg.innerHTML = '';
                        const wrapper = document.getElementById('wrapper');
                        const wRect = wrapper.getBoundingClientRect();
                        svg.setAttribute('width', wRect.width);
                        svg.setAttribute('height', wRect.height);

                        let found = 0, missing = 0;
                        let log = 'Attempt #' + attempts + '\\n';
                        log += 'Relationships: ' + relationships.length + '\\n';
                        log += 'Wrapper rect: ' + Math.round(wRect.width) + 'x' + Math.round(wRect.height) + '\\n\\n';

                        relationships.forEach(rel => {
                            const startEl = document.getElementById('start-' + rel.id);
                            const endEl   = document.getElementById('def-'   + rel.id);

                            if (!startEl || !endEl) {
                                missing++;
                                log += '[MISS] ' + rel.id + ' start=' + !!startEl + ' end=' + !!endEl + '\\n';
                                return;
                            }

                            found++;
                            const sRect = startEl.getBoundingClientRect();
                            const eRect = endEl.getBoundingClientRect();

                            const sx = sRect.left - wRect.left + sRect.width / 2;
                            const sy = sRect.top  - wRect.top  + sRect.height / 2;
                            const ex = eRect.left - wRect.left + eRect.width  / 2;
                            const ey = eRect.top  - wRect.top  + eRect.height / 2;

                            log += '[OK] ' + rel.id + ' s=(' + Math.round(sx)+','+Math.round(sy) + ') e=(' + Math.round(ex)+','+Math.round(ey) + ')\\n';

                            if (sx === 0 && sy === 0 && ex === 0 && ey === 0) {
                                log += '  !! All zeros - layout not ready yet\\n';
                                return;
                            }

                            const curve = Math.min(Math.abs(sy - ey) * 0.45, 80);
                            const d = `;
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

        // removed by dead control flow
{}
        // removed by dead control flow

    }
    escapeHtml(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
exports.VisualizerProvider = VisualizerProvider;


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ParserService = void 0;
class ParserService {
    // Keywords that should never be treated as variables
    static EXCLUDE = {
        javascript: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'function', 'const', 'let', 'var', 'class', 'return', 'console', 'require', 'import', 'export', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'void']),
        typescript: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'function', 'const', 'let', 'var', 'class', 'return', 'console', 'require', 'import', 'export', 'new', 'this', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'void', 'interface', 'type', 'enum', 'namespace', 'abstract', 'implements', 'extends', 'readonly', 'public', 'private', 'protected', 'static', 'async', 'await', 'number', 'string', 'boolean', 'any', 'never', 'unknown', 'infer', 'keyof', 'typeof', 'declare']),
        python: new Set(['if', 'else', 'elif', 'for', 'while', 'class', 'return', 'print', 'range', 'def', 'import', 'from', 'with', 'as', 'try', 'except', 'pass', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'break', 'continue', 'del', 'raise']),
        java: new Set(['if', 'else', 'for', 'while', 'switch', 'catch', 'new', 'return', 'class', 'throw', 'System', 'public', 'private', 'static', 'void', 'int', 'long', 'double', 'boolean', 'String', 'true', 'false', 'null']),
        c: new Set(['if', 'else', 'for', 'while', 'switch', 'return', 'printf', 'scanf', 'include', 'define', 'int', 'float', 'char', 'void', 'unsigned', 'long', 'short', 'struct', 'typedef', 'NULL']),
        cpp: new Set(['if', 'else', 'for', 'while', 'switch', 'return', 'cout', 'cin', 'endl', 'class', 'public', 'private', 'protected', 'std', 'vector', 'string', 'int', 'float', 'double', 'bool', 'void', 'true', 'false', 'nullptr', 'new', 'delete', 'this']),
        go: new Set(['if', 'else', 'for', 'range', 'switch', 'case', 'default', 'return', 'func', 'var', 'const', 'type', 'struct', 'interface', 'package', 'import', 'go', 'defer', 'select', 'chan', 'map', 'make', 'new', 'nil', 'true', 'false', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover', 'print', 'println', 'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'float32', 'float64', 'string', 'bool', 'byte', 'rune', 'error']),
        html: new Set(['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'input', 'button', 'script', 'style', 'link', 'meta', 'title', 'h1', 'h2', 'h3', 'section', 'main', 'nav', 'footer', 'header', 'class', 'id', 'href', 'src', 'type', 'value', 'name']),
        css: new Set(['px', 'em', 'rem', 'vw', 'vh', 'auto', 'none', 'block', 'flex', 'grid', 'absolute', 'relative', 'fixed', 'sticky', 'hidden', 'visible', 'solid', 'dashed', 'dotted', 'bold', 'normal', 'italic', 'center', 'left', 'right', 'top', 'bottom', 'inherit', 'initial', 'unset']),
        json: new Set([]),
    };
    static parse(code, languageId) {
        const lines = code.split('\n');
        const definitions = new Map();
        const calls = [];
        const lang = this.normalizeLanguageId(languageId);
        const excludeSet = this.EXCLUDE[lang] || this.EXCLUDE.javascript;
        const addDef = (name, line, lineText, searchFrom = 0) => {
            if (!name || excludeSet.has(name) || definitions.has(name))
                return;
            const startCol = lineText.indexOf(name, searchFrom);
            if (startCol === -1)
                return;
            definitions.set(name, { name, line, startCol, endCol: startCol + name.length });
        };
        lines.forEach((line, lineNum) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') ||
                trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
                return;
            }
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
            }
            else if (lang === 'javascript' || lang === 'typescript') {
                // Function declaration: function foo(a, b) or const foo = (a, b) => or const foo = async (a, b) =>
                const fnDeclMatch = trimmed.match(/(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?(?:function\s*)?\()\s*([^)]*)\)/);
                if (fnDeclMatch) {
                    const fnName = fnDeclMatch[1] || fnDeclMatch[2];
                    if (fnName)
                        addDef(fnName, lineNum, line);
                    const parenIdx = line.indexOf('(');
                    const paramsStr = fnDeclMatch[3] || '';
                    let searchFrom = parenIdx + 1;
                    paramsStr.split(',').forEach(rawP => {
                        const p = rawP.trim().split('=')[0].trim().split(':')[0].trim().replace(/^\.\.\./, '');
                        if (p) {
                            const col = line.indexOf(p, searchFrom);
                            if (col !== -1 && !excludeSet.has(p)) {
                                definitions.set(p, { name: p, line: lineNum, startCol: col, endCol: col + p.length });
                                searchFrom = col + p.length;
                            }
                        }
                    });
                }
                // TS: interface/type/enum/class declaration
                const tsTypeMatch = trimmed.match(/^(?:export\s+)?(?:interface|type|enum|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (tsTypeMatch)
                    addDef(tsTypeMatch[1], lineNum, line);
                // Variable declaration: const x = ..., let y, var z
                const varMatch = trimmed.match(/^(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (varMatch)
                    addDef(varMatch[1], lineNum, line);
                // For loop: for (let i = 0...) or for (const x of arr)
                const forMatch = trimmed.match(/^for\s*\(\s*(?:let|const|var)?\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (forMatch)
                    addDef(forMatch[1], lineNum, line);
            }
            else if (lang === 'go') {
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
                            if (col !== -1) {
                                definitions.set(name, { name, line: lineNum, startCol: col, endCol: col + name.length });
                                searchFrom = col + name.length;
                            }
                        }
                    });
                }
                // var/const declaration: var x int = ...
                const goVarDeclMatch = trimmed.match(/^(?:var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (goVarDeclMatch)
                    addDef(goVarDeclMatch[1], lineNum, line);
            }
            else if (lang === 'html') {
                // Track id="..." and class="..." attribute values as definitions
                const idMatch = line.match(/id="([a-zA-Z_][a-zA-Z0-9_-]*)"/g);
                if (idMatch)
                    idMatch.forEach(m => { const v = m.match(/id="([^"]+)"/); if (v)
                        addDef(v[1], lineNum, line); });
            }
            else if (lang === 'css') {
                // Track CSS custom properties (variables): --my-color: ...
                const cssVarMatch = trimmed.match(/^(--[a-zA-Z][a-zA-Z0-9-]*)\s*:/);
                if (cssVarMatch)
                    addDef(cssVarMatch[1], lineNum, line);
                // Track class/id selector names: .foo or #bar at start
                const selectorMatch = trimmed.match(/^[.#]([a-zA-Z_][a-zA-Z0-9_-]*)/);
                if (selectorMatch)
                    addDef(selectorMatch[1], lineNum, line);
            }
            else if (lang === 'json') {
                // Track top-level JSON keys as definitions: "keyName":
                const jsonKeyMatch = trimmed.match(/^"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/);
                if (jsonKeyMatch)
                    addDef(jsonKeyMatch[1], lineNum, line);
            }
            else if (['java', 'c', 'cpp'].includes(lang)) {
                // Method/function signature: void foo(int a, String b)
                const fnParamMatch = trimmed.match(/\(([^)]+)\)\s*(?:\{|throws)/);
                if (fnParamMatch) {
                    const paramStr = fnParamMatch[1];
                    paramStr.split(',').forEach(param => {
                        const parts = param.trim().split(/\s+/);
                        const pName = parts[parts.length - 1]?.replace(/[*&[\]]/g, '').trim();
                        if (pName)
                            addDef(pName, lineNum, line);
                    });
                }
                // Variable declaration: int x = ...; or String name;
                const varDeclMatch = trimmed.match(/^(?:[a-zA-Z_*&][\w<>[\]*&\s]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|;|,)/);
                if (varDeclMatch)
                    addDef(varDeclMatch[1], lineNum, line);
            }
            // ── USAGES: find all identifiers on this line that are defined ABOVE this line ──
            // Capture the definition snapshot at the time of usage detection
            const usageRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
            let usageMatch;
            while ((usageMatch = usageRegex.exec(line)) !== null) {
                const word = usageMatch[1];
                if (!excludeSet.has(word) && definitions.has(word)) {
                    const def = definitions.get(word);
                    if (def.line < lineNum) {
                        // Capture definition snapshot at this exact moment (before any future re-registration)
                        calls.push({
                            name: word,
                            line: lineNum,
                            startCol: usageMatch.index,
                            endCol: usageMatch.index + word.length,
                            defSnapshot: { ...def } // snapshot so future overwrites don't affect this
                        });
                    }
                }
            }
        });
        // Build final relationships using the snapshotted definitions
        const relationships = [];
        const seen = new Set();
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
    static normalizeLanguageId(id) {
        if (id === 'javascriptreact') {
            return 'javascript';
        }
        if (id === 'typescriptreact') {
            return 'typescript';
        }
        // All supported languages — return as-is
        const supported = ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'html', 'css', 'json'];
        return supported.includes(id) ? id : 'javascript'; // default to JS rules for unknown langs
    }
}
exports.ParserService = ParserService;


/***/ }),
/* 7 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GhostTextProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const teacherSlate_1 = __webpack_require__(4);
class GhostTextProvider {
    async provideInlineCompletionItems(document, position, context, token) {
        const slateService = teacherSlate_1.TeacherSlateService.getInstance();
        if (!slateService.isActive()) {
            return [];
        }
        const fullCode = slateService.getLessonCode();
        if (!fullCode) {
            return [];
        }
        // Get the entire document text and the full lesson/suggestion text
        const docText = document.getText();
        // Find where the cursor is in the absolute string
        const cursorOffset = document.offsetAt(position);
        // We want to show the remainder of the fullCode starting from where the user is
        // However, we need to handle if the user is typing "ahead" or in the middle.
        // For Vertex, we assume the user is typing sequentially from the start.
        const ghostText = fullCode.substring(cursorOffset);
        if (ghostText) {
            const item = new vscode.InlineCompletionItem(ghostText);
            // The range is just where the ghost text starts (the cursor)
            item.range = new vscode.Range(position, position);
            // filterText is the "secret sauce" to keep it persistent.
            // We set it to the ALREADY typed text + the ghost text.
            // This makes VS Code think the current line is a perfect prefix match.
            const currentLine = document.lineAt(position.line).text;
            item.filterText = currentLine.substring(0, position.character) + ghostText;
            return [item];
        }
        return [];
    }
}
exports.GhostTextProvider = GhostTextProvider;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map