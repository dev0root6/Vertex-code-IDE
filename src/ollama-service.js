const OLLAMA_API = "http://localhost:11434/api";

export const generateExplanation = async (line, context = "") => {
  try {
    const response = await fetch(`${OLLAMA_API}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:1.5b",
        prompt: `Explain this code concisely (1-2 sentences) in its current language. Focus only on programming concepts: ${line}\n${context}`,
        stream: false,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("Ollama error:", error);
    return null;
  }
};

export const classifyErrorWithAI = async (userCode) => {
  try {
    const response = await fetch(`${OLLAMA_API}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:1.5b",
        prompt: `Check this code for errors and suggest fixes. If there's an error, mention it. If code is clean, say so.\n\nCode:\n${userCode}`,
        stream: false,
        temperature: 0.2,
        num_predict: 100
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("Ollama error:", error);
    return null;
  }
};

export const checkOllamaHealth = async () => {
  try {
    const response = await fetch(`${OLLAMA_API}/tags`);
    return response.ok;
  } catch {
    return false;
  }
};
