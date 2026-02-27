import * as vscode from 'vscode';
import { AIService } from './aiService';
import { TeacherSlateService } from './teacherSlate';
import { VisualizerProvider } from './visualizerProvider';
import { GhostTextProvider } from './ghostTextProvider';

let senseiStatusBarItem: vscode.StatusBarItem;
let senseiTimeout: NodeJS.Timeout | undefined;
let idleTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vertex-vscode" is now active!');

	const aiService = AIService.getInstance();
	const slateService = TeacherSlateService.getInstance();

	// Initialize AI - if key is missing, this will prompt and wait
	aiService.initialize(context).then(success => {
		if (success) {
			senseiStatusBarItem.text = "$(person) Sensei: Ready";
		} else {
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
	let loadEnvKeys = vscode.commands.registerCommand('vertex.loadEnvKeys', async () => {
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
	let loadLesson = vscode.commands.registerCommand('vertex.loadLesson', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('Open a file first to load a lesson.');
			return;
		}

		const lang = editor.document.languageId;
		const lessons: Record<string, string> = {
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
	const visualizerProvider = new VisualizerProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VisualizerProvider.viewType, visualizerProvider)
	);

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
				'Vertex Run',
				'Vertex',
				new vscode.ShellExecution(command)
			);
			await vscode.tasks.executeTask(task);
		} else {
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
		if (!editor) { return; }

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
			} else {
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
	const onConfigChange = vscode.workspace.onDidChangeConfiguration(async event => {
		if (
			event.affectsConfiguration('vertex.senseiModel') ||
			event.affectsConfiguration('vertex.senseiProvider') ||
			event.affectsConfiguration('vertex.codeGenModel') ||
			event.affectsConfiguration('vertex.codeGenProvider') ||
			event.affectsConfiguration('vertex.ollamaModel')
		) {
			const config = vscode.workspace.getConfiguration('vertex');
			const sModel = config.get<string>('senseiModel');
			const cModel = config.get<string>('codeGenModel');

			await aiService.syncModels();
			vscode.window.showInformationMessage(`Vertex: AI Models Updated (Sensei: ${sModel}, CodeGen: ${cModel})`);
		}
	});

	// Register Providers
	const ghostProvider = vscode.languages.registerInlineCompletionItemProvider(
		{ scheme: 'file', language: '*' },
		new GhostTextProvider()
	);

	const hoverProvider = vscode.languages.registerHoverProvider(
		{ scheme: 'file', language: '*' },
		{
			async provideHover(document, position) {
				const line = document.lineAt(position.line);
				const tip = await aiService.getLineInsight(line.text, document.languageId);
				if (!tip) return null;

				const markdown = new vscode.MarkdownString();
				markdown.isTrusted = true;
				markdown.supportHtml = true;
				markdown.appendMarkdown(`### 🧙‍♂️ Sensei Insight\n---\n${tip}\n\n*Hover to learn!*`);

				const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
				return new vscode.Hover(markdown, range);
			}
		}
	);

	context.subscriptions.push(resetGeminiKey, resetOpenRouterKey, resetOllamaKey, resetAllKeys, loadLesson, clearLesson, showVisualizer, toggleVisualizer, selectModel, changeProvider, runCode, askSensei, onType, onFocus, onConfigChange, ghostProvider, hoverProvider);
}

function triggerSensei(editor: vscode.TextEditor, currentSuggestion: string, aiService: AIService) {
	const slateService = TeacherSlateService.getInstance();

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

export function deactivate() {
	TeacherSlateService.getInstance().deactivate();
}
