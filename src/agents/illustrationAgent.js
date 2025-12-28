import {
  generateImage,
  generateImageWithReferences,
  saveBase64Image,
} from "../services/ai.js";
import { saveImageFromUrl, getStoragePath } from "../utils/storage.js";
import { createLogger } from "../utils/logger.js";
import path from "path";

const logger = createLogger("IllustrationAgent");

/**
 * Illustration Agent - Generates page illustrations based on descriptions
 * with enhanced character consistency using avatar reference images
 */
export class IllustrationAgent {
  constructor() {
    this.name = "IllustrationAgent";
    this.description =
      "Generates page illustrations with consistent character appearances using avatar references";

    // Store character reference for consistency across pages
    this.characterReference = null;

    // Enable/disable avatar reference mode (uses GPT Image model)
    this.useAvatarReferences = true;
  }

  /**
   * Sets the character reference for consistent illustration generation
   * @param {Array} characters - Array of character objects with visual details and avatar paths
   */
  setCharacterReference(characters) {
    this.characterReference = characters;

    // Log available avatar paths
    const avatarPaths = characters
      .filter((c) => c.avatarPath)
      .map((c) => `${c.name}: ${c.avatarPath}`);

    if (avatarPaths.length > 0) {
      logger.debug(`Avatar references set: ${avatarPaths.join(", ")}`);
    }
  }

  /**
   * Gets avatar file paths for characters in the scene
   * @param {Array} charactersInScene - Names of characters appearing in this scene
   * @returns {Array<string>} - Array of avatar file paths
   */
  getAvatarPaths(charactersInScene = []) {
    if (!this.characterReference || this.characterReference.length === 0) {
      return [];
    }

    // Find characters in the scene that have avatar paths
    const avatarPaths = [];

    for (const charName of charactersInScene) {
      const character = this.characterReference.find(
        (c) => c.name.toLowerCase() === charName.toLowerCase()
      );

      if (character?.avatarPath) {
        avatarPaths.push(character.avatarPath);
      }
    }

    // If no specific characters found, use main character avatars
    if (avatarPaths.length === 0) {
      const mainChars = this.characterReference.filter(
        (c) => c.role === "main" && c.avatarPath
      );
      avatarPaths.push(...mainChars.map((c) => c.avatarPath));
    }

    return avatarPaths;
  }

  /**
   * Builds a character consistency block for the prompt
   * @param {Array} charactersInScene - Names of characters appearing in this scene
   * @returns {string} - Character consistency instructions
   */
  buildCharacterConsistencyBlock(charactersInScene = []) {
    if (!this.characterReference || this.characterReference.length === 0) {
      return "";
    }

    // Build reference for characters in this scene
    const relevantChars = this.characterReference.filter((char) =>
      charactersInScene.some(
        (name) => name.toLowerCase() === char.name.toLowerCase()
      )
    );

    if (relevantChars.length === 0) {
      // If no specific characters listed, include main characters
      const mainChars = this.characterReference.filter(
        (c) => c.role === "main"
      );
      if (mainChars.length > 0) {
        relevantChars.push(...mainChars);
      }
    }

    if (relevantChars.length === 0) return "";

    const charDescriptions = relevantChars.map((char) => {
      // Prefer detailed visual identity if available
      if (char.visualIdentity) {
        const vi = char.visualIdentity;
        const parts = [`${char.name}:`];

        if (vi.hairColor && vi.hairStyle)
          parts.push(`${vi.hairColor} ${vi.hairStyle} hair`);
        if (vi.skinTone) parts.push(`${vi.skinTone} skin`);
        if (vi.eyeColor) parts.push(`${vi.eyeColor} eyes`);
        if (vi.distinctiveFeatures?.length)
          parts.push(vi.distinctiveFeatures.slice(0, 2).join(", "));
        if (vi.primaryOutfit?.top)
          parts.push(`wearing ${vi.primaryOutfit.top}`);

        return parts.join(" ");
      }

      // Fallback to consistencyTag
      if (char.consistencyTag) {
        return `${char.name}: ${char.consistencyTag}`;
      }

      // Final fallback to avatarPrompt excerpt
      return `${char.name}: ${(char.avatarPrompt || char.description || "").substring(0, 80)}`;
    });

    return `[CHARACTER CONSISTENCY - These EXACT appearances MUST be maintained:
${charDescriptions.join("\n")}]
`;
  }

