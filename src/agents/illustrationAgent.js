import { generateImage } from "../services/ai.js";
import { saveImageFromUrl } from "../utils/storage.js";

/**
 * Illustration Agent - Generates page illustrations based on descriptions
 * with enhanced character consistency across all pages
 */
export class IllustrationAgent {
  constructor() {
    this.name = "IllustrationAgent";
    this.description =
      "Generates page illustrations with consistent character appearances across all pages";

    // Store character reference for consistency across pages
    this.characterReference = null;
  }

  /**
   * Sets the character reference for consistent illustration generation
   * @param {Array} characters - Array of character objects with visual details
   */
  setCharacterReference(characters) {
    this.characterReference = characters;
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
   * @param {object} page - Page object with imageDescription, action, emotion
   * @param {string} storyTitle - Title of the story (for naming)
   * @param {object} options - Generation options
   * @returns {Promise<object>} - Page with generated illustration path
   */
  async generatePageIllustration(page, storyTitle, options = {}) {
    const artStyle =
      options.artStyle ||
      "children's book illustration style, colorful, warm, friendly";

    // Build character consistency block
    const characterBlock = this.buildCharacterConsistencyBlock(
      page.charactersInScene || page.characters || []
    );

    // Pass page data including action and emotion
    const enhancedPrompt = this.buildIllustrationPrompt(
      page.imageDescription,
      artStyle,
      characterBlock,
      {
        action: page.action,
        emotion: page.emotion || page.mood,
        scene: page.scene,
      }
    );

    const imageUrl = await generateImage(enhancedPrompt, {
      size: options.size || "1024x1024",
      quality: options.quality || "standard",
      style: options.style || "vivid",
    });

    const savedPath = await saveImageFromUrl(
      imageUrl,
      "page",
      `${storyTitle}_page_${page.pageNumber}`
    );

    return {
      ...page,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
      generatedPrompt: enhancedPrompt, // Store for debugging
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
   * Generates a cover illustration for the story with character consistency
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
        if (char.visualIdentity) {
          const vi = char.visualIdentity;
          const parts = [];
          if (vi.species) parts.push(`species: ${vi.species}`);
          if (vi.ageAppearance) parts.push(`age: ${vi.ageAppearance}`);
          if (vi.gender) parts.push(`gender: ${vi.gender}`);
          if (vi.bodyType) parts.push(`body: ${vi.bodyType}`);
          if (vi.skinTone) parts.push(`skin: ${vi.skinTone}`);
          if (vi.hairStyle) parts.push(`hair style: ${vi.hairStyle}`);
          if (vi.hairColor) parts.push(`hair color: ${vi.hairColor}`);

          return `${char.name}: ${parts.join(", ")}`;
        }
        return char.consistencyTag || char.avatarPrompt?.substring(0, 60);
      })
      .filter(Boolean)
      .join("; ");

    const artStyle =
      options.artStyle || "colorful children's book cover, magical, inviting";

    const coverPrompt = `CRITICAL: Maintain exact character appearances. Don't add characters in the top
[CHARACTER REFERENCE: ${characterVisuals}]
FOCUS: Main characters (${mainCharacterDescriptions}) prominently displayed in the foreground, detailed and taking center stage, occupying 25% of the frame.
Background: Soft, atmospheric, hints at the story setting but not overpowering.
Scene context: ${storyPages.summary}
Art style: ${artStyle}.
Characters are the stars with consistent appearances, background supports the mood.`;

    const imageUrl = await generateImage(coverPrompt, {
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const savedPath = await saveImageFromUrl(
      imageUrl,
      "page",
      `${storyPages.title}_cover`
    );

    return {
      type: "cover",
      title: storyPages.title,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
      generatedPrompt: coverPrompt,
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
