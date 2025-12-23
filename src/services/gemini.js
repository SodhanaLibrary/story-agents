import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config.js";
import { createLogger } from "../utils/logger.js";
import { logPrompt } from "./promptLogger.js";

const logger = createLogger("Gemini");

let geminiClient = null;

/**
 * Gets or creates Gemini client instance
 * @returns {GoogleGenerativeAI}
 */
export function getGeminiClient() {
  if (!geminiClient) {
    if (!config.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return geminiClient;
}

/**
 * Generates a chat completion using Gemini
 * @param {Array} messages - Array of message objects (OpenAI format)
 * @param {object} options - Additional options
 * @returns {Promise<string>} - Generated response
 */
export async function generateCompletion(messages, options = {}) {
  const client = getGeminiClient();
  const modelName = options.model || config.gemini.model;
  const startTime = Date.now();

  logger.debug(`Gemini chat completion request (model: ${modelName})`);

  try {
    const model = client.getGenerativeModel({ model: modelName });
    const geminiMessages = convertToGeminiFormat(messages);

    const chat = model.startChat({
      history: geminiMessages.history,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096,
      },
    });

    const result = await chat.sendMessage(geminiMessages.lastMessage);
    const response = await result.response;
    const responseText = response.text();
    const durationMs = Date.now() - startTime;

    logger.debug("Gemini chat completion done");

    // Log to database
    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "completion",
      promptMessages: messages,
      responseText,
      durationMs,
      status: "success",
    });

    return responseText;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "completion",
      promptMessages: messages,
      durationMs,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

/**
 * Generates a JSON response using Gemini
 * @param {Array} messages - Array of message objects
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function generateJsonResponse(messages) {
  const client = getGeminiClient();
  const modelName = config.gemini.model;
  const startTime = Date.now();

  logger.debug(`Gemini JSON completion request (model: ${modelName})`);

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    const geminiMessages = convertToGeminiFormat(messages);

    const chat = model.startChat({
      history: geminiMessages.history,
    });

    const result = await chat.sendMessage(geminiMessages.lastMessage);
    const response = await result.response;
    const responseText = response.text();
    const durationMs = Date.now() - startTime;

    logger.debug("Gemini JSON completion done");

    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "json",
      promptMessages: messages,
      responseText,
      durationMs,
      status: "success",
    });

    return JSON.parse(responseText);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "json",
      promptMessages: messages,
      durationMs,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

/**
 * Generates a text response (supports vision/image inputs)
 * @param {Array} messages - Array of message objects (can include image content)
 * @param {object} options - Additional options
 * @returns {Promise<string>} - Generated text response
 */
export async function generateTextResponse(messages, options = {}) {
  const client = getGeminiClient();
  const modelName = options.model || config.gemini.model;
  const startTime = Date.now();

  logger.debug(`Gemini text/vision completion request (model: ${modelName})`);

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
      },
    });

    // Handle vision content
    const parts = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        parts.push({ text: `System: ${msg.content}` });
      } else if (msg.role === "user") {
        if (typeof msg.content === "string") {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const item of msg.content) {
            if (item.type === "text") {
              parts.push({ text: item.text });
            } else if (item.type === "image_url") {
              const imageData = await fetchImageAsBase64(item.image_url.url);
              parts.push({
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64,
                },
              });
            }
          }
        }
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text();
    const durationMs = Date.now() - startTime;

    logger.debug("Gemini text/vision completion done");

    // Log to database (exclude image data)
    const messagesForLog = messages.map((m) => {
      if (typeof m.content === "string") return m;
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map((c) =>
            c.type === "image_url" ? { type: "image_url", url: "[IMAGE]" } : c
          ),
        };
      }
      return m;
    });

    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "vision",
      promptMessages: messagesForLog,
      responseText,
      durationMs,
      status: "success",
    });

    return responseText;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "vision",
      durationMs,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

/**
 * Generates an image using Gemini Imagen
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<string>} - URL or base64 of generated image
 */
export async function generateImage(prompt, options = {}) {
  const client = getGeminiClient();
  const modelName = config.gemini.imageModel;
  const startTime = Date.now();

  logger.debug(`Gemini image generation request`);

  const model = client.getGenerativeModel({
    model: modelName,
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["image", "text"],
        imageSizes: [options.size || "1024x1024"],
      },
    });

    const response = await result.response;
    const durationMs = Date.now() - startTime;

    // Extract image from response
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        logger.debug("Gemini image generated successfully");

        logPrompt({
          provider: "gemini",
          model: modelName,
          requestType: "image",
          promptText: prompt,
          responseText: "[BASE64_IMAGE]",
          durationMs,
          status: "success",
          metadata: { size: options.size },
        });

        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated in response");
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Gemini image generation failed:", error.message);

    logPrompt({
      provider: "gemini",
      model: modelName,
      requestType: "image",
      promptText: prompt,
      durationMs,
      status: "error",
      errorMessage: error.message,
    });

    throw error;
  }
}

/**
 * Converts OpenAI message format to Gemini format
 * @param {Array} messages - OpenAI format messages
 * @returns {object} - Gemini format with history and lastMessage
 */
function convertToGeminiFormat(messages) {
  const history = [];
  let systemPrompt = "";
  let lastMessage = "";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") {
      systemPrompt = msg.content;
    } else if (msg.role === "user") {
      if (i === messages.length - 1) {
        // Last message - include system prompt if exists
        lastMessage = systemPrompt
          ? `${systemPrompt}\n\n${msg.content}`
          : msg.content;
      } else {
        history.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      }
    } else if (msg.role === "assistant") {
      history.push({
        role: "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  // If no user message at the end, use system prompt
  if (!lastMessage && systemPrompt) {
    lastMessage = systemPrompt;
  }

  return { history, lastMessage };
}

/**
 * Fetches image from URL and converts to base64
 * @param {string} url - Image URL
 * @returns {Promise<object>} - Object with mimeType and base64 data
 */
async function fetchImageAsBase64(url) {
  // Handle data URLs
  if (url.startsWith("data:")) {
    const matches = url.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      return { mimeType: matches[1], base64: matches[2] };
    }
  }

  // Fetch from URL
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  // Determine mime type from content-type header or URL
  let mimeType = response.headers.get("content-type") || "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    mimeType = "image/jpeg";
  } else if (url.endsWith(".png")) {
    mimeType = "image/png";
  } else if (url.endsWith(".webp")) {
    mimeType = "image/webp";
  }

  return { mimeType, base64 };
}

export default {
  getGeminiClient,
  generateCompletion,
  generateJsonResponse,
  generateTextResponse,
  generateImage,
};
