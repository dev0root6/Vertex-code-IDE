# 📚 Vertex Extension - Complete API Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Services](#core-services)
3. [API Reference](#api-reference)
4. [Extension Points](#extension-points)
5. [Configuration API](#configuration-api)
6. [Usage Examples](#usage-examples)

---

## Architecture Overview

Vertex is built on a modular architecture with five core services:

```
┌─────────────────────────────────────────────────┐
│                Extension.ts                      │
│         (Main Activation & Commands)             │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴──────┬──────────┬────────────┐
       │              │          │            │
   ┌───▼───┐    ┌────▼────┐ ┌───▼────┐  ┌───▼────────┐
   │ AI    │    │Teacher  │ │Visual  │  │Ghost Text  │
   │Service│    │ Slate   │ │izer    │  │Provider    │
   └───┬───┘    └────┬────┘ └───┬────┘  └────────────┘
       │             │          │
       │             │      ┌───▼──────┐
       │             │      │ Parser   │
       │             │      │ Service  │
       │             │      └──────────┘
       ▼             ▼
  [Gemini API]   [Decorations]
  [OpenRouter]   [Webview]
  [Ollama]
```

---

## Core Services

### 1. AIService (aiService.ts)

The AIService is a singleton that manages all AI provider interactions, API key storage, and model configurations.

#### Class: `AIService`

**Initialization**

```typescript
public static getInstance(): AIService
```
Returns the singleton instance of AIService.

```typescript
public async initialize(context: vscode.ExtensionContext): Promise<boolean>
```
Initializes the AI service with the VS Code extension context.
- **Parameters**: 
  - `context`: VS Code extension context for accessing secrets storage
- **Returns**: `Promise<boolean>` - true if initialization succeeds
- **Side Effects**: Loads API keys from secret storage, initializes configured AI Integration

**Provider Management**

```typescript
public async syncModels(): Promise<void>
```
Re-synchronizes AI models based on current configuration settings.
- **Side Effects**: Reinitializes Gemini client if needed
- **Use Case**: Call this after configuration changes

```typescript
public async ensureApiKey(context: vscode.ExtensionContext, provider: string): Promise<string | undefined>
```
Ensures an API key exists for the specified provider, prompting the user if needed.
- **Parameters**:
  - `context`: Extension context for secret storage
  - `provider`: Provider name (e.g., "Gemini", "OpenRouter", "Ollama Cloud")
- **Returns**: API key string or undefined if user cancels
- **Side Effects**: Stores API key in VS Code's secret storage

**Model Operations**

```typescript
public async listModels(provider: string): Promise<string[]>
```
Lists available models for a given provider.
- **Parameters**: 
  - `provider`: One of "Gemini", "Local Model (Ollama)", "Ollama Cloud", "OpenRouter"
- **Returns**: Array of model names
- **Example**:
```typescript
const models = await aiService.listModels("Gemini");
// Returns: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", ...]
```

**AI Generation**

```typescript
public async generateSenseiResponse(code: string, context: string): Promise<string>
```
Generates motivational feedback using the configured Sensei provider.
- **Parameters**:
  - `code`: Current code snippet
  - `context`: Additional context about what the user is doing
- **Returns**: Motivational message string
- **Throws**: Error if provider is not configured or API call fails

```typescript
public async generateCode(prompt: string, language: string): Promise<string>
```
Generates code based on a natural language prompt.
- **Parameters**:
  - `prompt`: Natural language description of desired code
  - `language`: Target programming language
- **Returns**: Generated code string
- **Example**:
```typescript
const code = await aiService.generateCode(
  "Create a function that sorts an array", 
  "javascript"
);
```

**Configuration**

The AIService reads from VS Code settings:
- `vertex.senseiProvider` - Provider for motivational feedback
- `vertex.codeGenProvider` - Provider for code generation
- `vertex.senseiModel` - Model name for Sensei
- `vertex.codeGenModel` - Model name for code generation
- `vertex.ollamaEndpoint` - Endpoint for local Ollama (default: http://localhost:11434)

---

### 2. TeacherSlateService (teacherSlate.ts)

Manages the interactive learning mode with ghost text and real-time validation.

#### Class: `TeacherSlateService`

**Initialization**

```typescript
public static getInstance(): TeacherSlateService
```
Returns the singleton instance.

**Lesson Management**

```typescript
public setLesson(code: string): void
```
Activates learning mode with the provided code as the lesson.
- **Parameters**: 
  - `code`: The complete code the user should type
- **Side Effects**: Activates ghost text decorations, starts tracking user input

```typescript
public deactivate(): void
```
Deactivates learning mode and clears all decorations.
- **Side Effects**: Removes all ghost text, error highlights, and feedback messages

```typescript
public isActive(): boolean
```
Returns whether learning mode is currently active.

```typescript
public getLessonCode(): string
```
Returns the current lesson code.

**Feedback System**

```typescript
public showFeedback(message: string): void
```
Displays an inline feedback message from Sensei.
- **Parameters**: 
  - `message`: Feedback text to display
- **Display Duration**: 8 seconds (auto-clears)
- **Location**: End of current line in editor

```typescript
public clearFeedback(): void
```
Immediately clears all feedback messages.

**Decoration Management**

```typescript
public updateDecorations(): void
```
Updates ghost text and error decorations based on current user input.
- **Called**: Automatically on text document changes
- **Behavior**: 
  - Shows remaining lesson code as gray ghost text
  - Highlights incorrect characters in red
  - Compares user input character-by-character with lesson

**Decoration Types**

The service uses three decoration types:
1. **Ghost Text**: Gray, transparent text showing what to type next
2. **Error Decoration**: Red background highlighting incorrect input
3. **Feedback Decoration**: Italic gray text for Sensei messages

**Usage Example**

```typescript
const slateService = TeacherSlateService.getInstance();

// Start a lesson
slateService.setLesson('function hello() {\n  console.log("Hi");\n}');

// Show encouragement
slateService.showFeedback("Great start! Keep going!");

// Check if active
if (slateService.isActive()) {
  // Lesson in progress
}

// End lesson
slateService.deactivate();
```

---

### 3. VisualizerProvider (visualizerProvider.ts)

Provides a webview-based visual intelligence panel showing code relationships.

#### Class: `VisualizerProvider`

**Constants**

```typescript
public static readonly viewType = 'vertex.visualizer'
```

**Constructor**

```typescript
constructor(private readonly _extensionUri: vscode.Uri)
```
- **Parameters**: 
  - `_extensionUri`: Extension's URI for loading resources

**Webview Lifecycle**

```typescript
public resolveWebviewView(
  webviewView: vscode.WebviewView,
  context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
): void
```
Called by VS Code when the webview needs to be created/restored.
- **Side Effects**: 
  - Sets up webview options (enables scripts, sets resource roots)
  - Registers event listeners for document changes
  - Performs initial render

**Update Methods**

```typescript
public update(): void
```
Refreshes the visualizer with current editor content.
- **Triggers**: Document changes, active editor changes
- **Behavior**: 
  - Parses current code
  - Generates HTML representation with relationship arrows
  - Updates webview content

```typescript
public syncHighlight(line: number): void
```
Highlights code elements on a specific line.
- **Parameters**: 
  - `line`: Line number to highlight (0-indexed)
- **Behavior**: Posts message to webview to highlight elements

**Internal Methods**

```typescript
private getHtmlContent(code: string, relationships: Relationship[], lang: string): string
```
Generates the complete HTML content for the webview.
- **Parameters**:
  - `code`: Source code to visualize
  - `relationships`: Array of parsed relationships
  - `lang`: Language identifier
- **Returns**: Complete HTML document as string
- **Features**:
  - Syntax-colored code display
  - SVG arrows connecting relationships
  - Interactive highlighting
  - Responsive layout

**HTML Structure**

The generated HTML includes:
- Code display with line numbers
- Span elements marking code nodes
- SVG overlay with curved arrows
- CSS styling for syntax highlighting
- JavaScript for interactive features

**Event Handlers**

The visualizer responds to:
- `onDidChangeTextDocument` - Updates on code changes
- `onDidChangeActiveTextEditor` - Updates on file switches
- `onDidChangeTextEditorSelection` - Syncs cursor position

**Usage Example**

```typescript
// In extension activation
const visualizerProvider = new VisualizerProvider(context.extensionUri);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    VisualizerProvider.viewType, 
    visualizerProvider
  )
);

// Programmatically update
visualizerProvider.update();

// Highlight specific line
visualizerProvider.syncHighlight(5);
```

---

### 4. ParserService (parserService.ts)

Parses source code to extract relationships between variables, functions, and calls.

#### Interfaces

```typescript
interface Definition {
  name: string;      // Identifier name
  line: number;      // Line number (0-indexed)
  startCol: number;  // Start column
  endCol: number;    // End column
}

interface Relationship {
  start: Definition;  // Usage location
  end: Definition;    // Definition location
  id: string;        // Unique relationship ID
}
```

#### Class: `ParserService`

**Main Parser**

```typescript
public static parse(code: string, languageId: string): Relationship[]
```
Parses code and returns all detected relationships.
- **Parameters**:
  - `code`: Source code string
  - `languageId`: VS Code language ID (javascript, python, etc.)
- **Returns**: Array of relationships
- **Supported Languages**: JavaScript, TypeScript, Python, Java, C, C++, Go, HTML, CSS

**Language Support**

The parser detects:

**Python**:
- Function definitions: `def function_name(params):`
- Variable assignments: `x = value`
- For loop variables: `for item in items:`
- Function parameters
- Variable usages

**JavaScript/TypeScript**:
- Function declarations: `function name() {}`
- Arrow functions: `const name = () => {}`
- Variable declarations: `const/let/var name = value`
- Class definitions: `class Name {}`
- Method definitions
- Variable and function calls

**Java**:
- Class declarations: `public class Name {}`
- Method declarations: `public void method(params) {}`
- Variable declarations
- Method calls

**C/C++**:
- Function definitions: `int function(params) {}`
- Variable declarations: `int x = 0;`
- Struct definitions
- Function calls

**Go**:
- Function definitions: `func name(params) type {}`
- Variable declarations: `var name type`, `name := value`
- Struct definitions
- Function calls

**Exclusion Lists**

The parser maintains language-specific keyword exclusion lists to avoid false positives:
- Reserved keywords (if, else, for, while, etc.)
- Built-in functions (print, console, System, etc.)
- Type names (int, string, bool, etc.)

**Algorithm**

1. **Definition Pass**: Scans for variable/function definitions
2. **Usage Pass**: Finds all identifier usages
3. **Matching**: Connects usages to their definitions
4. **Relationship Creation**: Builds relationship objects with line/column data

**Example**

```typescript
const code = `
function add(a, b) {
  return a + b;
}
const result = add(5, 10);
`;

const relationships = ParserService.parse(code, 'javascript');
// Returns relationships linking:
// - 'add' at line 4 to definition at line 1
// - 'a' usage at line 2 to parameter at line 1
// - 'b' usage at line 2 to parameter at line 1
```

**Performance Considerations**

- Runs on every keystroke for active files
- Optimized for files < 1000 lines
- Uses regex matching for efficiency
- Skips comments and string literals

---

### 5. GhostTextProvider (ghostTextProvider.ts)

Provides inline completion suggestions for learning mode.

#### Class: `GhostTextProvider`

**Implementation**

```typescript
implements vscode.InlineCompletionItemProvider
```

**Main Method**

```typescript
public async provideInlineCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  context: vscode.InlineCompletionContext,
  token: vscode.CancellationToken
): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[]>
```

Provides ghost text suggestions based on the active lesson.

- **Parameters**:
  - `document`: Current text document
  - `position`: Cursor position
  - `context`: Completion context from VS Code
  - `token`: Cancellation token
- **Returns**: Array of inline completion items
- **Behavior**:
  - Returns empty array if no lesson is active
  - Calculates remaining code from cursor position
  - Creates InlineCompletionItem with ghost text
  - Sets filterText to maintain persistence

**Ghost Text Behavior**

The ghost text:
- Appears in gray, transparent text
- Shows remaining lesson code from cursor position
- Persists as user types correctly
- Disappears if user types incorrectly
- Reappears when user corrects mistakes

**Registration**

```typescript
vscode.languages.registerInlineCompletionItemProvider(
  { pattern: '**' }, 
  new GhostTextProvider()
);
```

---

## Extension Points

### Commands

All commands are registered in `extension.ts` and accessible via Command Palette.

#### Learning Commands

```typescript
'vertex.loadLesson'
```
Loads a language-specific sample lesson.
- **Keyboard**: None (use Command Palette)
- **Effect**: Activates TeacherSlateService with sample code

```typescript
'vertex.clearLesson'
```
Clears the current lesson and deactivates learning mode.
- **Keyboard**: None
- **Effect**: Calls `TeacherSlateService.deactivate()`

#### AI Commands

```typescript
'vertex.askSensei'
```
Requests code suggestions from AI.
- **Keyboard**: `Ctrl+I` (Windows/Linux), `Cmd+I` (Mac)
- **When**: Editor has focus
- **Effect**: Opens input box, generates code via AIService

```typescript
'vertex.selectModel'
```
Opens model selection quick pick.
- **Keyboard**: `Ctrl+J` (Windows/Linux), `Cmd+J` (Mac)
- **When**: Editor has focus
- **Effect**: Shows available models, updates configuration

```typescript
'vertex.changeProvider'
```
Switches AI provider.
- **Keyboard**: `Ctrl+H` (Windows/Linux), `Cmd+H` (Mac)
- **When**: Editor has focus
- **Effect**: Shows provider list, updates configuration

#### Visualization Commands

```typescript
'vertex.showVisualizer'
```
Opens the Visual Intelligence sidebar.
- **Keyboard**: None
- **Effect**: Reveals visualizer webview

```typescript
'vertex.toggleVisualizer'
```
Toggles visualizer visibility.
- **Keyboard**: `Ctrl+Shift+V` (Windows/Linux), `Cmd+Shift+V` (Mac)
- **When**: Editor has focus

#### API Key Management

```typescript
'vertex.resetGeminiKey'
```
Clears stored Gemini API key.

```typescript
'vertex.resetOpenRouterKey'
```
Clears stored OpenRouter API key.

```typescript
'vertex.resetOllamaKey'
```
Clears stored Ollama Cloud API key.

```typescript
'vertex.resetAllKeys'
```
Clears all stored API keys with confirmation prompt.

### Views

#### Activity Bar Container

```json
{
  "id": "vertex-explorer",
  "title": "Vertex",
  "icon": "$(eye)"
}
```

#### Webview View

```json
{
  "type": "webview",
  "id": "vertex.visualizer",
  "name": "Visual Intelligence"
}
```

---

## Configuration API

### Settings Schema

All settings are under the `vertex` namespace.

#### `vertex.aiProvider`
- **Type**: `string`
- **Default**: `"Gemini"`
- **Enum**: `["Local Model (Ollama)", "Ollama Cloud", "OpenRouter", "Gemini"]`
- **Description**: Global fallback provider if service-specific providers are not set

#### `vertex.senseiProvider`
- **Type**: `string`
- **Default**: `"Gemini"`
- **Enum**: `["Local Model (Ollama)", "Ollama Cloud", "OpenRouter", "Gemini"]`
- **Description**: Provider specifically for Sensei's motivational feedback

#### `vertex.codeGenProvider`
- **Type**: `string`
- **Default**: `"Gemini"`
- **Enum**: `["Local Model (Ollama)", "Ollama Cloud", "OpenRouter", "Gemini"]`
- **Description**: Provider for code generation requests

#### `vertex.senseiModel`
- **Type**: `string`
- **Default**: `"gemini-2.0-flash"`
- **Description**: Model used by Sensei for mentoring

#### `vertex.codeGenModel`
- **Type**: `string`
- **Default**: `"gemini-2.0-flash"`
- **Description**: Model used for code generation

#### `vertex.ollamaEndpoint`
- **Type**: `string`
- **Default**: `"http://localhost:11434"`
- **Description**: Endpoint URL for local Ollama instance

### Accessing Settings

```typescript
const config = vscode.workspace.getConfiguration('vertex');
const provider = config.get<string>('senseiProvider');
const model = config.get<string>('senseiModel');

// Update setting
await config.update('senseiProvider', 'OpenRouter', vscode.ConfigurationTarget.Global);
```

### Secret Storage

API keys are stored securely using VS Code's Secret Storage API:

```typescript
// Store
await context.secrets.store('GEMINI_API_KEY', apiKey);

// Retrieve
const apiKey = await context.secrets.get('GEMINI_API_KEY');

// Delete
await context.secrets.delete('GEMINI_API_KEY');
```

**Secret Keys**:
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `OLLAMA_CLOUD_API_KEY`

---

## Usage Examples

### Example 1: Basic Learning Session

```typescript
import * as vscode from 'vscode';
import { TeacherSlateService } from './teacherSlate';

const lessonCode = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`;

const slateService = TeacherSlateService.getInstance();
slateService.setLesson(lessonCode);

// User types along, ghost text guides them
// Decorations update automatically

// When done
slateService.deactivate();
```

### Example 2: AI-Powered Code Generation

```typescript
import { AIService } from './aiService';

const aiService = AIService.getInstance();
await aiService.initialize(context);

// Generate code
const prompt = "Create a function that validates email addresses";
const language = "typescript";

try {
  const code = await aiService.generateCode(prompt, language);
  
  // Insert into editor
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, code);
    });
  }
} catch (error) {
  vscode.window.showErrorMessage('Failed to generate code');
}
```

### Example 3: Custom Visualizer Integration

```typescript
import { ParserService } from './parserService';

const editor = vscode.window.activeTextEditor;
if (editor) {
  const code = editor.document.getText();
  const lang = editor.document.languageId;
  
  const relationships = ParserService.parse(code, lang);
  
  // Process relationships
  relationships.forEach(rel => {
    console.log(`${rel.start.name} at line ${rel.start.line} ` +
                `references ${rel.end.name} at line ${rel.end.line}`);
  });
}
```

### Example 4: Multi-Provider AI Setup

```typescript
import * as vscode from 'vscode';

// Configure different providers for different tasks
const config = vscode.workspace.getConfiguration('vertex');

// Use fast model for Sensei feedback
await config.update('senseiProvider', 'Gemini', vscode.ConfigurationTarget.Global);
await config.update('senseiModel', 'gemini-2.0-flash', vscode.ConfigurationTarget.Global);

// Use powerful model for code generation
await config.update('codeGenProvider', 'Gemini', vscode.ConfigurationTarget.Global);
await config.update('codeGenModel', 'gemini-2.5-pro', vscode.ConfigurationTarget.Global);

// Re-sync the AI service
const aiService = AIService.getInstance();
await aiService.syncModels();
```

### Example 5: Custom Feedback Integration

```typescript
import { TeacherSlateService } from './teacherSlate';

const slateService = TeacherSlateService.getInstance();

// Show custom feedback based on user progress
vscode.workspace.onDidChangeTextDocument(event => {
  if (!slateService.isActive()) return;
  
  const userCode = event.document.getText();
  const lessonCode = slateService.getLessonCode();
  
  const progress = (userCode.length / lessonCode.length) * 100;
  
  if (progress === 25) {
    slateService.showFeedback("You're 25% done! Keep it up!");
  } else if (progress === 50) {
    slateService.showFeedback("Halfway there! You're doing great!");
  } else if (progress === 75) {
    slateService.showFeedback("Almost done! Just a little more!");
  }
});
```

---

## Event System

### Document Events

```typescript
// Listen for text changes
vscode.workspace.onDidChangeTextDocument(event => {
  // Update visualizer
  visualizerProvider.update();
  
  // Update ghost text
  slateService.updateDecorations();
});

// Listen for active editor changes
vscode.window.onDidChangeActiveTextEditor(editor => {
  if (editor) {
    visualizerProvider.update();
  }
});

// Listen for selection changes
vscode.window.onDidChangeTextEditorSelection(event => {
  const line = event.selections[0].active.line;
  visualizerProvider.syncHighlight(line);
});
```

### Configuration Changes

```typescript
vscode.workspace.onDidChangeConfiguration(event => {
  if (event.affectsConfiguration('vertex')) {
    // Resync AI models
    aiService.syncModels();
    
    // Update UI
    vscode.window.showInformationMessage('Vertex configuration updated');
  }
});
```

---

## Error Handling

### AI Service Errors

```typescript
try {
  const response = await aiService.generateSenseiResponse(code, context);
} catch (error) {
  if (error.message.includes('API key')) {
    vscode.window.showErrorMessage('Please configure your API key');
    // Trigger API key setup
    await aiService.ensureApiKey(context, 'Gemini');
  } else if (error.message.includes('rate limit')) {
    vscode.window.showWarningMessage('Rate limit reached. Please try again later.');
  } else {
    console.error('AI Service Error:', error);
    vscode.window.showErrorMessage('AI service encountered an error');
  }
}
```

### Parser Errors

```typescript
try {
  const relationships = ParserService.parse(code, language);
} catch (error) {
  console.error('Parser Error:', error);
  // Fallback to empty relationships
  return [];
}
```

---

## Testing

### Unit Testing

```typescript
import * as assert from 'assert';
import { ParserService } from '../parserService';

suite('ParserService Tests', () => {
  test('Should parse JavaScript function definition', () => {
    const code = 'function test() { return 42; }';
    const rels = ParserService.parse(code, 'javascript');
    
    assert.strictEqual(rels.length > 0, true);
  });
  
  test('Should detect variable usage', () => {
    const code = 'const x = 5;\nconsole.log(x);';
    const rels = ParserService.parse(code, 'javascript');
    
    const xUsage = rels.find(r => r.start.name === 'x');
    assert.strictEqual(xUsage !== undefined, true);
  });
});
```

---

## Performance Optimization

### Debouncing

```typescript
let updateTimeout: NodeJS.Timeout | undefined;

vscode.workspace.onDidChangeTextDocument(event => {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  
  updateTimeout = setTimeout(() => {
    visualizerProvider.update();
  }, 150); // 150ms debounce
});
```

### Caching

```typescript
private relationshipCache = new Map<string, Relationship[]>();

public parse(code: string, language: string): Relationship[] {
  const cacheKey = `${language}:${code.length}:${code.substring(0, 100)}`;
  
  if (this.relationshipCache.has(cacheKey)) {
    return this.relationshipCache.get(cacheKey)!;
  }
  
  const relationships = this.doParse(code, language);
  this.relationshipCache.set(cacheKey, relationships);
  
  return relationships;
}
```

---

## Security Considerations

### API Key Storage

- All API keys stored in VS Code's Secret Storage (encrypted)
- Keys never logged or transmitted except to official APIs
- User prompted for consent before storing keys

### Network Requests

```typescript
// Always use HTTPS
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';

// Validate responses
if (!response.ok) {
  throw new Error(`API Error: ${response.status}`);
}

// Sanitize user input before sending to AI
const sanitized = userInput.replace(/[<>]/g, '');
```

### Webview Security

```typescript
webviewView.webview.options = {
  enableScripts: true,
  localResourceRoots: [this._extensionUri]
};

// Use CSP in webview HTML
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
```

---

## Troubleshooting

### Common Issues

**Issue**: Ghost text not appearing
- **Check**: Is learning mode active? (`TeacherSlateService.isActive()`)
- **Check**: Is inline completion enabled in VS Code settings?
- **Solution**: Run `Vertex: Load Sample Lesson`

**Issue**: Visualizer not updating
- **Check**: Is the webview visible?
- **Check**: Are there parse errors in the console?
- **Solution**: Toggle visualizer off and on

**Issue**: AI not responding
- **Check**: Is API key configured?
- **Check**: Network connectivity
- **Check**: Rate limits
- **Solution**: Run `Vertex: Reset API Keys`

**Issue**: Incorrect relationships in visualizer
- **Check**: Is language supported?
- **Check**: Code syntax correctness
- **Solution**: Report to GitHub with code sample

---

## Contributing

### Adding a New Language to Parser

```typescript
// 1. Add exclusion keywords
private static EXCLUDE: Record<string, Set<string>> = {
  // ... existing languages
  rust: new Set(['fn', 'let', 'mut', 'if', 'else', 'match', 'loop', 'while', 'for', 'return', 'struct', 'impl', 'trait', 'use', 'mod', 'pub', 'crate', 'i32', 'u32', 'f64', 'String', 'Vec', 'Option', 'Result', 'true', 'false', 'None', 'Some'])
};

// 2. Add parsing logic in ParserService.parse()
if (lang === 'rust') {
  // Function definition: fn function_name(params) -> type {
  const fnMatch = trimmed.match(/^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
  if (fnMatch) {
    addDef(fnMatch[1], lineNum, line);
  }
  
  // Variable binding: let x = ...
  const letMatch = trimmed.match(/^let\s+(mut\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (letMatch) {
    addDef(letMatch[2], lineNum, line);
  }
}

// 3. Update normalizeLanguageId() if needed
// 4. Add to activationEvents in package.json
```

### Adding a New AI Provider

```typescript
// 1. Add provider to configuration enum in package.json
{
  "vertex.aiProvider": {
    "enum": ["Local Model (Ollama)", "Ollama Cloud", "OpenRouter", "Gemini", "Anthropic"]
  }
}

// 2. Implement in AIService
private anthropicClient: any;

public async syncModels(): Promise<void> {
  const config = vscode.workspace.getConfiguration('vertex');
  const provider = config.get<string>('senseiProvider');
  
  if (provider === 'Anthropic') {
    await this.initAnthropic();
  }
}

private async initAnthropic(): Promise<void> {
  const apiKey = await this.ensureApiKey(this.context!, 'Anthropic');
  if (apiKey) {
    // Initialize Anthropic client
    this.anthropicClient = new AnthropicClient(apiKey);
  }
}

// 3. Add API calls
public async generateSenseiResponse(code: string, context: string): Promise<string> {
  const provider = vscode.workspace.getConfiguration('vertex').get<string>('senseiProvider');
  
  if (provider === 'Anthropic') {
    return await this.callAnthropic(code, context);
  }
  // ... existing providers
}
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

See [LICENSE](LICENSE) for license information.

## Support

- **Issues**: [GitHub Issues](https://github.com/dev0root6/Vertex-code-IDE//issues)
- **Discussions**: [GitHub Discussions](https://github.com/dev0root6/Vertex-code-IDE//discussions)
- **Email**: support@vertex-ide.com

---

**Last Updated**: February 26, 2026  
**Version**: 0.0.1  
**Maintainer**: Vertex Team
