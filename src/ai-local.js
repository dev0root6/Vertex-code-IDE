import { pipeline } from "@xenova/transformers";

let textGenerationPipeline = null;

const initializeModel = async () => {
  if (!textGenerationPipeline) {
    textGenerationPipeline = await pipeline(
      "text-generation",
      "Xenova/distilgpt2"
    );
  }
  return textGenerationPipeline;
};

export const generateErrorHint = async (userCode) => {
  try {
    await initializeModel();
    
    const prompt = `Analyze this code for errors and suggest fixes:\n${userCode}`;
    const result = await textGenerationPipeline(prompt, {
      max_new_tokens: 50,
      temperature: 0.3
    });

    return result[0].generated_text.slice(prompt.length).trim();
  } catch (error) {
    console.error("AI generation error:", error);
    return null;
  }
};

export const generateLineExplanation = async (line) => {
  try {
    await initializeModel();
    
    const prompt = `Explain this code: ${line}`;
    const result = await textGenerationPipeline(prompt, {
      max_new_tokens: 40,
      temperature: 0.3
    });

    return result[0].generated_text.slice(prompt.length).trim();
  } catch (error) {
    console.error("AI explanation error:", error);
    return null;
  }
};
