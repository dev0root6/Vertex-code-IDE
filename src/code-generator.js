const codingKeywords = [
  "code",
  "function",
  "class",
  "variable",
  "loop",
  "array",
  "string",
  "algorithm",
  "api",
  "sql",
  "javascript",
  "python",
  "java",
  "c#",
  "c",
  "c++",
  "typescript",
  "bug",
  "error",
  "compile",
  "debug",
  "program",
  "binary",
  "json",
  "regex",
  "frontend",
  "backend",
  "react",
  "node",
  "html",
  "css"
];

const languageHints = {
  python: ["python", "py", "pandas", "numpy", "django", "flask"],
  java: ["java", "spring", "jdk"],
  javascript: ["javascript", "js", "node", "react", "express"],
  typescript: ["typescript", "ts"],
  c: [" c ", "c language", "printf", "scanf"],
  cpp: ["c++", "cpp", "iostream", "std::"],
  csharp: ["c#", "csharp", "dotnet", ".net"],
  go: ["golang", "go", "goroutine"],
  rust: ["rust", "cargo"],
  php: ["php", "laravel"],
  ruby: ["ruby", "rails"],
  kotlin: ["kotlin"],
  swift: ["swift"],
  sql: ["sql", "select", "database"],
  html: ["html"],
  css: ["css", "stylesheet"]
};

const filenameMap = {
  python: "practice.py",
  java: "practice.java",
  javascript: "practice.js",
  typescript: "practice.ts",
  c: "practice.c",
  cpp: "practice.cpp",
  csharp: "practice.cs",
  go: "main.go",
  rust: "main.rs",
  php: "practice.php",
  ruby: "practice.rb",
  kotlin: "practice.kt",
  swift: "practice.swift",
  sql: "practice.sql",
  html: "practice.html",
  css: "practice.css"
};

const detectLanguageFromPrompt = (prompt) => {
  const lower = prompt.toLowerCase();
  for (const [language, hints] of Object.entries(languageHints)) {
    if (hints.some((hint) => lower.includes(hint.trim()))) {
      return language;
    }
  }
  return null;
};

const detectLanguageFromCode = (code) => {
  if (!code) return null;
  const lower = code.toLowerCase();
  if (lower.includes("def ") || lower.includes("import ") || lower.includes("print(")) return "python";
  if (lower.includes("public class") || lower.includes("system.out")) return "java";
  if (lower.includes("console.log") || lower.includes("function ")) return "javascript";
  if (lower.includes("#include") && lower.includes("stdio")) return "c";
  if (lower.includes("#include") && lower.includes("iostream")) return "cpp";
  if (lower.includes("using system")) return "csharp";
  if (lower.includes("package main") || lower.includes("fmt.")) return "go";
  if (lower.includes("fn main") || lower.includes("println!")) return "rust";
  if (lower.includes("<?php")) return "php";
  if (lower.includes("puts ") || lower.includes("def ") && lower.includes("end")) return "ruby";
  if (lower.includes("fun main") || lower.includes("println(")) return "kotlin";
  if (lower.includes("import foundation") || lower.includes("print(")) return "swift";
  if (lower.includes("select ") || lower.includes("from ")) return "sql";
  if (lower.includes("<html") || lower.includes("<!doctype")) return "html";
  if (lower.includes("{\n  ") && lower.includes("color:")) return "css";
  return null;
};

const finalizeResult = (prompt, result) => {
  const detected = detectLanguageFromPrompt(prompt) || detectLanguageFromCode(result.code) || "javascript";
  return {
    ...result,
    language: detected,
    filename: filenameMap[detected] || "practice.txt"
  };
};

export const isCodingPrompt = (prompt) => {
  const lower = prompt.toLowerCase();
  return codingKeywords.some((keyword) => lower.includes(keyword));
};

export const generateCodeFromPrompt = async (prompt, aiBackend) => {
  if (!isCodingPrompt(prompt)) {
    return { code: null, explanation: "Please ask a programming or coding-related question only." };
  }
  if (aiBackend === "ollama") {
    const result = await generateViaOllama(prompt);
    return finalizeResult(prompt, result);
  } else if (aiBackend === "local") {
    const result = await generateViaLocal(prompt);
    return finalizeResult(prompt, result);
  }
  return { code: null, explanation: null, language: "javascript", filename: "practice.js" };
};

