# 🌌 Vertex - The Visual Learning Extension for VS Code

**Vertex** is a next-generation educational extension for VS Code that transforms your editor into a mentor. It combines ghost-text guidance, visual call graphs, and motivational AI to help you master coding character-by-character.

## ✨ Key Features

### 🖋️ Teacher's Slate (Learning Mode)
- **Ghost-Text Guidance**: Follow along with predictive ghost text that appears as you type. Learn syntax by doing.
- **Real-time Validation**: Instant feedback on every character. Correct matches stay gray; mismatches are highlighted in red.
- **Zero-Distraction**: Minimalist UI that focuses entirely on the code.

### 🧠 Visual Intelligence
- **Dynamic Call Graph**: A side-by-side view that traces relationships in your code.
- **Living Arrows**: Real-time SVG arrows connect variable usage to definitions and function calls to sources.
- **Cross-Language Support**: Intelligent parsing for **JavaScript, TypeScript, Python, Java, C, C++, and Go**.
- **Real-time Updates**: Automatically refreshes as you type to show live code relationships.
- **Cursor Sync**: Highlights code elements as you navigate through your file.

### 🧘 Sensei: Motivational AI
- **Multi-Provider Support**: Choose from **Gemini**, **OpenRouter**, **Ollama Cloud**, or **Local Ollama**.
- **Flexible AI Models**: Select different models for different tasks (Sensei feedback vs code generation).
- **Context-Aware Feedback**: Provides motivational insights based on your current code and progress.
- **Non-Intrusive**: Feedback appears in the status bar to keep your workspace clean.
- **Smart Debouncing**: Sensei watches your progress and speaks up when you need a boost.
- **Secure API Keys**: All API keys are stored securely in VS Code's Secret Storage.

### 🎯 AI Flexibility
- **Multiple AI Providers**: Seamlessly switch between Gemini, OpenRouter, Ollama Cloud, and Local Ollama.
- **Provider-Specific Configuration**: Set different providers for Sensei feedback and code generation.
- **Model Selection**: Choose from multiple Gemini models (gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro, gemini-1.5-flash-latest).
- **Local Development**: Full support for local Ollama models for offline development.
- **Quick Switching**: Use keyboard shortcuts (`Ctrl+J` / `Cmd+J`) to quickly change models mid-session.

---

## 🚀 Quick Start

### 1. Prerequisites
- **VS Code**: v1.107.0+
- **AI Provider**: Choose one or more:
  - **Gemini API Key** (default)
  - **OpenRouter API Key**
  - **Ollama Cloud API Key**
  - **Local Ollama** (no API key needed)
- Vertex will securely prompt you for API keys on first use and store them in VS Code's Secret Storage.

### 2. Loading a Lesson
Run the command `Vertex: Load Sample Lesson` from the Command Palette (`Ctrl+Shift+P`).

### 3. Visualizing Relationships
Run the command `Vertex: Show Visual Intelligence` to open the side-by-side visualizer.

---

## ⚙️ Configuration

### AI Provider Settings
| Setting | Description | Default |
|---------|-------------|---------|
| `vertex.aiProvider` | Global fallback AI provider | `Gemini` |
| `vertex.senseiProvider` | AI provider for Sensei feedback | `Gemini` |
| `vertex.codeGenProvider` | AI provider for code generation | `Gemini` |
| `vertex.senseiModel` | Model used by Sensei | `gemini-2.0-flash` |
| `vertex.codeGenModel` | Model used for code generation | `gemini-2.0-flash` |
### Learning Commands
- `Vertex: Load Sample Lesson` – Start a guided coding lesson with ghost text.
- `Vertex: Clear Lesson` – Clear all decorations and active lessons.
- `Vertex: Run Current Code` – Execute the current file.

### Visualization Commands
- `Vertex: Show Visual Intelligence` – Open the visual intelligence sidebar.
- `Vertex: Toggle Visual Intelligence` – Toggle the visualizer on/off (`Ctrl+Shift+V` / `Cmd+Shift+V`).

### AI Configuration Commands
- `Vertex: Select Gemini Model` – Choose which Gemini model to use (`Ctrl+J` / `Cmd+J`).
- `Vertex: Ask Sensei for Code` – Get AI-powered code suggestions (`Ctrl+I` / `Cmd+I`).
- `Vertex: Reset Gemini API Key` – Clear and re-enter your Gemini API key.
- `Vertex: Reset OpenRouter API Key` – Clear and re-enter your OpenRouter API key.
- `Vertex: Reset Ollama Cloud API Key` – Clear and re-enter your Ollama Cloud API key.
- `Vertex: Reset ALL API Keys` – Clear all stored API keys at once.

### Keyboard Shortcuts
- `Ctrl+I` / `Cmd+I` – Ask Sensei for code suggestions
- `Ctrl+Shift+V` / `Cmd+Shift+V` – Toggle Visual Intelligence
- `Ctrl+J` / `Cmd+J` – Select AI model
- `Ctrl+H` / `Cmd+H` – Change AI provider

---

## 🎓 What Makes Vertex Unique?

Vertex combines three powerful learning paradigms:

1. **Interactive Learning** - Type along with ghost text guidance, getting instant feedback on every character you type.

2. **Visual Understanding** - See code relationships come alive with dynamic graphs showing how your variables, functions, and calls connect.

3. **AI Mentorship** - Get encouragement and code assistance from multiple AI providers, with the flexibility to choose what works best for you.

## 🔒 Privacy & Security

- **Secure Storage**: All API keys are encrypted and stored in VS Code's Secret Storage
- **Local Option**: Use Local Ollama for complete privacy - your code never leaves your machine
- **No Telemetry**: Vertex doesn't collect or send any usage data
- **Open Source**: Review the code and contribute on GitHub

## 🌍 Supported Languages

- JavaScript & TypeScript
- Python
- Java
- C & C++
- Go
- HTML & CSS
- More coming soon!

## 📚 Documentation

For comprehensive API documentation and advanced usage, see [DOCS.md](DOCS.md).

---
*Ollama Cloud** - Cloud-hosted Ollama models (requires API key)
- **Local Model (Ollama)** - Run models locally on your machine (no API key needed)

### Supported Gemini Models
- `gemini-2.0-flash` (default, fastest)
- `gemini-2.5-flash` (faster, newer)
- `gemini-2.5-pro` (most capable)
- `gemini-1.5-flash-latest` (latest stable)

---

## 🤝 Commands

- `Vertex: Load Sample Lesson` – Start a guided coding lesson.
- `Vertex: Clear Lesson` – Clear all decorations and active lessons.
- `Vertex: Show Visual Intelligence` – Toggle the SVG relationship visualizer.
- `Vertex: Reset Gemini API Key` – Clear your stored key to provide a new one.

---
*Built with ❤️ for the next generation of developers.*
