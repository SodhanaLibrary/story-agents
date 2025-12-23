import OpenAI from "openai";
import config from "../config.js";
import { createLogger } from "../utils/logger.js";
import { logPrompt } from "./promptLogger.js";

const logger = createLogger("OpenAI");

let openaiClient = null;

/**
 * Gets or creates OpenAI client instance
 * @returns {OpenAI}
 */
export function getOpenAIClient() {
  if (!openaiClient) {
    if (!config.openai.apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

/**
 * Generates a chat completion
 * @param {Array} messages - Array of message objects
 * @param {object} options - Additional options
 * @returns {Promise<string>} - Generated response
 */
export async function generateCompletion(messages, options = {}) {
  const client = getOpenAIClient();
  const model = options.model || config.openai.model;
  const startTime = Date.now();

  logger.debug(`Chat completion request (model: ${model})`);
  logger.prompt("Chat Completion", messages, {
    model,
    temperature: options.temperature ?? 0.7,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      response_format: options.responseFormat,
    });

    const responseText = response.choices[0].message.content;
    const durationMs = Date.now() - startTime;

    logger.debug(
      `Chat completion done (tokens: ${response.usage?.total_tokens || "N/A"})`
    );

    // Log to database
    logPrompt({
      provider: "openai",
      model,
      requestType: "completion",
      promptMessages: messages,
      responseText,
      tokensInput: response.usage?.prompt_tokens,
      tokensOutput: response.usage?.completion_tokens,
      tokensTotal: response.usage?.total_tokens,
      durationMs,
      status: "success",
    });

    return responseText;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "openai",
      model,
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
 * Generates a JSON response using structured output
 * @param {Array} messages - Array of message objects
 * @param {object} schema - JSON schema for the response
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function generateJsonResponse(messages, schema) {
  const client = getOpenAIClient();
  const model = config.openai.model;
  const startTime = Date.now();

  logger.debug(`JSON completion request (model: ${model})`);
  logger.prompt("JSON Completion", messages, {
    model,
    format: "json_object",
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4096,
    });

    const responseText = response.choices[0].message.content;
    const durationMs = Date.now() - startTime;

    logger.debug(
      `JSON completion done (tokens: ${response.usage?.total_tokens || "N/A"})`
    );

    // Log to database
    logPrompt({
      provider: "openai",
      model,
      requestType: "json",
      promptMessages: messages,
      responseText,
      tokensInput: response.usage?.prompt_tokens,
      tokensOutput: response.usage?.completion_tokens,
      tokensTotal: response.usage?.total_tokens,
      durationMs,
      status: "success",
    });

    return JSON.parse(responseText);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "openai",
      model,
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
  const client = getOpenAIClient();
  const model = options.model || "gpt-4o";
  const startTime = Date.now();

  logger.debug(`Text/Vision completion request (model: ${model})`);
  logger.prompt("Text/Vision Completion", messages, {
    model,
    temperature: options.temperature ?? 0.7,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    });

    const responseText = response.choices[0].message.content;
    const durationMs = Date.now() - startTime;

    logger.debug(
      `Text/Vision completion done (tokens: ${response.usage?.total_tokens || "N/A"})`
    );

    // Log to database (exclude image data from messages for storage efficiency)
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
      provider: "openai",
      model,
      requestType: "vision",
      promptMessages: messagesForLog,
      responseText,
      tokensInput: response.usage?.prompt_tokens,
      tokensOutput: response.usage?.completion_tokens,
      tokensTotal: response.usage?.total_tokens,
      durationMs,
      status: "success",
    });

    return responseText;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "openai",
      model,
      requestType: "vision",
      durationMs,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

/**
 * Generates an image using DALL-E
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<string>} - URL or base64 of generated image
 */
export async function generateImage(prompt, options = {}) {
  const client = getOpenAIClient();
  const model = config.openai.imageModel;
  const size = options.size || config.image.size;
  const startTime = Date.now();

  logger.debug(`Image generation request (size: ${size})`);
  logger.prompt("DALL-E Image Generation", prompt, {
    model,
    size,
    quality: options.quality || config.image.quality,
    style: options.style || config.image.style,
  });

  try {
    const response = await client.images.generate({
      model,
      prompt,
      n: 1,
      size,
      quality: options.quality || config.image.quality,
      style: options.style || config.image.style,
      response_format: options.responseFormat || "url",
    });

    const imageUrl = response.data[0].url || response.data[0].b64_json;
    const durationMs = Date.now() - startTime;

    logger.debug("Image generated successfully");

    // Log to database
    logPrompt({
      provider: "openai",
      model,
      requestType: "image",
      promptText: prompt,
      responseText: imageUrl?.startsWith("http") ? imageUrl : "[BASE64_IMAGE]",
      durationMs,
      status: "success",
      metadata: { size, quality: options.quality, style: options.style },
    });

    return imageUrl;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logPrompt({
      provider: "openai",
      model,
      requestType: "image",
      promptText: prompt,
      durationMs,
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}

export default {
  getOpenAIClient,
  generateCompletion,
  generateJsonResponse,
  generateTextResponse,
  generateImage,
};
