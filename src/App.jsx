import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { lessonScript } from "./lesson.js";
import { checkOllamaHealth } from "./ollama-service.js";
import ChatBot from "./ChatBot.jsx";
import { executeCode } from "./compiler-service.js";
import { getLineAnalysis } from "./code-generator.js";
import Background3D from "./Background3D.jsx";
import Terminal from "./Terminal.jsx";
import CodeVisualizer from "./CodeVisualizer.jsx";

const SUPPORTED_LANGUAGES = [
  { name: "JavaScript", id: "javascript", compileCommand: "node" },
  { name: "Python", id: "python", compileCommand: "python" },
  { name: "Java", id: "java", compileCommand: "java -cp /src" }, // Assuming a structure where Java files are in /src
  { name: "C", id: "c", compileCommand: "gcc -Wall -o /tmp/a.out /src/main.c && /tmp/a.out" }, // Basic C compilation
  { name: "C++", id: "cpp", compileCommand: "g++ -Wall -o /tmp/a.out /src/main.cpp && /tmp/a.out" }, // Basic C++ compilation
];

const SUPPORTED_THEMES = [
  { name: "VS Dark", id: "vs-dark" },
  { name: "VS Light", id: "vs-light" },
  { name: "High Contrast Dark", id: "hc-black" },
  { name: "High Contrast Light", id: "hc-light" },
];

const getMismatchIndex = (input, script) => {
  // Case-insensitive comparison for output matching
  const inputLower = input.toLowerCase();
  const scriptLower = script.toLowerCase();

  const max = Math.max(inputLower.length, scriptLower.length);
  for (let i = 0; i < max; i += 1) {
    if (inputLower[i] !== scriptLower[i]) {
      return i;
    }
  }
  return inputLower.length;
};

const getMatchLength = (input, script) => {
  // Case-insensitive for output matching
  const inputLower = input.toLowerCase();
  const scriptLower = script.toLowerCase();

  const max = Math.min(inputLower.length, scriptLower.length);
  for (let i = 0; i < max; i += 1) {
    if (inputLower[i] !== scriptLower[i]) {
      return i;
    }
  }
  return max;
};

const classifyError = (input, script) => {
  const mismatchAt = getMismatchIndex(input, script);
  const expectedChar = script[mismatchAt];
  const actualChar = input[mismatchAt];

  if (
    input.startsWith("console.log") &&
    actualChar === "[" &&
    expectedChar === "("
  ) {
    return "TypeError: console.log is not a function when using brackets. Use parentheses like console.log(\"Hello, World!\").";
  }

  if (actualChar && expectedChar) {
    return `Syntax mismatch at character ${mismatchAt + 1}. Expected "${expectedChar}" but got "${actualChar}".`;
  }

  if (actualChar && !expectedChar) {
    return "Extra input detected. Remove the extra character(s) to continue.";
  }

  return "You're missing a required character. Follow the ghost text exactly.";
};

// SenseiContentWidget class for in-editor explanations
class SenseiContentWidget {
  constructor(editor, monaco, id) {
    this.editor = editor;
    this.monaco = monaco;
    this.domNode = document.createElement('div');
    this.domNode.className = 'sensei-content-widget';
    this.domNode.innerHTML = '';
    this._id = 'sensei.content.widget.' + id;
    this._position = { lineNumber: 1, column: 1 };
  }

  getId() {
    return this._id;
  }

  getDomNode() {
    return this.domNode;
  }

  getPosition() {
    return {
      position: this._position,
      preference: [this.monaco.editor.ContentWidgetPositionPreference.BELOW]
    };
  }

  updateContent(analysis, lineNumber) {
    if (!analysis) {
      this.hide();
      return;
    }
    this.domNode.style.display = 'block';
    this.domNode.innerHTML = `<div class="sensei-tooltip">🤔 ${analysis}</div>`;
    this._position = { lineNumber: lineNumber, column: 1 }; // Position at the beginning of the line
    this.editor.layoutContentWidget(this);
  }

  hide() {
    this.domNode.style.display = 'none';
    this.domNode.innerHTML = '';
    this.editor.layoutContentWidget(this); // Re-layout to hide
  }

  dispose() {
    this.editor.removeContentWidget(this);
    this.domNode = null;
  }
}

