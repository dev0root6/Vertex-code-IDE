import * as vscode from 'vscode';
import { AIService } from './aiService';
import { TeacherSlateService } from './teacherSlate';
import { VisualizerProvider } from './visualizerProvider';
import { GhostTextProvider } from './ghostTextProvider';
import { SenseiMessagesProvider } from './learning/senseiMessagesPanel';
import { BlockCodeProvider } from './blockCodeProvider';
import { LearningProfileService } from './learning/learningProfile';
import { ActivityMonitor } from './learning/activityMonitor';
import { GuidanceService } from './learning/guidanceService';
import { LevelAdapter } from './learning/levelAdapter';
import { SenseiChatPanel } from './learning/senseiChatPanel';

let senseiStatusBarItem: vscode.StatusBarItem;
let senseiTimeout: NodeJS.Timeout | undefined;
let idleTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "devx-vscode" is now active!');

	const aiService = AIService.getInstance();
	const slateService = TeacherSlateService.getInstance();
	const profileService = LearningProfileService.getInstance();
	const activityMonitor = ActivityMonitor.getInstance();
	const guidanceService = GuidanceService.getInstance();
	const levelAdapter = LevelAdapter.getInstance();

	// Create status bar item EARLY
	senseiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	senseiStatusBarItem.text = "$(person) Sensei: Initializing...";
	senseiStatusBarItem.show();
	context.subscriptions.push(senseiStatusBarItem);

	// Initialize learning profile with setup wizard (async)
	profileService.initialize(context).then(async success => {
		if (success) {
			const profile = profileService.getProfile();
			senseiStatusBarItem.text = `$(mortar-board) Level: ${profile.level.charAt(0).toUpperCase() + profile.level.slice(1)}`;
			
			// Set level context key for keybindings
			vscode.commands.executeCommand('setContext', 'devx.level', profile.level);
			
			// Initialize AI service
			await aiService.initialize(context);
			
			// Start activity monitoring (5 second idle threshold)
			activityMonitor.start();
			
			// Setup activity callbacks based on level
			setupActivityCallbacks(profile.level, aiService, senseiMessagesProvider);
			
			senseiStatusBarItem.text = `$(person) Sensei: Ready (${profile.level})`;
		} else {
			senseiStatusBarItem.text = "$(warning) Sensei: Setup Incomplete";
		}
	});

	// Initialize Sensei Messages Panel (WebviewViewProvider - only for intermediate level when asking)
	const senseiMessagesProvider = new SenseiMessagesProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SenseiMessagesProvider.viewType,
			senseiMessagesProvider
		)
	);

	// Initialize Block Code Visualizer (real-time code to blocks)
	const blockCodeProvider = new BlockCodeProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			BlockCodeProvider.viewType,
			blockCodeProvider
		)
	);

	// Initialize AI - if key is missing, this will prompt and wait
	// (Moved to after profile setup in async block above)

	// Create status bar item
	// (Moved to top for early initialization)

	// ── API Key Reset Commands (visible in Ctrl+Shift+P) ──
	let resetGeminiKey = vscode.commands.registerCommand('devx.resetGeminiKey', async () => {
		await context.secrets.delete('GEMINI_API_KEY');
		vscode.window.showInformationMessage('✅ Gemini API Key has been reset. Re-enter it on next use.');
		await aiService.initialize(context);
	});

	let resetOpenRouterKey = vscode.commands.registerCommand('devx.resetOpenRouterKey', async () => {
		await context.secrets.delete('OPENROUTER_API_KEY');
		vscode.window.showInformationMessage('✅ OpenRouter API Key has been reset. Re-enter it on next use.');
	});

	let resetOllamaKey = vscode.commands.registerCommand('devx.resetOllamaKey', async () => {
		await context.secrets.delete('OLLAMA_CLOUD_API_KEY');
		vscode.window.showInformationMessage('✅ Ollama Cloud API Key has been reset. Re-enter it on next use.');
	});

	let resetAllKeys = vscode.commands.registerCommand('devx.resetAllKeys', async () => {
		const confirm = await vscode.window.showWarningMessage(
			'Reset ALL API keys (Gemini, OpenRouter, Ollama Cloud)?',
			{ modal: true },
			'Yes, Reset All'
		);
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
	context.subscriptions.push(resetAllKeys);

	// Load API keys from .env file (Development helper)
	let loadEnvKeys = vscode.commands.registerCommand('devx.loadEnvKeys', async () => {
		const fs = require('fs');
		const path = require('path');
		const envPath = path.join(__dirname, '..', '.vscode', '.env');
		
		try {
			const envContent = fs.readFileSync(envPath, 'utf8');
			const lines = envContent.split('\n');
			
			// Get the 3rd GEMINI_API_KEY
			const geminiKeys = lines
				.filter((line: string) => line.trim().startsWith('GEMINI_API_KEY='))
				.map((line: string) => line.split('=')[1].trim());
			
			if (geminiKeys.length >= 3) {
				await context.secrets.store('GEMINI_API_KEY', geminiKeys[2]);
				vscode.window.showInformationMessage(`✅ Loaded 3rd Gemini key: ${geminiKeys[2].substring(0, 15)}...`);
			}
			
			// Load OpenRouter key
			const openRouterLine = lines.find((line: string) => line.trim().startsWith('OPENROUTER='));
			if (openRouterLine) {
				const key = openRouterLine.split('=')[1].trim();
				await context.secrets.store('OPENROUTER_API_KEY', key);
				vscode.window.showInformationMessage(`✅ Loaded OpenRouter key`);
			}
			
			// Load Ollama key
			const ollamaLine = lines.find((line: string) => line.trim().startsWith('OLLAMA_API_KEY='));
			if (ollamaLine) {
				const key = ollamaLine.split('=')[1].trim();
				await context.secrets.store('OLLAMA_CLOUD_API_KEY', key);
				vscode.window.showInformationMessage(`✅ Loaded Ollama key`);
			}
			
			await aiService.syncModels();
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to load .env file: ${error}`);
		}
	});
	context.subscriptions.push(loadEnvKeys);

	// Command to load a sample lesson
	let loadLesson = vscode.commands.registerCommand('devx.loadLesson', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('Open a file first to load a lesson.');
			return;
		}

		const lang = editor.document.languageId;
		const lessons: Record<string, string> = {
			python: 'print("Hello, DevX!")\nfor i in range(5):\n    print(f"Counting {i}")',
			javascript: 'function helloWorld() {\n  console.log("Hello, DevX!");\n}\nhelloWorld();',
			typescript: 'function helloWorld() {\n  console.log("Hello, DevX!");\n}\nhelloWorld();',
			cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, DevX!" << std::endl;\n    return 0;\n}',
			c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, DevX!\\n");\n    return 0;\n}',
			java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DevX!");\n    }\n}'
		};

		const sampleCode = lessons[lang] || lessons.javascript;
		slateService.setLesson(sampleCode);
		vscode.window.showInformationMessage(`Loaded ${lang} lesson! Follow the ghost text.`);
		senseiStatusBarItem.text = "$(person) Sensei: Lesson Active";
	});

	// Command to clear lesson
	let clearLesson = vscode.commands.registerCommand('devx.clearLesson', () => {
		slateService.deactivate();
		vscode.window.showInformationMessage('Lesson cleared.');
		senseiStatusBarItem.text = "$(person) Sensei: Ready";
	});

	// Register Sidebar Visualizer
	const visualizerProvider = new VisualizerProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VisualizerProvider.viewType, visualizerProvider)
	);

	// Command to toggle VisualizingIntelligence sidebar
	let toggleVisualizer = vscode.commands.registerCommand('devx.toggleVisualizer', () => {
		vscode.commands.executeCommand('devx.visualizer.focus');
	});

	// Command to show visualizer (Deprecated older version, redirect to sidebar)
	let showVisualizer = vscode.commands.registerCommand('devx.showVisualizer', () => {
		vscode.commands.executeCommand('devx.visualizer.focus');
	});

	// Command to run current code using Task API
	let runCode = vscode.commands.registerCommand('devx.runCode', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }

		const document = editor.document;
		const lang = document.languageId;
		const filePath = document.uri.fsPath;

		let command = '';
		if (lang === 'python') {
			command = `python3 "${filePath}"`;
		} else if (lang === 'javascript' || lang === 'typescript') {
			command = `node "${filePath}"`;
		} else if (lang === 'c') {
			command = `gcc "${filePath}" -o "${filePath}.out" && "${filePath}.out"`;
		} else if (lang === 'cpp') {
			command = `g++ "${filePath}" -o "${filePath}.out" && "${filePath}.out"`;
		} else if (lang === 'java') {
			command = `java "${filePath}"`;
		}

		if (command) {
			const task = new vscode.Task(
				{ type: 'shell' },
				vscode.TaskScope.Workspace,
				'DevX Run',
				'Vertex',
				new vscode.ShellExecution(command)
			);
			await vscode.tasks.executeTask(task);
		} else {
			vscode.window.showErrorMessage(`Running code for "${lang}" is not yet supported in Vertex.`);
		}
	});

	// Command to quickly select Code Generation Provider & Model (Ctrl+J)
	let selectModel = vscode.commands.registerCommand('devx.selectModel', async () => {
		const providers = ['Local Model (Ollama)', 'Ollama Cloud', 'OpenRouter', 'Gemini'];
		const provider = await vscode.window.showQuickPick(providers, {
			placeHolder: 'Select an AI provider for Code Generation',
			title: 'DevX: Code Gen Provider Selection'
		});

		if (provider) {
			const config = vscode.workspace.getConfiguration('devx');
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
					title: 'DevX: Code Gen Model Selection'
				});
				if (model) {
					await config.update('codeGenModel', model, vscode.ConfigurationTarget.Global);

					// --- PLAN B: DEVELOPER SYNC (CODE GEN -> SENSEI) ---
					/* 
					await config.update('senseiProvider', provider, vscode.ConfigurationTarget.Global);
					await config.update('senseiModel', model, vscode.ConfigurationTarget.Global);
					*/

					vscode.window.showInformationMessage(`DevX: Code Gen updated to ${provider} (${model})`);
				}
			}
		}
	});

	// Command to quickly select Sensei Provider & Model (Ctrl+H)
	let changeProvider = vscode.commands.registerCommand('devx.changeProvider', async () => {
		const providers = ['Local Model (Ollama)', 'Ollama Cloud', 'OpenRouter', 'Gemini'];
		const provider = await vscode.window.showQuickPick(providers, {
			placeHolder: 'Select an AI provider for Sensei',
			title: 'Sensei: Provider Selection'
		});

		if (provider) {
			const config = vscode.workspace.getConfiguration('devx');
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

	// Command to ask Sensei (Ctrl+I) - opens chatbox in Sensei panel
	let askSensei = vscode.commands.registerCommand('devx.askSensei', async () => {
		const profile = profileService.getProfile();
		
		// Pro users don't get Sensei
		if (profile.level === 'pro') {
			vscode.window.showInformationMessage('Sensei is not available in Pro mode. You got this! 💪');
			return;
		}
		
		// For beginner + intermediate: focus the chatbox in Sensei panel
		await vscode.commands.executeCommand('devx.senseiMessages.focus');
		senseiMessagesProvider.focusChatInput();
	});

	// Listen for text changes
	let onType = vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (editor && event.document === editor.document) {
			// Record keystroke for activity monitoring
			const line = editor.selection.active.line;
			activityMonitor.recordKeystroke('', line);
			
			// Reset stuck help escalation when user starts typing
			senseiMessagesProvider.resetHelpAttempts();
			
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

			// Trigger Sensei feedback (debounced) - respects user level
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
	const onConfigChange = vscode.workspace.onDidChangeConfiguration(async event => {
		if (
			event.affectsConfiguration('devx.senseiModel') ||
			event.affectsConfiguration('devx.senseiProvider') ||
			event.affectsConfiguration('devx.codeGenModel') ||
			event.affectsConfiguration('devx.codeGenProvider') ||
			event.affectsConfiguration('devx.ollamaModel')
		) {
			const config = vscode.workspace.getConfiguration('devx');
			const sModel = config.get<string>('senseiModel');
			const cModel = config.get<string>('codeGenModel');

			await aiService.syncModels();
			vscode.window.showInformationMessage(`DevX: AI Models Updated (Sensei: ${sModel}, CodeGen: ${cModel})`);
		}
	});

	// Register Providers
	const ghostProvider = vscode.languages.registerInlineCompletionItemProvider(
		{ scheme: 'file', language: '*' },
		new GhostTextProvider()
	);

	// Hover provider: context-aware line explanations tied to Sensei's conversation
	let hoverTimeout: NodeJS.Timeout | undefined;
	let hoverCache: Map<string, {tip: string, time: number}> = new Map();

	const hoverProvider = vscode.languages.registerHoverProvider(
		{ scheme: 'file', language: '*' },
		{
			async provideHover(document, position) {
				// Only for beginner + intermediate
				const profile = profileService.getProfile();
				if (profile.level === 'pro') return null;

				const line = document.lineAt(position.line);
				const lineText = line.text.trim();
				if (!lineText || lineText.length < 3) return null;

				// Cache key: file + line number + first 50 chars
				const cacheKey = `${document.fileName}:${position.line}:${lineText.substring(0, 50)}`;
				const cached = hoverCache.get(cacheKey);
				if (cached && Date.now() - cached.time < 30000) {
					const md = new vscode.MarkdownString();
					md.isTrusted = true;
					md.supportHtml = true;
					md.appendMarkdown(`### 🧙‍♂️ Sensei Insight\n---\n${cached.tip}`);
					return new vscode.Hover(md, line.range);
				}

				// Build context-aware prompt
				const fileName = document.fileName.split('/').pop() || '';
				const fullCode = document.getText().substring(0, 1500);
				const goal = senseiMessagesProvider.getProjectGoal();
				const convo = senseiMessagesProvider.getConversationSummary();

				const prompt = `You are Sensei. A student is hovering over line ${position.line + 1} in ${fileName} (${document.languageId}):
"${lineText}"

Full code:
${fullCode}

${goal ? 'Project goal: ' + goal : ''}
${convo ? 'Recent conversation: ' + convo : ''}

Explain this line in 1-2 sentences:
1. WHAT it does
2. WHY it exists in this code / how it fits the overall goal
Keep it concise and beginner-friendly. No code snippets.`;

				try {
					const tip = await aiService.generateSenseiResponse(prompt, fullCode);
					if (!tip) return null;

					hoverCache.set(cacheKey, { tip, time: Date.now() });
					// Keep cache small
					if (hoverCache.size > 50) {
						const firstKey = hoverCache.keys().next().value;
						if (firstKey) hoverCache.delete(firstKey);
					}

					const md = new vscode.MarkdownString();
					md.isTrusted = true;
					md.supportHtml = true;
					md.appendMarkdown(`### 🧙‍♂️ Sensei Insight\n---\n${tip}`);
					return new vscode.Hover(md, line.range);
				} catch {
					return null;
				}
			}
		}
	);

	context.subscriptions.push(resetGeminiKey, resetOpenRouterKey, resetOllamaKey, resetAllKeys, loadLesson, clearLesson, showVisualizer, toggleVisualizer, selectModel, changeProvider, runCode, askSensei, onType, onFocus, onConfigChange, ghostProvider, hoverProvider);

	// ── ORPHAN COMMANDS (previously declared in package.json but not registered) ──
	
	// Change learning level manually
	let changeLevel = vscode.commands.registerCommand('devx.changeLevel', async () => {
		const levels = ['🌱 Beginner', '🌿 Intermediate', '🌳 Pro'];
		const choice = await vscode.window.showQuickPick(levels, {
			placeHolder: 'Change your learning level',
			title: 'DevX: Change Level'
		});
		
		if (choice) {
			let level: 'beginner' | 'intermediate' | 'pro' = 'beginner';
			if (choice.includes('Intermediate')) level = 'intermediate';
			if (choice.includes('Pro')) level = 'pro';
			
			profileService.setLevel(level);
			senseiStatusBarItem.text = `$(person) Sensei: Switched to ${level}`;
			vscode.window.showInformationMessage(`Level changed to ${level.charAt(0).toUpperCase() + level.slice(1)}`);
			
			// Update level context key for keybindings
			vscode.commands.executeCommand('setContext', 'devx.level', level);
			
			// Clear ghost text when leaving beginner
			if (level !== 'beginner') {
				slateService.clearSuggestedCode();
				vscode.commands.executeCommand('editor.action.inlineSuggest.hide');
			}

			// Restart activity monitoring with new level
			activityMonitor.reset();
			setupActivityCallbacks(level, aiService, senseiMessagesProvider);
		}
	});

	// Reset learning profile
	let resetProfile = vscode.commands.registerCommand('devx.resetProfile', async () => {
		const confirm = await vscode.window.showWarningMessage(
			'Reset your learning profile? This will erase all progress and stats.',
			{ modal: true },
			'Reset'
		);
		
		if (confirm === 'Reset') {
			profileService.resetProfile();
			activityMonitor.reset();
			vscode.window.showInformationMessage('Profile reset. Restart VS Code to run setup wizard again.');
		}
	});

	// View learning statistics
	let viewStats = vscode.commands.registerCommand('devx.viewStats', () => {
		const profile = profileService.getProfile();
		const stats = `
📊 Learning Statistics

Level: ${profile.level.charAt(0).toUpperCase() + profile.level.slice(1)}
Performance Score: ${profile.performanceScore}/100
Typing Speed: ${Math.round(profile.typingSpeed)} WPM
Accuracy: ${(100 - profile.errorRate).toFixed(1)}%
Blocks Completed: ${profile.sessionStats.blocksCompleted}
Hints Used: ${profile.sessionStats.hintsUsed}
Times Stuck: ${profile.stuckEvents}
Session Time: ${Math.round(profile.totalSessionTime)} minutes
		`.trim();
		
		vscode.window.showInformationMessage(stats, { modal: true });
	});

	// Request learning guidance
	let requestGuidance = vscode.commands.registerCommand('devx.requestGuidance', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }
		
		const profile = profileService.getProfile();
		const userQuestion = await vscode.window.showInputBox({
			prompt: 'What do you need help with?',
			placeHolder: 'e.g., How do I loop through a list?'
		});
		
		if (userQuestion) {
			const context = editor.document.getText();
			const lang = editor.document.languageId;
			
			senseiStatusBarItem.text = "$(sync~spin) Sensei: Thinking...";
			const guidance = await guidanceService.provideCodeGuidance(userQuestion, context, lang);
			
			if (guidance) {
				if (profile.level === 'intermediate') {
					// Show hints in messages panel
					await senseiMessagesProvider.addMessage(`💡 Guidance: ${guidance}`);
				} else {
					// Show full code for beginners
					slateService.setSuggestedCode(guidance);
					vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
				}
				senseiStatusBarItem.text = "$(person) Sensei: Guidance provided!";
			}
		}
	});

	// Open chat with Sensei (full panel)
	let openChat = vscode.commands.registerCommand('devx.openChat', () => {
		const profile = profileService.getProfile();
		
		if (profile.level === 'pro') {
			vscode.window.showInformationMessage('Sensei chat is not available in Pro mode.');
			return;
		}
		
		SenseiChatPanel.createOrShow(context.extensionUri);
	});

	// Disabled actions (learning mode - Tab/Copy/Paste interceptors)
	// Uses a context key so keybindings are entirely bypassed when unlocked
	let _devUnlocked = false;
	vscode.commands.executeCommand('setContext', 'devx.locked', true);

	let disabledAction = vscode.commands.registerCommand('devx.disabledAction', (action: string) => {
		// Learning mode: block everything except ghost text accept on Tab for beginners
		if (action === 'tab') {
			const currentProfile = profileService.getProfile();
			if (currentProfile.level === 'beginner') {
				vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
			}
			// intermediate/pro: Tab is silently blocked (no inline accept)
		}
		// copy/paste/cut → silently blocked
	});

	// Secret dev toggle — Ctrl+Alt+G
	let toggleTab = vscode.commands.registerCommand('devx.toggleTab', () => {
		_devUnlocked = !_devUnlocked;
		// When unlocked: set context key so keybindings don't intercept tab/copy/paste
		// When locked: keybindings intercept and block
		vscode.commands.executeCommand('setContext', 'devx.locked', !_devUnlocked);
		if (_devUnlocked) {
			vscode.window.setStatusBarMessage('🔓', 3000);
		} else {
			vscode.window.setStatusBarMessage('🔒', 3000);
		}
	});

	context.subscriptions.push(
		changeLevel, resetProfile, viewStats, requestGuidance, 
		openChat, disabledAction, toggleTab
	);
}