  /**
   * Generates illustration for a single page with character consistency and action focus
   * Uses avatar reference images when available for better character consistency
   * @param {object} page - Page object with imageDescription, action, emotion
   * @param {string} storyTitle - Title of the story (for naming)
   * @param {object} options - Generation options
   * @returns {Promise<object>} - Page with generated illustration path
   */
  async generatePageIllustration(page, storyTitle, options = {}) {
    const artStyle =
      options.artStyle ||
      "children's book illustration style, colorful, warm, friendly";

    const charactersInScene = page.charactersInScene || page.characters || [];

    // Build character consistency block
    const characterBlock =
      this.buildCharacterConsistencyBlock(charactersInScene);

    // Get avatar paths for characters in this scene
    const avatarPaths = this.getAvatarPaths(charactersInScene);
    // Pass page data including action and emotion
    const enhancedPrompt = this.buildIllustrationPromptWithAvatarImage(
      page.imageDescription,
      artStyle,
      characterBlock,
      {
        action: page.action,
        emotion: page.emotion || page.mood,
        scene: page.scene,
      }
    );
    // Pass page data including action and emotion
    const enhancedPromptWithoutAvatarImage = this.buildIllustrationPrompt(
      page.imageDescription,
      artStyle,
      characterBlock,
      {
        action: page.action,
        emotion: page.emotion || page.mood,
        scene: page.scene,
      }
    );

    let imageUrl;
    let savedPath;
    let usedAvatarReferences = false;

    // Use avatar references if available and enabled
    if (this.useAvatarReferences && avatarPaths.length > 0) {
      logger.debug(
        `Using ${avatarPaths.length} avatar references for page ${page.pageNumber}`
      );
      try {
        const result = await generateImageWithReferences(
          enhancedPrompt,
          avatarPaths,
          {
            size: options.size || "1024x1024",
            model: "gpt-image-1.5",
            enhancedPromptWithoutAvatarImage: enhancedPromptWithoutAvatarImage,
          }
        );

        usedAvatarReferences = true;

        // Handle base64 response from GPT Image model
        if (result.base64) {
          const outputFileName = `${storyTitle}_page_${page.pageNumber}.png`;
          const storagePath = getStoragePath("page");
          savedPath = path.join(storagePath, outputFileName);
          saveBase64Image(result.base64, savedPath);
          imageUrl = `data:image/png;base64,${result.base64.substring(0, 50)}...`; // Truncated for logging
        } else if (result.url) {
          imageUrl = result.url;
          savedPath = await saveImageFromUrl(
            imageUrl,
            "page",
            `${storyTitle}_page_${page.pageNumber}`
          );
        }

        logger.debug(
          `Page ${page.pageNumber} generated with avatar references`
        );
      } catch (error) {
        logger.warn(
          `Avatar reference generation failed for page ${page.pageNumber}, falling back: ${error.message}`
        );
        // Fall through to standard generation
      }
    }

    // Standard generation (fallback or when no avatars available)
    if (!savedPath) {
      imageUrl = await generateImage(enhancedPromptWithoutAvatarImage, {
        size: options.size || "1024x1024",
        quality: options.quality || "standard",
        style: options.style || "vivid",
      });

      savedPath = await saveImageFromUrl(
        imageUrl,
        "page",
        `${storyTitle}_page_${page.pageNumber}`
      );
    }

    return {
      ...page,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
      generatedPrompt: enhancedPrompt,
      usedAvatarReferences,
      avatarReferencesUsed: usedAvatarReferences ? avatarPaths.length : 0,
    };
  }

  /**
   * Generates illustrations for all pages with character consistency
   * @param {object} storyPages - Story pages object
   * @param {object} options - Generation options
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<object>} - Story pages with illustrations
   */
  async generateAllIllustrations(storyPages, options = {}, onProgress = null) {
    const illustratedPages = [];

    for (let i = 0; i < storyPages.pages.length; i++) {
      const page = storyPages.pages[i];

      if (onProgress) {
        onProgress(page.pageNumber, i + 1, storyPages.pages.length);
      }

      const illustratedPage = await this.generatePageIllustration(
        page,
        storyPages.title,
        options
      );
      illustratedPages.push(illustratedPage);

      // Delay to avoid rate limiting
      if (i < storyPages.pages.length - 1) {
        await this.delay(2000);
      }
    }

    return {
      ...storyPages,
      pages: illustratedPages,
    };
  }

