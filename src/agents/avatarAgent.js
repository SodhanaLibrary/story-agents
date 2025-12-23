import { generateImage } from "../services/ai.js";
import { saveImageFromUrl } from "../utils/storage.js";

/**
 * Avatar Agent - Generates and saves character avatar images
 */
export class AvatarAgent {
  constructor() {
    this.name = "AvatarAgent";
    this.description = "Generates avatar images for characters using DALL-E";
  }

  /**
   * Generates avatar image for a single character
   * @param {object} character - Character object with avatarPrompt
   * @returns {Promise<object>} - Character with generated avatar path
   */
  async generateAvatar(character) {
    const enhancedPrompt = this.enhancePromptForConsistency(
      character.avatarPrompt
    );

    const imageUrl = await generateImage(enhancedPrompt, {
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const savedPath = await saveImageFromUrl(
      imageUrl,
      "avatar",
      character.name
    );

    return {
      ...character,
      avatarUrl: imageUrl,
      avatarPath: savedPath,
    };
  }

  /**
   * Generates avatars for multiple characters
   * @param {Array} characters - Array of character objects
   * @param {Function} onProgress - Progress callback (characterName, index, total)
   * @returns {Promise<Array>} - Array of characters with avatar paths
   */
  async generateAvatars(characters, onProgress = null) {
    const results = [];

    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];

      if (onProgress) {
        onProgress(character.name, i + 1, characters.length);
      }

      const characterWithAvatar = await this.generateAvatar(character);
      results.push(characterWithAvatar);

      // Small delay to avoid rate limiting
      if (i < characters.length - 1) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * Enhances prompt for better consistency
   * @param {string} prompt - Original prompt
   * @returns {string} - Enhanced prompt
   */
  enhancePromptForConsistency(prompt) {
    const styleGuide = `SOLO CHARACTER ONLY - single character portrait, no other characters or people in the image. Clean plain solid color background (white, light gray, or soft gradient). Centered composition, character facing slightly toward camera. High quality, detailed features, consistent lighting. Professional storybook character illustration. NO background elements, NO scenery, NO other objects - just the character on a clean background.`;

    return `${styleGuide} Character: ${prompt}`;
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default AvatarAgent;