const App = () => {
  const studentEditorRef = useRef(null);
  const ghostEditorRef = useRef(null);
  const monacoRef = useRef(null);
  const errorDecorationRef = useRef([]);
  const isApplyingRef = useRef(false);

  const [progressIndex, setProgressIndex] = useState(0);
  const [errorIndex, setErrorIndex] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [compileStatus, setCompileStatus] = useState("idle");
  const [aiBackend, setAiBackend] = useState("none");
  const [opacity, setOpacity] = useState(0.3);
  const [currentLine, setCurrentLine] = useState(1);
  const [currentLesson, setCurrentLesson] = useState(""); // Default empty ghost text
  const [currentLanguage, setCurrentLanguage] = useState("javascript");
  const [currentFilename, setCurrentFilename] = useState("practice.js");
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("vs-dark");
  useEffect(() => {
    // Automatically detect language from filename
    const ext = currentFilename.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'h': 'c'
    };
    if (langMap[ext] && langMap[ext] !== currentLanguage) {
      setCurrentLanguage(langMap[ext]);
    }
  }, [currentFilename, currentLanguage]);

  const [compilerOutput, setCompilerOutput] = useState("");
  const [compilerError, setCompilerError] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 420, y: 80 });
  const [chatSize, setChatSize] = useState({ width: 400, height: 600 });
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const analysisTimeoutRef = useRef(null);
  const aiBackendRef = useRef(aiBackend); // Re-introducing aiBackendRef for Sensei
  const lineTimeoutRef = useRef(null);
  const senseiWidgetRef = useRef(null); // Ref to hold the Sensei content widget instance

  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [studentCode, setStudentCode] = useState(""); // Track code for visualizer

  const [editorPanelWidth, setEditorPanelWidth] = useState(70); // Percentage width for the editor panel
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    setEditorPanelWidth(Math.max(30, Math.min(90, newWidth))); // Clamp width between 30% and 90%
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => { // Re-introducing useEffect for aiBackendRef
    aiBackendRef.current = aiBackend;
  }, [aiBackend]);

  // Effect to update global theme attribute on body
  useEffect(() => {
    document.body.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Cleanup effect to purge .temp workspace on session refresh/close
  useEffect(() => {
    const handleCleanup = () => {
      navigator.sendBeacon("http://localhost:5000/api/cleanup");
    };
    window.addEventListener("beforeunload", handleCleanup);
    return () => window.removeEventListener("beforeunload", handleCleanup);
  }, []);

  const completion = useMemo(() => {
    if (!currentLesson.length) return 0;
    return Math.floor((progressIndex / currentLesson.length) * 100);
  }, [progressIndex, currentLesson]);

  const clearErrorDecoration = () => {
    const editor = studentEditorRef.current;
    if (!editor) return;
    errorDecorationRef.current = editor.deltaDecorations(errorDecorationRef.current, []);
  };

  const setErrorDecoration = (index) => {
    const editor = studentEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    const position = model.getPositionAt(index);

    errorDecorationRef.current = editor.deltaDecorations(
      errorDecorationRef.current,
      [
        {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + 1
          ),
          options: {
            inlineClassName: "error-char"
          }
        }
      ]
    );
  };

  const syncGhostScroll = (editor) => {
    const ghostEditor = ghostEditorRef.current;
    if (!ghostEditor) return;
    ghostEditor.setScrollTop(editor.getScrollTop());
    ghostEditor.setScrollLeft(editor.getScrollLeft());
  };

  const handleStudentMount = (editor, monaco) => {
    studentEditorRef.current = editor;
    monacoRef.current = monaco;
    syncGhostScroll(editor);

    // Initialize the Sensei content widget
    senseiWidgetRef.current = new SenseiContentWidget(editor, monaco, 'studentEditor');
    editor.addContentWidget(senseiWidgetRef.current);

    editor.onDidScrollChange(() => syncGhostScroll(editor));

    editor.onDidChangeModelContent((event) => {
      if (isApplyingRef.current) return;
      const model = editor.getModel();
      const value = model.getValue();
      const matchLength = getMatchLength(value, currentLesson);
      setProgressIndex(matchLength);
      setErrorIndex(null);
      clearErrorDecoration();
      setErrorMessage("");
      setCompileStatus("idle");

      // Update student code state for visualizer
      setStudentCode(value);

      // Update current line immediately for display purposes
      setCurrentLine(editor.getPosition().lineNumber);
    });

    // Sensei Trigger: onDidStopChangingModelContent for analysis
    editor.getModel().onDidChangeContent(() => { // fires after a pause in content changes
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      analysisTimeoutRef.current = setTimeout(async () => {
        const studentModel = studentEditorRef.current?.getModel();
        const ghostModel = ghostEditorRef.current?.getModel();
        const position = studentEditorRef.current?.getPosition();

        // Only show Sensei if there is a lesson active (ghost code present)
        if (!studentModel || !ghostModel || !position || !ghostModel.getValue().trim()) {
          if (senseiWidgetRef.current) senseiWidgetRef.current.hide();
          return;
        }

        const studentLine = studentModel.getLineContent(position.lineNumber);
        const ghostLine = ghostModel.getLineContent(position.lineNumber);

        if (!ghostLine.trim()) {
          if (senseiWidgetRef.current) senseiWidgetRef.current.hide();
          return;
        }

        let analysis = await getLineAnalysis(studentLine, ghostLine, aiBackendRef.current);

        if (analysis && senseiWidgetRef.current) {
          senseiWidgetRef.current.updateContent(analysis, position.lineNumber);
        } else if (senseiWidgetRef.current) {
          senseiWidgetRef.current.hide();
        }
      }, 700); // Debounce for 700ms
    });

    // Dispose of the widget when the editor is unmounted
    return () => {
      if (senseiWidgetRef.current) {
        editor.removeContentWidget(senseiWidgetRef.current);
        senseiWidgetRef.current.dispose();
        senseiWidgetRef.current = null;
      }
    };
  };

  const handleGhostMount = (editor) => {
    ghostEditorRef.current = editor;
    const studentEditor = studentEditorRef.current;
    if (studentEditor) {
      editor.setScrollTop(studentEditor.getScrollTop());
      editor.setScrollLeft(studentEditor.getScrollLeft());
    }
  };

  const handleClear = () => {
    setCurrentLesson("");
    setStudentCode("");
    setProgressIndex(0);
    setErrorIndex(null);
    setErrorCount(0);
    setErrorMessage("");
    setCompileStatus("idle");
    const editor = studentEditorRef.current;
    if (editor) {
      editor.setValue("");
    }
  };

  const handleGenerateCode = (result) => {
    const code = result?.code || "";
    setCurrentLesson(code);
    setCurrentLanguage(result?.language || "javascript");
    setCurrentFilename(result?.filename || "practice.js");
    setProgressIndex(0);
    setErrorIndex(null);
    setErrorCount(0);
    setErrorMessage("");
    setCompileStatus("idle");
    const editor = studentEditorRef.current;
    if (editor) {
      editor.setValue("");
    }
  };

  useEffect(() => {
    const initAI = async () => {
      const ollamaHealthy = await checkOllamaHealth();
      if (ollamaHealthy) {
        setAiBackend("ollama");
      } else {
        setAiBackend("local");
      }
    };
    initAI();
  }, []);

  const handleCompile = async () => {
    const editor = studentEditorRef.current;
    if (!editor) return;
    const value = editor.getValue();

    setCompilerOutput("");
    setCompilerError("");
    setIsCompiling(true);

    // Check exact match (case-insensitive)
    if (value.toLowerCase() === currentLesson.toLowerCase()) {
      setCompileStatus("success");
      setErrorIndex(null);
      clearErrorDecoration();
      setErrorMessage("");

      const selectedLanguageConfig = SUPPORTED_LANGUAGES.find(lang => lang.id === currentLanguage);
      const compileCommand = selectedLanguageConfig ? selectedLanguageConfig.compileCommand : "node"; // Default to node

      // Execute the code
      const result = await executeCode(value, currentLanguage, compileCommand, testInput);
      setIsCompiling(false);

      if (result.success) {
        setCompilerOutput(result.output || "(No output)");
        setCompilerError("");
        setTestOutput(result.output || "(No test output)"); // Update test output
      } else {
        setCompilerOutput("");
        setCompilerError(result.error || "Execution failed");
        setTestOutput(result.error || "Execution failed"); // Update test output
      }
      return;
    }

    // Character mismatch - show error
    const mismatchAt = getMismatchIndex(value, currentLesson);
    setCompileStatus("error");
    setErrorIndex(mismatchAt);
    setErrorCount((prev) => prev + 1);
    setErrorDecoration(mismatchAt);

    let hint = classifyError(value, currentLesson);

    if (aiBackend !== "none") {
      setIsLoadingExplanation(true);
      let aiExplanation = null;

      if (aiBackend === "ollama") {
        aiExplanation = await classifyErrorWithAI(value, currentLesson);
      } else if (aiBackend === "local") {
        aiExplanation = await generateErrorHint(value, currentLesson);
      }

      if (aiExplanation) {
        hint = aiExplanation;
      }
      setIsLoadingExplanation(false);
    }

    setErrorMessage(hint);
    setIsCompiling(false);
    setTestOutput(""); // Clear test output on compile error
  };

  return (
    <>
      <Background3D />
      <div className="app" style={{ "--ghost-opacity": opacity }}>
        {/* Floating Logo */}
        <img
          src="/vertex-logo.png"
          alt="Vertex"
          className="vertex-logo"
        />

        <div className="layout" style={{ gridTemplateColumns: `${editorPanelWidth}% 10px 1fr` }}>
          <section className="editor-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h2>Teacher's Slate</h2>
                <div className="filename-container">
                  {isEditingFilename ? (
                    <input
                      type="text"
                      className="filename-input"
                      value={currentFilename}
                      autoFocus
                      onBlur={() => setIsEditingFilename(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setIsEditingFilename(false);
                      }}
                      onChange={(e) => setCurrentFilename(e.target.value)}
                    />
                  ) : (
                    <span
                      className="file-badge clickable"
                      onClick={() => setIsEditingFilename(true)}
                    >
                      {currentFilename}
                    </span>
                  )}
                </div>
              </div>

              <div className="panel-actions">
                <button className="clear-button" onClick={handleClear}>
                  Clear
                </button>
              </div>

              <div className="theme-selector-container">
                <label htmlFor="theme-select">Theme:</label>
                <select
                  id="theme-select"
                  className="theme-selector"
                  value={currentTheme}
                  onChange={(e) => setCurrentTheme(e.target.value)}
                >
                  {SUPPORTED_THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="opacity">
                <label htmlFor="opacity">Ghost Opacity</label>
                <input
                  id="opacity"
                  type="range"
                  min="0"
                  max="0.3"
                  step="0.01"
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
                <span>{opacity.toFixed(2)}</span>
              </div>
            </div>
            <div className="editor-stack">
              <div className="ghost-layer">
                <Editor
                  height="100%"
                  defaultLanguage={currentLanguage}
                  value={currentLesson}
                  theme={currentTheme}
                  onMount={handleGhostMount}
                  options={{
                    fontSize: 15,
                    minimap: { enabled: false },
                    cursorBlinking: "solid",
                    wordWrap: "on",
                    autoClosingBrackets: "never",
                    autoClosingQuotes: "never",
                    quickSuggestions: false,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    readOnly: true,
                    domReadOnly: true,
                    renderLineHighlight: "none"
                  }}
                />
              </div>
              <div className="student-layer">
                <Editor
                  height="100%"
                  defaultLanguage={currentLanguage}
                  defaultValue=""
                  theme={currentTheme}
                  onMount={handleStudentMount}
                  options={{
                    fontSize: 15,
                    minimap: { enabled: false },
                    cursorBlinking: "solid",
                    wordWrap: "on",
                    autoClosingBrackets: "never",
                    autoClosingQuotes: "never",
                    quickSuggestions: false,
                    tabSize: 2,
                    scrollBeyondLastLine: false
                  }}
                />
                <CodeVisualizer
                  editor={studentEditorRef.current}
                  monaco={monacoRef.current}
                  code={studentCode}
                  language={currentLanguage}
                />
              </div>
            </div>
            {compileStatus === "error" && errorIndex !== null && (
              <div className="error-banner">
                Compilation failed at character {errorIndex + 1}. Review the hint and try again.
              </div>
            )}
            {compileStatus === "success" && (
              <div className="success-banner">Compilation successful. Great job!</div>
            )}
          </section>

          <div className="resizer" onMouseDown={handleMouseDown}></div>

          <Terminal
            code={studentCode}
            currentLanguage={currentLanguage}
            currentFilename={currentFilename}
          />

        </div>

        <ChatBot
          aiBackend={aiBackend}
          onGenerateCode={handleGenerateCode}
          position={chatPosition}
          size={chatSize}
          isMinimized={isChatMinimized}
          onPositionChange={setChatPosition}
          onSizeChange={setChatSize}
          onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
        />
      </div>
    </>
  );
};

export default App;
