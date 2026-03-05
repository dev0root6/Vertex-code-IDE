import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class AIService {
    private static instance: AIService;
    private genAI: GoogleGenerativeAI | undefined;
    private context: vscode.ExtensionContext | undefined;
    private senseiModel: any;
    private codeGenModel: any;
    private static readonly MAX_RETRIES = 2;
    private static readonly TIMEOUT_MS = 30000; // 30 seconds

    // Fail-switch: if true, all services use the same model (Dev override)
    // private readonly SYNC_MODE: boolean = true; 

    private constructor() { }

    private static async fetchWithRetry(
        url: string,
        options: RequestInit,
        retries = 0
    ): Promise<Response> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error: any) {
            if (retries < this.MAX_RETRIES) {
                console.log(`[DevX] Retry ${retries + 1}/${this.MAX_RETRIES} for ${url}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
                return this.fetchWithRetry(url, options, retries + 1);
            }

            if (error.name === 'AbortError' || error.message?.includes('fetch failed') || error.cause?.name === 'ConnectTimeoutError') {
                throw new Error('Network connection timeout. Check your internet connection and try again.');
            }
            throw error;
        }
    }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    public async initialize(context: vscode.ExtensionContext): Promise<boolean> {
        this.context = context;
        await this.syncModels();
        return true;
    }

    /**
     * Re-initializes models based on current configuration.
     */
    public async syncModels(): Promise<void> {
        const config = vscode.workspace.getConfiguration('devx');
        const senseiProvider = config.get<string>('senseiProvider') || 'Gemini';
        const codeGenProvider = config.get<string>('codeGenProvider') || 'Gemini';

        // Initialize Gemini if needed by either service
        if (senseiProvider === 'Gemini' || codeGenProvider === 'Gemini') {
            await this.initGemini();
        }
    }

    private async initGemini(): Promise<void> {
        if (!this.context) return;
        const apiKey = await this.context.secrets.get('GEMINI_API_KEY');
        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                const config = vscode.workspace.getConfiguration('devx');

                const senseiModelName = config.get<string>('senseiModel') || 'gemini-2.0-flash';
                this.senseiModel = this.genAI.getGenerativeModel({ model: senseiModelName }, { apiVersion: 'v1beta' });

                const codeGenModelName = config.get<string>('codeGenModel') || 'gemini-2.0-flash';
                this.codeGenModel = this.genAI.getGenerativeModel({ model: codeGenModelName }, { apiVersion: 'v1beta' });
            } catch (error) {
                console.error('[DevX] Gemini Init Error:', error);
            }
        }
    }

    public async ensureApiKey(context: vscode.ExtensionContext, provider: string): Promise<string | undefined> {
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
    public async listModels(provider: string): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('devx');
        try {
            if (provider === 'Gemini') {
                // Hardcoded defaults for now as Gemini listModels API is often restricted
                return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash-latest'];
            }

            if (provider === 'Local Model (Ollama)') {
                const endpoint = config.get('ollamaEndpoint') || 'http://localhost:11434';
                const res = await fetch(`${endpoint}/api/tags`);
                const data: any = await res.json();
                return data.models.map((m: any) => m.name);
            }

            if (provider === 'Ollama Cloud') {
                // Use default endpoint for Ollama Cloud (assuming standard API)
                const res = await AIService.fetchWithRetry('https://api.ollama.com/api/tags', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data: any = await res.json();
                return data.models.map((m: any) => m.name);
            }

            if (provider === 'OpenRouter') {
                const res = await AIService.fetchWithRetry('https://openrouter.ai/api/v1/models', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data: any = await res.json();
                return data.data.map((m: any) => m.id);
            }
        } catch (error) {
            console.error(`[DevX] Error listing models for ${provider}:`, error);
        }
        return [];
    }

    private async callAI(prompt: string, service: 'sensei' | 'codegen'): Promise<string> {
        const config = vscode.workspace.getConfiguration('devx');

        // Developer Fail-switch (manual edit required)
        // if (this.SYNC_MODE) { service = 'codegen'; } 

        const providerKey = service === 'sensei' ? 'senseiProvider' : 'codeGenProvider';
        const modelKey = service === 'sensei' ? 'senseiModel' : 'codeGenModel';

        const provider = config.get<string>(providerKey) || 'Gemini';
        
        // Use ollamaModel for Ollama providers, otherwise use the service-specific model
        let modelName = config.get<string>(modelKey);
        if (provider === 'Local Model (Ollama)' || provider === 'Ollama Cloud') {
            modelName = config.get<string>('ollamaModel') || modelName;
        }

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
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};

            if (!modelName) {
                throw new Error(`No model selected for ${service} (${provider})`);
            }

            if (provider === 'Local Model (Ollama)') {
                url = `${config.get('ollamaEndpoint') || 'http://localhost:11434'}/api/generate`;
                body = { model: modelName, prompt, stream: false };
            } else if (provider === 'Ollama Cloud') {
                const key = await this.context?.secrets.get('OLLAMA_CLOUD_API_KEY');
                url = 'https://api.ollama.com/api/generate';
                headers['Authorization'] = `Bearer ${key}`;
                body = { model: modelName, prompt, stream: false };
            } else if (provider === 'OpenRouter') {
                const key = await this.context?.secrets.get('OPENROUTER_API_KEY');
                url = 'https://openrouter.ai/api/v1/chat/completions';
                headers['Authorization'] = `Bearer ${key}`;
                body = {
                    model: modelName,
                    messages: [{ role: 'user', content: prompt }]
                };
            } else {
                throw new Error(`Unknown provider: ${provider}`);
            }

            const res = await AIService.fetchWithRetry(url, {
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
                console.error(`[DevX] ${provider} API Error (${res.status}):`, errText);
                throw new Error(`${provider} returned ${res.status}: ${errText.substring(0, 150)}`);
            }

            const data: any = await res.json();
            console.log(`[DevX] ${provider} response received:`, JSON.stringify(data).substring(0, 200));

            if (provider === 'OpenRouter') {
                if (!data.choices || data.choices.length === 0) {
                    console.error('[DevX] OpenRouter returned empty choices:', data);
                    throw new Error('OpenRouter API returned no response. The model may be unavailable or overloaded.');
                }
                return data.choices[0].message.content.trim();
            }
            
            if (!data.response) {
                console.error(`[DevX] ${provider} returned no response:`, data);
                throw new Error(`${provider} returned empty response`);
            }
            return data.response.trim();

        } catch (error) {
            console.error(`[DevX] AI Call Error (${provider}):`, error);
            
            // User-friendly error messages
            const errorMsg = (error as Error).message;
            
            // Try to fallback to Gemini if it's not already being used
            if (provider !== 'Gemini' && this.genAI) {
                console.log(`[DevX] Attempting fallback to Gemini for ${service}...`);
                try {
                    const model = service === 'sensei' ? this.senseiModel : this.codeGenModel;
                    if (model) {
                        const result = await model.generateContent(prompt);
                        const response = await result.response;
                        vscode.window.showInformationMessage(
                            `⚠️ ${provider} unavailable. Using Gemini as fallback.`,
                            'Change Provider'
                        ).then(choice => {
                            if (choice === 'Change Provider') {
                                vscode.commands.executeCommand('devx.changeProvider');
                            }
                        });
                        return response.text().trim();
                    }
                } catch (fallbackError) {
                    console.error('[DevX] Gemini fallback also failed:', fallbackError);
                }
            }
            
            // Show appropriate error message
            if (errorMsg.includes('Network connection timeout') || errorMsg.includes('fetch failed')) {
                const choice = await vscode.window.showErrorMessage(
                    `🌐 Cannot reach ${provider} API. This could be due to:
• Network/firewall blocking the API
• ${provider} service is down
• Invalid API key

Try switching to Gemini or Local Ollama.`,
                    { modal: true },
                    'Switch to Gemini',
                    'Change Provider',
                    'Retry'
                );
                
                if (choice === 'Switch to Gemini') {
                    const config = vscode.workspace.getConfiguration('devx');
                    const key = service === 'sensei' ? 'senseiProvider' : 'codeGenProvider';
                    config.update(key, 'Gemini', vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('✅ Switched to Gemini. Try your request again.');
                } else if (choice === 'Change Provider') {
                    vscode.commands.executeCommand('devx.changeProvider');
                }
            } else if (errorMsg.includes('returned no response') || errorMsg.includes('empty choices')) {
                const choice = await vscode.window.showErrorMessage(
                    `⚡ ${provider} Model Unavailable\n\nThe model is overloaded or returned no response.\n\nRecommended: Switch to Gemini (most reliable) or try a different model.`,
                    { modal: true },
                    'Switch to Gemini',
                    'Try Different Model',
                    'Retry'
                );
                
                if (choice === 'Switch to Gemini') {
                    const config = vscode.workspace.getConfiguration('devx');
                    const key = service === 'sensei' ? 'senseiProvider' : 'codeGenProvider';
                    config.update(key, 'Gemini', vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('✅ Switched to Gemini. Try your request again.');
                } else if (choice === 'Try Different Model') {
                    vscode.commands.executeCommand('devx.selectModel');
                }
            } else if (errorMsg.includes('API Limit') || errorMsg.includes('429')) {
                const choice = await vscode.window.showErrorMessage(
                    `⚡ ${provider} API Limit Exhausted\n\nYou've made too many requests or exhausted your quota.`,
                    { modal: true },
                    'Switch to Gemini',
                    'Try Different Model',
                    'View Alternatives'
                );
                
                if (choice === 'Switch to Gemini') {
                    const config = vscode.workspace.getConfiguration('devx');
                    const key = service === 'sensei' ? 'senseiProvider' : 'codeGenProvider';
                    await config.update(key, 'Gemini', vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Switched to Gemini. Please try again.');
                } else if (choice === 'Try Different Model') {
                    await vscode.commands.executeCommand('devx.selectModel');
                } else if (choice === 'View Alternatives') {
                    vscode.window.showInformationMessage(
                        '💡 Alternative AI Providers:\n\n' +
                        '✅ Gemini (Free: 1500 req/day)\n' +
                        '✅ Local Ollama (Unlimited, offline)\n' +
                        '✅ OpenRouter (Pay-as-you-go)\n\n' +
                        'Use "DevX: Change Provider" to switch.',
                        { modal: true }
                    );
                }
            } else {
                vscode.window.showErrorMessage(
                    `❌ ${provider} Error: ${errorMsg.substring(0, 120)}`,
                    'Change Provider'
                ).then(choice => {
                    if (choice === 'Change Provider') {
                        vscode.commands.executeCommand('devx.changeProvider');
                    }
                });
            }
            
            throw error;
        }
    }

    public async getMotivationalFeedback(studentCode: string, ghostCode: string): Promise<string> {
        try {
            const prompt = `You are "Sensei", a motivational AI mentor. Provide 10-20 encouraging words for this code: ${studentCode}`;
            return await this.callAI(prompt, 'sensei');
        } catch (error) {
            return "Persistence is the key to mastery. Keep coding!";
        }
    }

    public async generateSenseiResponse(prompt: string, context: string): Promise<string> {
        try {
            return await this.callAI(prompt, 'sensei');
        } catch (error) {
            console.error('[DevX] Sensei response error:', error);
            return "";
        }
    }

    public async generateCode(prompt: string, context: string, lang: string): Promise<string> {
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
        } catch (error) {
            return "";
        }
    }

    public async getLineInsight(lineCode: string, lang: string): Promise<string> {
        try {
            const prompt = `Provide a 20-word technical insight with a code snippet for this ${lang} line: ${lineCode}. Format as Markdown.`;
            let tip = await this.callAI(prompt, 'sensei');

            // Clean up backticks if the model wraps the whole response in them (common with Ollama)
            if (tip.startsWith('```') && tip.endsWith('```')) {
                const match = tip.match(/```[a-z]*\n([\s\S]*?)\n```/i);
                if (match) return match[1].trim();
            }
            return tip;
        } catch (error) {
            return "";
        }
    }
}
