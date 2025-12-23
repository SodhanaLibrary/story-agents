/**
 * Unified AI Service - Automatically selects between OpenAI and Gemini
 * based on configuration
 */
import config from "../config.js";
import * as openaiService from "./openai.js";
import * as geminiService from "./gemini.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AI");

/**
 * Gets the current AI provider based on configuration
 * @returns {string} - "openai" or "gemini"
 */
export function getProvider() {
  return config.aiProvider || "openai";
}

/**
 * Gets the appropriate service based on provider
 * @param {string} provider - Optional provider override
 * @returns {object} - Service module
 */
function getService(provider) {
  const p = provider || getProvider();
  if (p === "gemini") {
    return geminiService;
  }
  return openaiService;
}

/**
 * Generates a chat completion
 * @param {Array} messages - Array of message objects
 * @param {object} options - Additional options (can include 'provider' to override)
 * @returns {Promise<string>} - Generated response
 */
export async function generateCompletion(messages, options = {}) {
  const service = getService(options.provider);
  logger.debug(`Using ${options.provider || getProvider()} for completion`);
  return service.generateCompletion(messages, options);
}

/**
 * Generates a JSON response
 * @param {Array} messages - Array of message objects
 * @param {object} schema - JSON schema (optional, mainly for OpenAI)
 * @param {object} options - Additional options (can include 'provider' to override)
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function generateJsonResponse(messages, schema, options = {}) {
  const service = getService(options?.provider);
  logger.debug(
    `Using ${options?.provider || getProvider()} for JSON completion`
  );
  return service.generateJsonResponse(messages, schema);
}

/**
 * Generates a text response (supports vision/image inputs)
 * @param {Array} messages - Array of message objects
 * @param {object} options - Additional options (can include 'provider' to override)
 * @returns {Promise<string>} - Generated text response
 */
export async function generateTextResponse(messages, options = {}) {
  const service = getService(options.provider);
  logger.debug(
    `Using ${options.provider || getProvider()} for text/vision completion`
  );
  return service.generateTextResponse(messages, options);
}

/**
 * Generates an image
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options (can include 'provider' to override)
 * @returns {Promise<string>} - URL or base64 of generated image
 */
export async function generateImage(prompt, options = {}) {
  // Default to OpenAI for image generation as it's more reliable
  const provider =
    options.provider || (config.openai.apiKey ? "openai" : getProvider());
  const service = getService(provider);
  logger.debug(`Using ${provider} for image generation`);
  return service.generateImage(prompt, options);
}

/**
 * Checks which providers are available based on API keys
 * @returns {object} - Object with available providers
 */
export function getAvailableProviders() {
  return {
    openai: !!config.openai.apiKey,
    gemini: !!config.gemini.apiKey,
    current: getProvider(),
  };
}

export default {
  getProvider,
  getAvailableProviders,
  generateCompletion,
  generateJsonResponse,
  generateTextResponse,
  generateImage,
};
