# CoTra-IDE Update Log

## 2026-02-12 - Major Feature Update
### Code Generation & Execution
- **Web Compiler Backend**: Express.js server (port 5000) executes Python, JavaScript, Java, C++, C, Go, Rust, PHP, Ruby, TypeScript, Kotlin, Swift
- **Real-time Code Execution**: Code runs on PC, output displays in browser
- **Output Panel**: Shows stdout/stderr with color-coded success/error display
- **Case-Insensitive Matching**: "hello world" matches "Hello World" for output validation

### AI & Code Generation
- **Ollama Integration**: Using qwen2.5-coder:1.5b as primary code generation engine
- **Local Fallback**: Transformers.js (DistilGPT-2) when Ollama unavailable
- **Markdown Code Extraction**: Parses ```language ... ``` fences from AI responses
- **Comment Removal**: Automatically strips //, #, /* */ from generated code
- **Strict No-Comments Prompt**: AI instructed to generate only executable code
- **Language Detection**: Auto-detects 15+ programming languages from prompts
- **Dynamic Filenames**: practice.py, practice.java, practice.js based on detected language

### UI/UX Improvements
- **Draggable Floating Chatbot**: Drag, resize, minimize chatbot window anywhere on screen
- **Markdown Rendering**: Chat displays formatted explanations with bold, italic, headers, inline code
- **Dual Output Display**: Explanation in chat, code in IDE, both visible
- **Removed Sensei Popover**: Simplified UI, removed real-time line explanations
- **File Badge**: Shows active filename (practice.py) in editor header
- **Ghost Opacity Control**: Slider to adjust ghost text visibility

### Technical Architecture
- **Backend**: server.js (Express) with language-specific compilers/interpreters
- **Frontend**: React + Vite, Monaco Editor dual-layer (ghost + student)
- **AI Service**: code-generator.js with Ollama + local fallback routing
- **Compiler Service**: compiler-service.js sends code to backend for execution
- **Error Detection**: Case-insensitive character-level mismatch tracking

### Current Features
✅ Kinetic tracing with ghost text overlay  
✅ AI-powered code generation from natural language prompts  
✅ Multi-language support (15+ languages)  
✅ Real-time code execution with output display  
✅ Draggable/resizable chatbot interface  
✅ Markdown-formatted explanations  
✅ Comment-free code generation  
✅ Language auto-detection and filename mapping  
✅ Case-insensitive output matching  
✅ Backend compiler service (Python, Java, C++, JavaScript, etc.)

## Previous Updates (2026-02-10)
- Added lesson script and styling for the tutoring interface.
- Switched the lesson to a predefined "Hello, World!" tracing prompt.
- Reworked the editor into a ghost-text overlay so typing happens on top of the static script.
- Fixed mismatch handling to prevent reversed typing and keep input aligned.
- Added sidebar error classification for bracket vs parenthesis (TypeError hint).
- Added a Compile action to show errors only on compile and display success state.
- Made student typing visually primary over ghost text.
- Added Transformers.js local AI (DistilGPT-2) for client-side code generation and error analysis.
- Restored Ollama integration using qwen2.5-coder:1.5b with local fallback.
- Progress completion now tracks the active generated lesson.
- Fixed ChatBot message handler syntax error.
- Added language detection with filename badges and editor language switching.
- Enlarged and widened the chat panel, styled code blocks without markdown fences.
- Chatbot now parses code output (no markdown fences) and shows explanations separately.
- Sensei guidance moved to an in-editor popover with AI line explanations.
- Made prompts language-agnostic and enforced coding-only chatbot queries.
- **Added ChatBot interface for dynamic code generation from prompts.**
- **Students can ask for code, system generates it, displays as ghost text, analyzes as they type.**
- **Live analysis shows typing progress and errors in real-time.**
- Fixed JSX structure error (ChatBot placement in layout).
- Removed Ollama pretense—using **reliable local AI only**.
- Added a Compile action to show errors only on compile and display success state.
- Made student typing visually primary over ghost text.