// Setup activity monitoring callbacks based on user level
function setupActivityCallbacks(level: 'beginner' | 'intermediate' | 'pro', aiService: AIService, senseiMessagesProvider: SenseiMessagesProvider) {
	const activityMonitor = ActivityMonitor.getInstance();
	const guidanceService = GuidanceService.getInstance();
	const profileService = LearningProfileService.getInstance();
	const slateService = TeacherSlateService.getInstance();
	
	// Clear old callbacks
	activityMonitor.reset();

	// Toggle inline suggestions: ONLY beginners get ghost text.
	// This disables ALL inline suggestion providers (ours + any other extension)
	// so intermediate/pro never see ghost code in the editor.
	const enableGhostText = level === 'beginner';
	vscode.workspace.getConfiguration('editor').update('inlineSuggest.enabled', enableGhostText, vscode.ConfigurationTarget.Workspace);
	
	// Pro users: no Sensei interruptions
	if (level === 'pro') {
		return;
	}
	
	// Beginner ONLY: Sensei appears when idle (5 seconds) - ONCE per pause
	// Intermediate users use the stuck callback instead (no double notifications)
	if (level === 'beginner') {
		activityMonitor.onIdle(async (idleTime) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;
			
			senseiStatusBarItem.text = "$(lightbulb) Sensei: Noticed you paused...";
			
			const currentCode = editor.document.getText();
			const lang = editor.document.languageId;
			
			const suggestion = await guidanceService.suggestNextStep(currentCode, lang, level);
			slateService.showFeedback(suggestion);
			
			setTimeout(() => {
				senseiStatusBarItem.text = `$(person) Sensei: Ready (${level})`;
			}, 5000);
		});
	}
	
	// Intermediate users: Sensei helps when stuck (30+ seconds on same line)
	// Escalation: 1st click → hint only, 2nd click → ghost code
	if (level === 'intermediate') {
		activityMonitor.onStuck(async (line, duration) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;
			
			senseiStatusBarItem.text = "$(comment-discussion) Sensei: You're doing great, need a push?";
			
			vscode.window.showInformationMessage("🧙‍♂️ You're making progress! Want a hint to keep the momentum going?", 'Get Help').then(async (choice) => {
				if (choice === 'Get Help') {
					senseiStatusBarItem.text = "$(sync~spin) Sensei: Analyzing your code...";
					
					// provideStuckHelp() with escalation:
					// 1st call → hint in panel, 2nd call → code as commented text in panel
					await senseiMessagesProvider.provideStuckHelp();
					vscode.commands.executeCommand('devx.senseiMessages.focus');
					senseiStatusBarItem.text = "$(person) Sensei: Check the Sensei panel!";
				}
			});
		});
	}
}