const generateViaOllama = async (prompt) => {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:1.5b",
        prompt: `${prompt}\n\nProvide a brief explanation of the code. The code must not contain any comments. If the code requires user input, make sure to include the appropriate input function (e.g., \`input()\` in Python, \`scanf()\` in C, \`prompt()\` in JavaScript) as mandatory.
FORMAT:
### Explanation
[explanation]

### Code
\`\`\`language
[code]
\`\`\``,
        stream: false,
        temperature: 0.3,
        num_predict: 300
      })
    });

    if (!response.ok) throw new Error("Ollama error");
    const data = await response.json();
    const output = data.response || "";

    console.log("Ollama response:", output);

    let code = "";
    let explanation = "";
    let tempOutput = output;

    // --- New Parsing Logic Order ---

    // 1. First, try to extract any fenced code block (```language ... ```)
    let fencedMatch = tempOutput.match(/```(?:python|javascript|java|c\+\+|c|typescript|go|rust|php|ruby|kotlin|swift|sql|html|css|bash|sh|c|markdown)?\n([\s\S]*?)```/);
    if (fencedMatch) {
      code = removeComments(fencedMatch[1].trim());
      explanation = tempOutput.replace(fencedMatch[0], "").trim();
      // Remove ### Explanation header from explanation if it exists
      const expHeaderIndex = explanation.indexOf("### Explanation");
      if (expHeaderIndex !== -1) {
        explanation = explanation.substring(expHeaderIndex + "### Explanation".length).trim();
      }
    } else {
      // 2. If no fenced code, try to extract based on ### Code and ### Explanation tags
      const codeStartTag = "### Code";
      const explanationStartTag = "### Explanation";

      const codeStartIndex = tempOutput.indexOf(codeStartTag);
      const explanationStartIndex = tempOutput.indexOf(explanationStartTag);

      if (codeStartIndex !== -1) {
        let codeBlock = tempOutput.substring(codeStartIndex + codeStartTag.length).trim();
        // Remove markdown code fences just in case (though should be caught by first step)
        codeBlock = codeBlock.replace(/```(?:python|javascript|java|c\+\+|c|typescript|go|rust|php|ruby|kotlin|swift|sql|html|css|bash|sh|c|markdown)?\n/g, "").replace(/```/g, "");
        code = removeComments(codeBlock.trim());

        explanation = tempOutput.substring(0, codeStartIndex).trim();
        if (explanationStartIndex !== -1) {
          explanation = explanation.substring(explanationStartIndex + explanationStartTag.length).trim();
        }
      } else if (explanationStartIndex !== -1) {
        // Only explanation tag found, no code tag
        explanation = tempOutput.substring(explanationStartIndex + explanationStartTag.length).trim();
        // If explanation is everything, check if it contains code-like lines
        const lines = explanation.split('\n');
        let potentialCodeLines = [];
        let potentialExplanationLines = [];
        let inCodeBlockHeuristic = true;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (inCodeBlockHeuristic && (
            trimmedLine.startsWith('def ') || trimmedLine.startsWith('function ') ||
            trimmedLine.startsWith('class ') || trimmedLine.startsWith('public ') ||
            trimmedLine.startsWith('int ') || trimmedLine.startsWith('var ') ||
            trimmedLine.startsWith('let ') || trimmedLine.startsWith('const ') ||
            trimmedLine.startsWith('#include') || trimmedLine.startsWith('import ') ||
            trimmedLine.match(/^\s*([a-zA-Z_]\w*\s*)+\(/)
          )) {
            potentialCodeLines.push(line);
          } else if (trimmedLine.length > 0) {
            inCodeBlockHeuristic = false;
            potentialExplanationLines.push(line);
          } else {
            if (inCodeBlockHeuristic && potentialCodeLines.length > 0) {
              potentialCodeLines.push(line);
            } else {
              potentialExplanationLines.push(line);
            }
          }
        }
        if (potentialCodeLines.length > 0) {
          code = removeComments(potentialCodeLines.join('\n').trim());
          explanation = potentialExplanationLines.join('\n').trim();
        } else {
          code = null; // No discernible code even with heuristic
        }

      } else {
        // 3. No tags and no fenced code block, apply heuristic to raw output
        const lines = tempOutput.split('\n');
        let potentialCodeLines = [];
        let potentialExplanationLines = [];
        let inCodeBlockHeuristic = true; // Assume it starts with code if no delimiters

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (inCodeBlockHeuristic && (
            trimmedLine.startsWith('def ') || trimmedLine.startsWith('function ') ||
            trimmedLine.startsWith('class ') || trimmedLine.startsWith('public ') ||
            trimmedLine.startsWith('int ') || trimmedLine.startsWith('var ') ||
            trimmedLine.startsWith('let ') || trimmedLine.startsWith('const ') ||
            trimmedLine.startsWith('#include') || trimmedLine.startsWith('import ') ||
            trimmedLine.match(/^\s*([a-zA-Z_]\w*\s*)+\(/)
          )) {
            potentialCodeLines.push(line);
          } else if (trimmedLine.length > 0) {
            inCodeBlockHeuristic = false;
            potentialExplanationLines.push(line);
          } else { // empty line
            if (inCodeBlockHeuristic && potentialCodeLines.length > 0) {
              potentialCodeLines.push(line);
            } else {
              potentialExplanationLines.push(line);
            }
          }
        }

        if (potentialCodeLines.length > 0 && potentialExplanationLines.length > 0) {
          code = removeComments(potentialCodeLines.join('\n').trim());
          explanation = potentialExplanationLines.join('\n').trim();
        } else if (potentialCodeLines.length > 0) {
          code = removeComments(potentialCodeLines.join('\n').trim());
          explanation = "Code generated successfully."; // Default explanation
        } else if (potentialExplanationLines.length > 0) {
          explanation = potentialExplanationLines.join('\n').trim();
          code = null;
        } else {
          explanation = "Could not parse response.";
          code = null;
        }
      }
    }

    console.log("Extracted code:", code);
    console.log("Explanation:", explanation);

    return { code: code || null, explanation: explanation || "Code generated successfully" };
  } catch (error) {
    console.error("Ollama error:", error);
    return { code: null, explanation: "Error generating code. Is Ollama running?" };
  }
};