  /**
   * Builds a concise character reference for the prompt
   * @param {Array} charactersInScene - Names of characters in scene
   * @returns {string} - Concise character reference
   */
  buildConciseCharacterRef(charactersInScene = []) {
    if (!this.characterReference || this.characterReference.length === 0) {
      return "";
    }

    const relevantChars = this.characterReference.filter((char) =>
      charactersInScene.some(
        (name) => name.toLowerCase() === char.name.toLowerCase()
      )
    );

    if (relevantChars.length === 0) return "";

    // Build very concise references - just key visual identifiers
    const refs = relevantChars.map((char) => {
      if (char.consistencyTag) {
        return char.consistencyTag;
      }
      const vi = char.visualIdentity;
      if (vi) {
        const parts = [];
        if (vi.hairColor) parts.push(`${vi.hairColor} hair`);
        if (vi.primaryOutfit?.top) parts.push(vi.primaryOutfit.top);
        return `${char.name}: ${parts.join(", ")}`;
      }
      return char.name;
    });

    return refs.join("; ");
  }

  /**
   * Builds optimized prompt for illustration generation with ACTION focus and character consistency
   * @param {string} description - Scene description (includes action, emotion, characters)
   * @param {string} artStyle - Art style to apply
   * @param {string} characterBlock - Character consistency instructions (detailed)
   * @param {object} pageData - Additional page data (action, emotion, etc.)
   * @returns {string} - Optimized prompt
   */
  buildIllustrationPrompt(
    description,
    artStyle,
    characterBlock = "",
    pageData = {}
  ) {
    // Extract action and emotion if available
    const action = pageData.action || "";
    const emotion = pageData.emotion || "";

    // Concise character consistency note (not the full block)
    const consistencyNote = `[Maintain exact character appearances across all illustrations]`;

    // ACTION-focused composition guidelines
    const compositionGuidelines = `DYNAMIC ILLUSTRATION: Show characters IN ACTION - moving, expressing emotion, interacting. Characters in foreground (25% of frame), expressive poses and clear emotions. Background soft and supportive.`;

    const qualityEnhancements = `High quality children's book illustration. Capture the story moment with energy and emotion.`;

    // Smart truncation
    let truncatedDescription = description;
    if (description.length > 550) {
      truncatedDescription = description.substring(0, 550) + "...";
    }

    // Build action-emphasized prompt
    const promptParts = [];

    // 1. Art style first (sets the visual tone)
    promptParts.push(`Art style: ${artStyle}.`);

    // 2. Character reference (concise, at start for consistency)
    if (characterBlock) {
      promptParts.push(consistencyNote);
    }

    // 3. COMPOSITION with action emphasis
    promptParts.push(compositionGuidelines);

    // 4. The scene description (which should include action/emotion)
    if (action && emotion) {
      promptParts.push(`ACTION: ${action}. EMOTION: ${emotion}.`);
    }
    promptParts.push(`Scene: ${truncatedDescription}`);

    // 5. Quality
    promptParts.push(qualityEnhancements);

    // 6. Detailed character block at end (for reference, not to overshadow action)
    if (characterBlock) {
      promptParts.push(characterBlock);
    }

    return promptParts.join(" ");
  }

  /**
   * Builds an illustration prompt that explicitly references the provided avatar images
   * @param {string} description - Scene description
   * @param {string} artStyle - Art style string
   * @param {string} characterBlock - Character consistency instructions
   * @param {object} pageData - Additional data: action, emotion
   * @param {Array<string>} avatarPaths - File paths to avatar reference images
   * @returns {string} - The constructed prompt
   */
  buildIllustrationPromptWithAvatarImage(
    description,
    artStyle,
    characterBlock,
    pageData = {},
    avatarPaths = []
  ) {
    const action = pageData.action || "";
    const emotion = pageData.emotion || "";

    // Concise character consistency note
    const consistencyNote = `[Maintain exact character appearances across all illustrations]`;

    // Avatar reference guideline
    let avatarInstruction = "";
    if (avatarPaths && avatarPaths.length > 0 && this.characterReference) {
      // Map avatarPaths to character names if possible
      const avatarCharNames = this.characterReference
        .filter((c) => avatarPaths.includes(c.avatarPath))
        .map((c) => c.name);

      if (avatarCharNames.length > 0) {
        avatarInstruction = `Use the provided reference image${avatarCharNames.length > 1 ? "s" : ""} to keep `;
        avatarInstruction +=
          avatarCharNames.join(", ") + " consistent in appearance.";
      } else {
        // Generic fallback if names not matched
        avatarInstruction = `Use the provided reference image${avatarPaths.length > 1 ? "s" : ""} to maintain character consistency.`;
      }
    }

    // Composition and quality
    const compositionGuidelines = `DYNAMIC ILLUSTRATION: Show characters IN ACTION - moving, expressing emotion, interacting. Characters in foreground (25% of frame), expressive poses and clear emotions. Background soft, supportive and blurred.`;
    const qualityEnhancements = `High quality children's book illustration. Capture the story moment with energy and emotion.`;

    // Truncate description if necessary
    let truncatedDescription = description;
    if (description.length > 550) {
      truncatedDescription = description.substring(0, 550) + "...";
    }

    const promptParts = [];
    promptParts.push(`Art style: ${artStyle}.`);
    if (characterBlock) {
      promptParts.push(consistencyNote);
    }
    if (avatarInstruction) {
      promptParts.push(avatarInstruction);
    }
    promptParts.push(compositionGuidelines);
    if (action && emotion) {
      promptParts.push(`ACTION: ${action}. EMOTION: ${emotion}.`);
    }
    promptParts.push(`Scene: ${truncatedDescription}`);
    promptParts.push(qualityEnhancements);
    if (characterBlock) {
      promptParts.push(characterBlock);
    }

    return promptParts.join(" ");
  }