function triggerSensei(editor: vscode.TextEditor, currentSuggestion: string, aiService: AIService) {
	const slateService = TeacherSlateService.getInstance();
	const profileService = LearningProfileService.getInstance();
	const profile = profileService.getProfile();

	// Pro and intermediate users don't get auto-triggered Sensei insights
	if (profile.level !== 'beginner') {
		return;
	}

	clearSenseiTimers();
	
	// Only show "Thinking..." for beginners (intermediate relies on 5s idle callback)
	if (profile.level === 'beginner') {
		senseiStatusBarItem.text = "$(sync~spin) Sensei: Thinking...";
	}

	// 1. Idle Insight & Auto-Suggestion Timer (1s) - ONLY FOR BEGINNERS
	if (profile.level === 'beginner') {
		idleTimeout = setTimeout(async () => {
			const document = editor.document;
			const lineIndex = editor.selection.active.line;
			const lineText = document.lineAt(lineIndex).text;

			if (lineText.trim()) {
				// Insight (WHY-focused)
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
	}

	// 2. Inline Motivational Feedback Timer (3s) - ONLY FOR BEGINNERS
	if (profile.level === 'beginner') {
		senseiTimeout = setTimeout(async () => {
			// Don't show feedback if there's an active ghost text suggestion
			if (slateService.getSuggestedCode().length > 0) {
				senseiStatusBarItem.text = `$(person) Sensei: Ready (${profile.level})`;
				return;
			}

			const document = editor.document;
			const feedback = await aiService.getMotivationalFeedback(document.getText(), "");

			if (senseiStatusBarItem.text.includes("Thinking") || senseiStatusBarItem.text.includes("Insight ready")) {
				slateService.showFeedback(feedback);
				senseiStatusBarItem.text = "$(person) Sensei: Inspired";
				setTimeout(() => {
					senseiStatusBarItem.text = `$(person) Sensei: Ready (${profile.level})`;
				}, 5000);
			}
		}, 3000);
	}
	
	// Intermediate users rely on ActivityMonitor's 5-second idle callback
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

export function deactivate() {
	TeacherSlateService.getInstance().deactivate();
	ActivityMonitor.getInstance().stop();
}