const generateViaLocal = async (prompt) => {
  try {
    const { pipeline } = await import("@xenova/transformers");
    const generator = await pipeline("text-generation", "Xenova/distilgpt2");

    const result = await generator(
      `Code for: ${prompt}`,
      { max_new_tokens: 80, temperature: 0.5 }
    );

    let code = result[0].generated_text;
    code = code.split("Code for:")[1] || code;
    return { code: sanitizeCode(code), explanation: null };
  } catch (error) {
    console.error("Local generation error:", error);
    return { code: null, explanation: null };
  }
};

const parseGeneratedOutput = (output) => {
  if (!output) return { code: null, explanation: null };

  const fencedMatch = output.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (fencedMatch) {
    const code = sanitizeCode(fencedMatch[1]);
    const explanation = output.replace(fencedMatch[0], "").trim() || null;
    return { code, explanation };
  }

  const explanationMatch = output.match(/EXPLANATION:\s*([\s\S]*)$/i);
  const explanation = explanationMatch ? explanationMatch[1].trim() : null;
  const trimmedOutput = explanationMatch ? output.replace(explanationMatch[0], "").trim() : output;

  const lines = trimmedOutput.split("\n");
  const codeLines = lines.filter(
    (line) => /[;{}=()]/.test(line) || line.startsWith("def ") || line.startsWith("class ")
  );
  const code = sanitizeCode(codeLines.join("\n") || trimmedOutput);
  return { code, explanation };
};

const sanitizeCode = (code) => {
  if (!code) return null;
  return code.trim();
};

const removeComments = (code) => {
  if (!code) return null;

  let cleaned = code;
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/#(?!include|define|pragma).*$/gm, '');

  const lines = cleaned.split('\n');
  const nonEmpty = lines.filter(line => line.trim().length > 0);

  return nonEmpty.join('\n').trim();
};

const generateLineAnalysisViaOllama = async (studentLine, ghostLine) => {
  try {
    const prompt = `You are a coding sensei. Provide a very short motivational quote, praise, or encouragement based on the student's progress.
Expected line: "${ghostLine}"
Actual line: "${studentLine}"

If the student is correct, give a high-five or praise. If they are stuck, give a short 1-sentence motivational boost.
CRITICAL: strictly 10 to 20 words maximum. No explanations, just motivation.`;

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:1.5b",
        prompt: prompt,
        stream: false,
        temperature: 0.7,
        num_predict: 50
      })
    });

    if (!response.ok) throw new Error("Ollama error");
    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("Ollama analysis error:", error);
    return null;
  }
};

const generateLineAnalysisViaLocal = async (studentLine, ghostLine) => {
  try {
    return "Great progress! Keep going, you're doing amazing!";
  } catch (error) {
    console.error("Local analysis error:", error);
    return null;
  }
};

export const getLineAnalysis = async (studentLine, ghostLine, aiBackend) => {
  if (!ghostLine.trim()) {
    return null;
  }

  if (aiBackend === "ollama") {
    return await generateLineAnalysisViaOllama(studentLine, ghostLine);
  } else if (aiBackend === "local") {
    return await generateLineAnalysisViaLocal(studentLine, ghostLine);
  }

  return null;
};

export const analyzeMistake = async (typed, expected, aiBackend) => {
  const mismatchIndex = typed.split("").findIndex((char, i) => char !== expected[i]);

  if (mismatchIndex === -1) return null;

  const context = {
    expected: expected.slice(Math.max(0, mismatchIndex - 5), mismatchIndex + 10),
    typed: typed.slice(Math.max(0, mismatchIndex - 5), mismatchIndex + 5),
    position: mismatchIndex
  };

  if (aiBackend === "ollama") {
    return await analyzeViaOllama(context);
  } else if (aiBackend === "local") {
    return await analyzeViaLocal(context);
  }

  return null;
};

const analyzeViaOllama = async (context) => {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:1.5b",
        prompt: `At position ${context.position}, expected "${context.expected}" but got "${context.typed}". What's the error?`,
        stream: false,
        temperature: 0.3
      })
    });

    if (!response.ok) throw new Error("Ollama error");
    const data = await response.json();
    return data.response.trim().slice(0, 100);
  } catch (error) {
    console.error("Ollama analysis error:", error);
    return null;
  }
};

const analyzeViaLocal = async (context) => {
  try {
    const { pipeline } = await import("@xenova/transformers");
    const qa = await pipeline("question-answering", "Xenova/distilbert-base-uncased-distilled-squad");

    const result = await qa(
      "What is the syntax error?",
      `Expected: ${context.expected}, Got: ${context.typed}`
    );

    return result.answer.slice(0, 80);
  } catch (error) {
    console.error("Local analysis error:", error);
    return null;
  }
};
