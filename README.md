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
- **Cross-Language Support**: Intelligent parsing for **JavaScript/TypeScript, Python, Java, C, and C++**.

### 🧘 Sensei: Motivational AI
- **Gemini Powered**: Uses Google Gemini to provide context-aware, motivational feedback.
- **Non-Intrusive**: Feedback appears in the status bar to keep your workspace clean.
- **Smart Debouncing**: Sensei watches your progress and speaks up when you need a boost.

---

## 🚀 Quick Start

### 1. Prerequisites
- **VS Code**: v1.9x+
- **Gemini API Key**: If not set in your environment (`GEMINI_API_KEY`), Vertex will securely prompt you for it and store it in your VS Code Secret Storage.

### 2. Loading a Lesson
Run the command `Vertex: Load Sample Lesson` from the Command Palette (`Ctrl+Shift+P`).

### 3. Visualizing Relationships
Run the command `Vertex: Show Visual Intelligence` to open the side-by-side visualizer.

---

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `vertex.geminiModel` | Select between `gemini-1.5-flash` or `gemini-1.5-pro` | `gemini-1.5-flash` |

---

## 🤝 Commands

- `Vertex: Load Sample Lesson` – Start a guided coding lesson.
- `Vertex: Clear Lesson` – Clear all decorations and active lessons.
- `Vertex: Show Visual Intelligence` – Toggle the SVG relationship visualizer.
- `Vertex: Reset Gemini API Key` – Clear your stored key to provide a new one.

---
*Built with ❤️ for the next generation of developers.*