  /**
   * Generates a cover illustration for the story with character consistency
   * Uses avatar reference images for main characters
   * @param {object} storyPages - Story pages object
   * @param {Array} characters - Main characters
   * @param {object} options - Generation options
   * @returns {Promise<object>} - Cover illustration info
   */
  async generateCoverIllustration(storyPages, characters, options = {}) {
    // Build detailed main character descriptions for cover
    const mainChars = characters.filter((c) => c.role === "main");
    const mainCharacterDescriptions = mainChars
      .map((char) => {
        if (char.consistencyTag) {
          return `${char.name} (${char.consistencyTag})`;
        }
        return char.name;
      })
      .join(", ");

    const characterVisuals = mainChars
      .map((char) => {
        return char.consistencyTag || char.avatarPrompt;
      })
      .filter(Boolean)
      .join("; ");

    const artStyle =
      options.artStyle || "colorful children's book cover, magical, inviting";

    const coverPrompt = `Create a beautiful children's book cover illustration.
[CHARACTER REFERENCE: ${characterVisuals}]
FOCUS: Main characters (${mainCharacterDescriptions}) prominently displayed in the foreground, detailed and taking center stage, occupying 25% of the frame.
Background: Soft, atmospheric, blurred, hints at the story setting but not overpowering.
Scene context: ${storyPages.summary}
Art style: ${artStyle}.
Add title of the story "${storyPages.title}" to the cover.
Characters are the stars, maintain their exact appearances from the reference images. Background supports the mood.
Don't add any characters at the top of the image.`;

    // Get avatar paths for main characters
    const avatarPaths = mainChars
      .filter((c) => c.avatarPath)
      .map((c) => c.avatarPath);

    let imageUrl;
    let savedPath;
    let usedAvatarReferences = false;

    // Use avatar references if available and enabled
    if (this.useAvatarReferences && avatarPaths.length > 0) {
      logger.debug(`Using ${avatarPaths.length} avatar references for cover`);

      try {
        const result = await generateImageWithReferences(
          coverPrompt,
          avatarPaths,
          {
            size: "1024x1024",
            model: "gpt-image-1.5",
          }
        );

        usedAvatarReferences = true;

        // Handle base64 response from GPT Image model
        if (result.base64) {
          const outputFileName = `${storyPages.title.replace(" ", "_")}_cover.png`;
          const storagePath = getStoragePath("page");
          savedPath = path.join(storagePath, outputFileName);
          saveBase64Image(result.base64, savedPath);
          imageUrl = `data:image/png;base64,${result.base64.substring(0, 50)}...`;
        } else if (result.url) {
          imageUrl = result.url;
          savedPath = await saveImageFromUrl(
            imageUrl,
            "page",
            `${storyPages.title}_cover`
          );
        }

        logger.debug("Cover generated with avatar references");
      } catch (error) {
        logger.warn(
          `Avatar reference generation failed for cover, falling back: ${error.message}`
        );
        // Fall through to standard generation
      }
    }

    // Standard generation (fallback or when no avatars available)
    // if (!savedPath) {
    //   imageUrl = await generateImage(coverPrompt, {
    //     size: "1024x1024",
    //     quality: "standard",
    //     style: "vivid",
    //   });

    //   savedPath = await saveImageFromUrl(
    //     imageUrl,
    //     "page",
    //     `${storyPages.title}_cover`
    //   );
    // }

    return {
      type: "cover",
      title: storyPages.title,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
      generatedPrompt: coverPrompt,
      usedAvatarReferences,
      avatarReferencesUsed: usedAvatarReferences ? avatarPaths.length : 0,
    };
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default IllustrationAgent;
