import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import config from "../config.js";
import { createLogger } from "../utils/logger.js";
import { logPrompt, getContext } from "./promptLogger.js";

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
  // Capture context at the start of the request
  const context = getContext();

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

    // Log to database with captured context
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
      ...context,
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
      ...context,
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
  // Capture context at the start of the request
  const context = getContext();

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

    // Log to database with captured context
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
      ...context,
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
      ...context,
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
  // Capture context at the start of the request
  const context = getContext();

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
      ...context,
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
      ...context,
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
  // Capture context at the start of the request
  const context = getContext();

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

    // Log to database with captured context
    logPrompt({
      provider: "openai",
      model,
      requestType: "image",
      promptText: prompt,
      responseText: imageUrl?.startsWith("http") ? imageUrl : "[BASE64_IMAGE]",
      durationMs,
      status: "success",
      metadata: { size, quality: options.quality, style: options.style },
      ...context,
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
      ...context,
    });
    throw error;
  }
}

/**
 * Generates an image using GPT Image model with reference images (avatars)
 * Uses images.generate API with image references for character consistency
 * @param {string} prompt - Image generation prompt
 * @param {Array<string>} referenceImagePaths - Array of paths to reference images (avatars)
 * @param {object} options - Generation options
 * @returns {Promise<{url: string, base64: string, model: string}>} - Generated image data
 */
export async function generateImageWithReferences(
  prompt,
  referenceImagePaths = [],
  options = {}
) {
  const client = getOpenAIClient();
  const model = options.model || "gpt-image-1.5";
  const size = options.size || config.image.size || "1024x1024";
  const weight = options.weight || 1; // Strong influence by default
  const startTime = Date.now();
  // Capture context at the start of the request
  const context = getContext();

  logger.debug(
    `Image generation with ${referenceImagePaths.length} reference images (model: ${model})`
  );
  logger.prompt("GPT Image Generate with References", prompt, {
    model,
    size,
    referenceCount: referenceImagePaths.length,
    weight,
  });

  try {
    // Load reference images as base64
    // const images = [];
    // for (const imgPath of referenceImagePaths) {
    //   if (fs.existsSync(imgPath)) {
    //     try {
    //       console.log("reading reference image:", imgPath);
    //       const imageData = fs.createReadStream(imgPath);
    //       images.push(imageData);
    //       logger.debug(`Loaded reference image: ${path.basename(imgPath)}`);
    //     } catch (err) {
    //       logger.warn(
    //         `Failed to load reference image ${imgPath}: ${err.message}`
    //       );
    //     }
    //   } else {
    //     logger.warn(`Reference image not found: ${imgPath}`);
    //   }
    // }

    const images = await Promise.all(
      referenceImagePaths.map(
        async (file) =>
          await toFile(fs.createReadStream(file), null, {
            type: "image/png",
          })
      )
    );

    if (images.length === 0) {
      logger.warn(
        "No valid reference images found, falling back to standard generation"
      );
      return await generateImage(prompt, options);
    }

    logger.debug(`Loaded ${images.length} reference images for generation`);

    // Log use of reference images before calling OpenAI API
    await logPrompt({
      provider: "openai",
      model,
      requestType: "image_generate_ref_pre",
      promptText: prompt,
      responseText: null,
      durationMs: Date.now() - startTime,
      status: "initiated",
      metadata: {
        size,
        referenceCount: images.length,
        referencePaths: referenceImagePaths,
        weight,
      },
      ...context,
    });

    // Use images.generate API with reference images
    const response = await client.images.edit({
      model,
      prompt,
      image: images,
      n: 1,
      size,
    });

    const durationMs = Date.now() - startTime;

    // Get the base64 image data
    const imageBase64 = response.data[0].b64_json;
    const imageUrl = response.data[0].url;

    logger.debug("Image with references generated successfully");

    // Log to database with captured context
    logPrompt({
      provider: "openai",
      model,
      requestType: "image_generate_ref",
      promptText: prompt,
      responseText: "[GPT_IMAGE_WITH_REFERENCES]",
      durationMs,
      status: "success",
      metadata: {
        size,
        referenceCount: images.length,
        referencePaths: referenceImagePaths,
        weight,
      },
      ...context,
    });

    return {
      url: imageUrl,
      base64: imageBase64,
      model,
    };
  } catch (error) {
    console.error(error);
    const durationMs = Date.now() - startTime;
    logger.error(`Image generation with references failed: ${error.message}`);

    logPrompt({
      provider: "openai",
      model,
      requestType: "image_generate_ref",
      promptText: prompt,
      durationMs,
      status: "error",
      errorMessage: error.message,
      metadata: { referenceCount: referenceImagePaths.length },
      ...context,
    });

    // Fallback to standard image generation if reference generation fails
    logger.warn("Falling back to standard image generation");
    // return await generateImage(
    //   options.enhancedPromptWithoutAvatarImage,
    //   options
    // );
    return null;
  }
}

/**
 * Saves a base64 image to file
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} outputPath - Path to save the image
 * @returns {string} - Saved file path
 */
export function saveBase64Image(base64Data, outputPath) {
  const imageBytes = Buffer.from(base64Data, "base64");
  fs.writeFileSync(outputPath, imageBytes);
  logger.debug(`Image saved to: ${outputPath}`);
  return outputPath;
}

export default {
  getOpenAIClient,
  generateCompletion,
  generateJsonResponse,
  generateTextResponse,
  generateImage,
  generateImageWithReferences,
  saveBase64Image,
};
