import * as vscode from 'vscode';
import { AIService } from '../aiService';
import { LearningProfileService } from './learningProfile';
import { TeacherSlateService } from '../teacherSlate';

export class SenseiMessagesProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devx.senseiMessages';
    private _view?: vscode.WebviewView;
    private messages: Array<{text: string, timestamp: number, role: 'user' | 'sensei' | 'system'}> = [];
    private aiService: AIService;
    private profileService: LearningProfileService;
    private helpAttempts: number = 0;

    // ── Context tracking ──
    private _projectGoal: string = '';           // What the user is trying to build
    private _lastGeneratedCode: string = '';     // Last code Sensei generated
    private _lastActiveFile: string = '';        // Last file path Sensei analyzed
    private _conversationSummary: string = '';   // Rolling summary of conversation

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.aiService = AIService.getInstance();
        this.profileService = LearningProfileService.getInstance();
    }

    /** Get the current project goal (used by hover provider) */
    public getProjectGoal(): string { return this._projectGoal; }
    /** Get conversation summary (used by hover provider) */
    public getConversationSummary(): string { return this._conversationSummary; }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'clear':
                    this.messages = [];
                    this.helpAttempts = 0;
                    this._projectGoal = '';
                    this._lastGeneratedCode = '';
                    this._conversationSummary = '';
                    this._updateView();
                    break;
                case 'chat':
                    await this._handleChatMessage(data.text);
                    break;
            }
        });
    }

    // ── Intent detection helpers ──
    private _isQuestion(msg: string): boolean {
        const l = msg.toLowerCase();
        return /\b(explain|why|what|how|when|where|who|which|does|do|is|are|was|were|can|could|should|would|tell|describe|mean|understand)/.test(l)
            || l.endsWith('?')
            || /\b(this line|this code|the code|my code|that code|u generated|you generated|it work|it mean|it do|what does)/.test(l);
    }

    private _isNextStepRequest(msg: string): boolean {
        const l = msg.toLowerCase();
        return /\b(what next|next step|what should i|what do i|now what|continue|go on|proceed|what comes next|help me continue)/.test(l);
    }

    private _isCodeRequest(msg: string): boolean {
        // If it's clearly a question or next-step request, it's NOT a code request
        if (this._isQuestion(msg) || this._isNextStepRequest(msg)) return false;
        // Otherwise it's a code request (e.g. "add 2 numbers", "sort a list", "fibonacci")
        return true;
    }

    private _stripComments(code: string): string {
        let c = code.replace(/```[\w]*/g, '').replace(/```/g, '').trim();
        c = c.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');
        c = c.replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '');
        c = c.replace(/\/\*[\s\S]*?\*\//g, '');
        c = c.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
        return c.replace(/\n{3,}/g, '\n\n').trim();
    }

    private async _handleChatMessage(userMessage: string) {
        if (!userMessage.trim()) return;

        const profile = this.profileService.getProfile();
        this.messages.push({ text: userMessage, timestamp: Date.now(), role: 'user' });
        this._updateView();

        // ── 1. Scan the CURRENTLY OPEN file ──
        const editor = vscode.window.activeTextEditor;
        const codeContext = editor ? editor.document.getText() : '';
        const language = editor ? editor.document.languageId : 'text';
        const cursorLine = editor ? editor.selection.active.line + 1 : 0;
        const fileName = editor ? editor.document.fileName.split('/').pop() || '' : '';
        this._lastActiveFile = fileName;

        // Clear ghost text for intermediate — they don't get code suggestions
        if (profile.level === 'intermediate') {
            const slateService = TeacherSlateService.getInstance();
            slateService.setSuggestedCode('');
        }

        // ── 2. Build conversation memory ──
        const recentHistory = this.messages.slice(-10).map(m =>
            `${m.role === 'user' ? 'Student' : m.role === 'sensei' ? 'Sensei' : 'System'}: ${m.text}`
        ).join('\n');

        const contextBlock = `
FILE: ${fileName} (${language}, line ${cursorLine})
PROJECT GOAL: ${this._projectGoal || 'Not set yet'}
LAST GENERATED CODE: ${this._lastGeneratedCode ? this._lastGeneratedCode.substring(0, 500) : 'None'}
CODE IN EDITOR:
${codeContext.substring(0, 2000)}

CONVERSATION:
${recentHistory}`;

        // ── 3. Detect intent ──
        const isQuestion = this._isQuestion(userMessage);
        const isNextStep = this._isNextStepRequest(userMessage);
        const isCodeReq = this._isCodeRequest(userMessage);

        // ── 4. "What are you building?" guard ──
        if (isNextStep && !this._projectGoal && codeContext.trim().length < 10) {
            this.messages.push({
                text: '🧙‍♂️ I\'d love to help! But first — **what are you trying to build?** Tell me the goal (e.g. "a calculator", "a todo list", "add two numbers") and I\'ll guide you step by step.',
                timestamp: Date.now(), role: 'sensei'
            });
            this._updateView();
            return;
        }

        // ── 5. Extract project goal from code requests ──
        if (isCodeReq && !this._projectGoal) {
            this._projectGoal = userMessage;
        }

        // If user has code but no goal, infer it
        if (!this._projectGoal && codeContext.trim().length > 30) {
            this._projectGoal = `(inferred from ${fileName})`;
        }

        this.messages.push({ text: '⏳ Thinking...', timestamp: Date.now(), role: 'system' });
        this._updateView();

        // ── 6. Empty file guard ──
        const fileIsEmpty = codeContext.trim().length < 5;

        try {
            let response = '';

            if (profile.level === 'beginner') {
                if (isQuestion && fileIsEmpty) {
                    // No code to explain
                    this.messages.pop();
                    this.messages.push({ text: '🧙‍♂️ There\'s no code in your editor yet! Try asking me to write something first (e.g. "write a nested loop" or "add two numbers").', timestamp: Date.now(), role: 'sensei' });

                } else if (isQuestion) {
                    // ── BEGINNER QUESTION: explain in chat, no ghost code ──
                    const prompt = `You are Sensei, a friendly coding mentor for a beginner.
${contextBlock}

The student asked: "${userMessage}"

Rules:
- Explain in simple, clear language. No code unless they explicitly ask for it.
- If they say "explain this line" or "explain this code", analyze the ACTUAL code in the editor (${fileName}), NOT old generated code.
- If they reference previous conversation, stay on topic.
- Use simple analogies. Be encouraging. 3-6 sentences.
- Do NOT give code. Just explain WHY things work the way they do.`;
                    response = await this.aiService.generateSenseiResponse(prompt, codeContext);
                    this.messages.pop();
                    this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });

                } else if (isNextStep) {
                    // ── BEGINNER NEXT STEP: scan current file, suggest what to write ──
                    const prompt = `You are Sensei. A beginner student asks: "${userMessage}"
${contextBlock}

Analyze the code currently in ${fileName}. Tell them:
1. What they've done so far (acknowledge progress)
2. What the NEXT logical step is and WHY
3. Then generate ONLY the next few lines of code (no comments, no fences).

Keep explanation to 2-3 sentences, then give the code.`;
                    response = await this.aiService.generateSenseiResponse(prompt, codeContext);

                    // Try to extract code from response and inject as ghost text
                    const codeMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/) || response.match(/\n((?:[ \t]*(?:def |class |if |for |while |import |from |print|return |\w+ ?=)[^\n]+\n?)+)/);
                    if (codeMatch && editor) {
                        const ghostCode = this._stripComments(codeMatch[1]);
                        if (ghostCode) {
                            const slateService = TeacherSlateService.getInstance();
                            slateService.setSuggestedCode(ghostCode);
                            vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
                            this._lastGeneratedCode = ghostCode;
                            const explanation = response.replace(codeMatch[0], '').trim();
                            this.messages.pop();
                            if (explanation) this.messages.push({ text: explanation, timestamp: Date.now(), role: 'sensei' });
                            this.messages.push({ text: '👻 Ghost code ready! Check your editor — press **Tab** to accept.', timestamp: Date.now(), role: 'sensei' });
                        } else {
                            this.messages.pop();
                            this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });
                        }
                    } else {
                        this.messages.pop();
                        this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });
                    }

                } else {
                    // ── BEGINNER CODE REQUEST: generate ghost code ──
                    this._projectGoal = userMessage; // Track what they're building
                    const prompt = `You are Sensei. A beginner student wants: "${userMessage}"
${contextBlock}

Generate ONLY the ${language} code. STRICT RULES:
- NO comments (no #, no //, no docstrings)
- NO markdown fences, NO explanations
- Just pure clean code`;
                    response = await this.aiService.generateSenseiResponse(prompt, codeContext);
                    const cleanCode = this._stripComments(response);

                    if (cleanCode && editor) {
                        const slateService = TeacherSlateService.getInstance();
                        slateService.setSuggestedCode(cleanCode);
                        vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
                        this._lastGeneratedCode = cleanCode;
                        this.messages.pop();
                        this.messages.push({ text: '👻 Ghost code ready! Check your editor — press **Tab** to accept.', timestamp: Date.now(), role: 'sensei' });
                    } else {
                        this.messages.pop();
                        this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });
                    }
                }

            } else {
                // ── INTERMEDIATE: comment-style hints ──
                if (isQuestion && fileIsEmpty) {
                    // No code to explain
                    this.messages.pop();
                    this.messages.push({ text: '🧙‍♂️ Your editor is empty! Ask me to help you start something (e.g. "nested loop in java" or "encapsulation in java") and I\'ll give you hints to write it yourself.', timestamp: Date.now(), role: 'sensei' });

                } else if (isQuestion) {
                    // Questions → text explanation in chat
                    const prompt = `You are Sensei, a friendly coding mentor for an intermediate student.
${contextBlock}

The student asked: "${userMessage}"

Rules:
- Analyze ONLY the ACTUAL code shown in the CODE IN EDITOR section above. If the editor is empty or has very little code, say so.
- Do NOT invent or hallucinate code that doesn't exist in the editor.
- Stay on topic with the conversation history.
- Be encouraging. 3-5 sentences. No runnable code.`;
                    response = await this.aiService.generateSenseiResponse(prompt, codeContext);
                    this.messages.pop();
                    this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });

                } else {
                    // Code requests / next step → plain step-by-step instructions in chat
                    const prompt = `You are Sensei. An intermediate student wants: "${userMessage}"
File: ${fileName} (${language})
${fileIsEmpty ? 'The file is EMPTY.' : 'Current code:\n' + codeContext.substring(0, 1500)}
${this._projectGoal ? 'Project goal: ' + this._projectGoal : ''}

Give clear step-by-step instructions for what they need to write.
Rules:
- Number each step (Step 1, Step 2, etc.)
- Explain WHAT to do and WHY, not the exact code
- Be specific to ${language} (mention class names, method names, variable types they'll need)
- 4-7 steps
- Do NOT give runnable code, just guidance
- Do NOT use code comment format (no // or #), just plain text`;
                    response = await this.aiService.generateSenseiResponse(prompt, codeContext);
                    this.messages.pop();
                    this.messages.push({ text: response, timestamp: Date.now(), role: 'sensei' });
                }
            }

            // ── Update conversation summary ──
            this._conversationSummary = `Goal: ${this._projectGoal || 'unknown'}. File: ${fileName}. Last Q: ${userMessage}. Last A: ${(response || '').substring(0, 200)}`;

        } catch (error) {
            this.messages.pop();
            this.messages.push({ text: 'Sorry, I had trouble responding. Check your AI provider settings.', timestamp: Date.now(), role: 'sensei' });
        }

        if (this.messages.length > 30) { this.messages = this.messages.slice(-30); }
        this._updateView();
    }

    public async addMessage(text: string) {
        this.messages.push({ text, timestamp: Date.now(), role: 'sensei' });
        if (this.messages.length > 20) { this.messages = this.messages.slice(-20); }
        this._updateView();
    }

    /**
     * Intermediate stuck help escalation:
     * 1st click → hint (WHY the next line is needed)
     * 2nd click → ghost code (the actual next line)
     */
    public async provideStuckHelp(): Promise<string | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return null;

        this.helpAttempts++;
        const allCode = editor.document.getText();
        const cursorLine = editor.selection.active.line;
        const lineText = editor.document.lineAt(cursorLine).text;
        const lang = editor.document.languageId;
        const fileName = editor.document.fileName.split('/').pop() || '';
        const codeUpToCursor = editor.document.getText(
            new vscode.Range(0, 0, cursorLine, lineText.length)
        );

        // Use conversation context — what the user originally asked
        const goal = this._projectGoal || '(not specified)';
        const convo = this._conversationSummary || '';

        if (this.helpAttempts <= 1) {
            const prompt = `You are Sensei. An intermediate student is stuck.
File: ${fileName} (${lang}), line ${cursorLine + 1}
Project goal: ${goal}
${convo ? 'Recent conversation: ' + convo : ''}

Code written so far:
${codeUpToCursor}

Full file:
${allCode.substring(0, 2000)}

The student's ORIGINAL goal was: "${goal}"
Give a hint related to THAT goal, not just what's currently in the file.
1. Acknowledge what they've done so far
2. Tell them what the NEXT step is toward their goal and WHY
3. Do NOT give actual code

Be encouraging. 3-4 sentences.`;

            try {
                const response = await this.aiService.generateSenseiResponse(prompt, allCode);
                await this.addMessage('🧙‍♂️ **Sensei:** ' + response);
                await this.addMessage('💡 Need more help? Click **Get Help** again for detailed guidance.');
                return null;
            } catch (err) { return null; }
        } else {
            const prompt = `You are Sensei. An intermediate student is still stuck after hints.
File: ${fileName} (${lang}), line ${cursorLine + 1}
Project goal: ${goal}
${convo ? 'Recent conversation: ' + convo : ''}

Code written so far:
${codeUpToCursor}

Full file:
${allCode.substring(0, 2000)}

The student's ORIGINAL goal was: "${goal}"
Give step-by-step instructions (not code) for what to write next.
- Be specific: mention variable names, method names, types they need
- Explain WHY each step matters for their goal
- 3-5 steps maximum
- Plain text, no code comment format`;

            try {
                const response = await this.aiService.generateSenseiResponse(prompt, allCode);
                await this.addMessage('🧙‍♂️ **Sensei:** Here\'s what to do next:');
                await this.addMessage(response);
                this.helpAttempts = 0;
                return null;
            } catch (err) { return null; }
        }
    }

    public resetHelpAttempts() { this.helpAttempts = 0; }

    public focusChatInput() {
        if (this._view) {
            this._view.show(true);
            setTimeout(() => {
                this._view?.webview.postMessage({ type: 'focusInput' });
            }, 100);
        }
    }

    public async analyzeCurrentLine() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { await this.addMessage("No active editor found."); return; }

        const currentLine = editor.selection.active.line;
        const lineText = editor.document.lineAt(currentLine).text.trim();
        if (lineText.length === 0) { await this.addMessage("You're on an empty line. Write some code first!"); return; }

        const allCode = editor.document.getText();
        const language = editor.document.languageId;
        const progressContext = editor.document.getText(
            new vscode.Range(0, 0, currentLine, editor.document.lineAt(currentLine).text.length)
        );

        try {
            const prompt = `You are Sensei. Student is on line ${currentLine + 1} of their ${language} code:
"${lineText}"

Code so far:
${progressContext}

Full file:
${allCode.substring(0, 2000)}

1. Acknowledge what they did well
2. Explain WHY the next line is needed
3. Give strategic guidance (not code)

3-5 sentences.`;

            this.messages.push({ text: '⏳ Analyzing your progress...', timestamp: Date.now(), role: 'system' });
            this._updateView();
            const response = await this.aiService.generateSenseiResponse(prompt, allCode);
            await this.addMessage('🧙‍♂️ **Sensei:** ' + response);
        } catch (error) {
            await this.addMessage("❌ Sorry, I encountered an error analyzing your code.");
        }
    }

    private _updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const profile = this.profileService.getProfile();
        const level = profile.level;
        const showChat = level === 'beginner' || level === 'intermediate';

        const messagesHtml = this.messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const bubbleClass = isUser ? 'user-bubble' : isSystem ? 'system-bubble' : 'sensei-bubble';
            const alignClass = isUser ? 'msg-right' : 'msg-left';
            const avatar = isUser ? '👤' : isSystem ? '⏳' : '🧙‍♂️';
            
            return `
                <div class="msg ${alignClass}">
                    <div class="bubble ${bubbleClass}">
                        <div class="msg-header">
                            <span class="avatar">${avatar}</span>
                            <span class="time">${time}</span>
                        </div>
                        <div class="msg-text">${this._escapeHtml(msg.text)}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sensei Chat</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-sideBar-background);
            color: var(--vscode-foreground);
            font-size: 13px; line-height: 1.5;
            display: flex; flex-direction: column;
            height: 100vh; overflow: hidden;
        }
        .header {
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        }
        .title { font-weight: 600; font-size: 13px; }
        .clear-btn {
            background: transparent; color: var(--vscode-foreground);
            border: 1px solid var(--vscode-panel-border);
            padding: 2px 8px; cursor: pointer; border-radius: 3px;
            font-size: 11px; opacity: 0.7;
        }
        .clear-btn:hover { opacity: 1; background: rgba(255,255,255,0.05); }
        .chat-area {
            flex: 1; overflow-y: auto; padding: 10px;
            display: flex; flex-direction: column; gap: 8px;
        }
        .msg { display: flex; }
        .msg-left { justify-content: flex-start; }
        .msg-right { justify-content: flex-end; }
        .bubble {
            max-width: 90%; padding: 8px 10px; border-radius: 10px;
            word-wrap: break-word; animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .sensei-bubble {
            background: rgba(100, 200, 255, 0.1);
            border: 1px solid rgba(100, 200, 255, 0.2);
        }
        .user-bubble {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .system-bubble {
            background: rgba(255,255,255,0.05);
            font-style: italic; opacity: 0.7;
        }
        .msg-header {
            display: flex; align-items: center; gap: 6px;
            margin-bottom: 4px; font-size: 11px; opacity: 0.7;
        }
        .avatar { font-size: 14px; }
        .msg-text { white-space: pre-wrap; word-wrap: break-word; }
        .empty-state {
            text-align: center; padding: 30px 15px; opacity: 0.5;
            flex: 1; display: flex; flex-direction: column;
            justify-content: center; align-items: center;
        }
        .empty-state-icon { font-size: 28px; margin-bottom: 8px; }
        .input-area {
            padding: 8px; border-top: 1px solid var(--vscode-panel-border);
            display: flex; gap: 6px; flex-shrink: 0;
        }
        #chatInput {
            flex: 1; padding: 7px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px; font-family: inherit;
            font-size: 12px; outline: none; min-width: 0;
        }
        #chatInput:focus { border-color: var(--vscode-focusBorder); }
        .send-btn {
            padding: 7px 14px; background: var(--vscode-button-background);
            color: var(--vscode-button-foreground); border: none;
            border-radius: 6px; cursor: pointer; font-size: 12px;
            font-weight: 500; flex-shrink: 0;
        }
        .send-btn:hover { background: var(--vscode-button-hoverBackground); }
        .level-badge {
            display: inline-block; padding: 1px 6px; border-radius: 3px;
            font-size: 10px; font-weight: 600;
            background: rgba(100,200,255,0.2); color: rgba(100,200,255,1);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">\ud83e\uddd9\u200d\u2642\ufe0f Sensei <span class="level-badge">${level}</span></div>
        ${this.messages.length > 0 ? '<button class="clear-btn" onclick="clearChat()">Clear</button>' : ''}
    </div>
    <div class="chat-area" id="chatArea">
        ${this.messages.length > 0 ? messagesHtml : `
            <div class="empty-state">
                <div class="empty-state-icon">\ud83d\udcac</div>
                <div>Chat with Sensei!<br>Type below or press <strong>Ctrl+I</strong></div>
            </div>
        `}
    </div>
    ${showChat ? `
    <div class="input-area">
        <input type="text" id="chatInput" placeholder="Ask Sensei anything..." autocomplete="off" />
        <button class="send-btn" onclick="sendMessage()">Send</button>
    </div>
    ` : ''}
    <script>
        const vscode = acquireVsCodeApi();
        const chatArea = document.getElementById('chatArea');
        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        const input = document.getElementById('chatInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            });
        }
        function sendMessage() {
            const inp = document.getElementById('chatInput');
            if (!inp) return;
            const text = inp.value.trim();
            if (!text) return;
            vscode.postMessage({ type: 'chat', text: text });
            inp.value = '';
            inp.focus();
        }
        function clearChat() { vscode.postMessage({ type: 'clear' }); }
        window.addEventListener('message', function(ev) {
            if (ev.data && ev.data.type === 'focusInput') {
                const inp = document.getElementById('chatInput');
                if (inp) inp.focus();
            }
        });
    </script>
</body>
</html>`;
    }

    private _escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, "<br>");
    }
}
