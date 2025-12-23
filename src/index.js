import {
  StoryOrchestrator,
  CharacterAgent,
  AvatarAgent,
  PageAgent,
  IllustrationAgent,
  ArtStyleAgent,
  ART_STYLES,
} from "./agents/index.js";
import config from "./config.js";
import { createLogger, logger, requestLogger } from "./utils/logger.js";

/**
 * Creates a configured StoryOrchestrator instance
 * @param {object} options - Configuration options
 * @returns {StoryOrchestrator}
 */
export function createStoryGenerator(options = {}) {
  return new StoryOrchestrator(options);
}

/**
 * Simple function to generate a complete story
 * @param {string} story - Input story text
 * @param {object} options - Generation options
 * @returns {Promise<object>} - Generated story with all assets
 */
export async function generateStory(story, options = {}) {
  const orchestrator = createStoryGenerator(options);
  return await orchestrator.generateStory(story);
}

/**
 * Analyze a story and get art style recommendation
 * @param {string} story - Input story text
 * @returns {Promise<object>} - Art style recommendation
 */
export async function analyzeStoryStyle(story) {
  const artStyleAgent = new ArtStyleAgent();
  return await artStyleAgent.analyzeAndRecommend(story);
}

/**
 * Get all available art styles
 * @returns {object} - All available art styles
 */
export function getAvailableStyles() {
  return ART_STYLES;
}

// Export all agents and utilities
export {
  StoryOrchestrator,
  CharacterAgent,
  AvatarAgent,
  PageAgent,
  IllustrationAgent,
  ArtStyleAgent,
  ART_STYLES,
  config,
  // Logger utilities
  createLogger,
  logger,
  requestLogger,
};

// Default export
export default {
  createStoryGenerator,
  generateStory,
  analyzeStoryStyle,
  getAvailableStyles,
  StoryOrchestrator,
  CharacterAgent,
  AvatarAgent,
  PageAgent,
  IllustrationAgent,
  ArtStyleAgent,
  ART_STYLES,
  config,
  createLogger,
  logger,
  requestLogger,
};
