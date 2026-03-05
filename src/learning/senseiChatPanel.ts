import * as vscode from 'vscode';
import { AIService } from '../aiService';
import { LearningProfileService } from './learningProfile';

export class SenseiChatPanel {
    public static currentPanel: SenseiChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private aiService: AIService;
    private profileService: LearningProfileService;
    private chatHistory: Array<{role: string, content: string}> = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.Two;

        if (SenseiChatPanel.currentPanel) {
            SenseiChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'senseiChat',
            '💬 Chat with Sensei',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        SenseiChatPanel.currentPanel = new SenseiChatPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this.aiService = AIService.getInstance();
        this.profileService = LearningProfileService.getInstance();

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        await this.handleUserMessage(message.text);
                        break;
                    case 'clearChat':
                        this.chatHistory = [];
                        this._update();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async handleUserMessage(userMessage: string) {
        // Add user message to history
        this.chatHistory.push({ role: 'user', content: userMessage });
        this._update();

        try {
            // Get context from active editor
            const editor = vscode.window.activeTextEditor;
            const context = editor ? editor.document.getText() : '';
            const language = editor ? editor.document.languageId : 'text';
            const profile = this.profileService.getProfile();

            // Build conversational prompt with history
            let conversationContext = this.chatHistory.slice(-5).map(msg => 
                `${msg.role === 'user' ? 'Student' : 'Sensei'}: ${msg.content}`
            ).join('\n');

            const prompt = `You are Sensei, a friendly and supportive coding mentor. You're chatting with a ${profile.level}-level student.

Conversation history:
${conversationContext}

Current code context (${language}):
${context.substring(0, 1000)}

Respond to their latest message naturally and helpfully. Be encouraging, conversational, and provide actionable advice. Keep responses to 2-4 sentences unless explaining something complex.`;

            const response = await this.aiService.generateSenseiResponse(prompt, context);

            // Add Sensei response to history
            this.chatHistory.push({ role: 'sensei', content: response });
            this._update();

        } catch (error) {
            this.chatHistory.push({ 
                role: 'sensei', 
                content: 'Sorry, I encountered an error. Please check your AI provider configuration.' 
            });
            this._update();
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const messages = this.chatHistory.map(msg => {
            const isUser = msg.role === 'user';
            const avatar = isUser ? '👤' : '🧙‍♂️';
            const className = isUser ? 'user-message' : 'sensei-message';
            const alignClass = isUser ? 'message-right' : 'message-left';
            
            return `
                <div class="message ${alignClass}">
                    <div class="message-bubble ${className}">
                        <div class="message-header">
                            <span class="avatar">${avatar}</span>
                            <span class="name">${isUser ? 'You' : 'Sensei'}</span>
                        </div>
                        <div class="message-content">${this.escapeHtml(msg.content)}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat with Sensei</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 0;
            margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .message {
            display: flex;
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message-left {
            justify-content: flex-start;
        }
        
        .message-right {
            justify-content: flex-end;
        }
        
        .message-bubble {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 12px;
            word-wrap: break-word;
        }
        
        .user-message {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .sensei-message {
            background: rgba(100, 200, 255, 0.15);
            border: 1px solid rgba(100, 200, 255, 0.3);
        }
        
        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            opacity: 0.9;
        }
        
        .avatar {
            font-size: 20px;
        }
        
        .name {
            font-weight: 600;
        }
        
        .message-content {
            line-height: 1.5;
            white-space: pre-wrap;
        }
        
        .input-container {
            padding: 16px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 8px;
        }
        
        #messageInput {
            flex: 1;
            padding: 10px 14px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            font-family: inherit;
            font-size: 14px;
            outline: none;
        }
        
        #messageInput:focus {
            border-color: var(--vscode-focusBorder);
        }
        
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        .clear-button {
            background: transparent;
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-button-border);
        }
        
        .clear-button:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.7;
        }
        
        .empty-state h2 {
            margin: 0 0 12px 0;
            font-size: 24px;
        }
        
        .empty-state p {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="chat-container" id="chatContainer">
        ${messages || `
            <div class="empty-state">
                <h2>🧙‍♂️ Sensei Chat</h2>
                <p>Ask me anything about coding!<br>I'm here to help you learn and grow.</p>
            </div>
        `}
    </div>
    
    <div class="input-container">
        <input 
            type="text" 
            id="messageInput" 
            placeholder="Ask Sensei anything..."
            autocomplete="off"
        />
        <button onclick="sendMessage()">Send</button>
        <button class="clear-button" onclick="clearChat()">Clear</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('messageInput');
        const container = document.getElementById('chatContainer');
        
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        function sendMessage() {
            const text = input.value.trim();
            if (!text) return;
            
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
            
            input.value = '';
            input.focus();
        }
        
        function clearChat() {
            if (confirm('Clear all chat history?')) {
                vscode.postMessage({
                    command: 'clearChat'
                });
            }
        }
        
        // Auto-focus input
        input.focus();
    </script>
</body>
</html>`;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    public dispose() {
        SenseiChatPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
