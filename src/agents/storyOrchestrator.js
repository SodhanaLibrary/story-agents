import { CharacterAgent } from "./characterAgent.js";
import { AvatarAgent } from "./avatarAgent.js";
import { PageAgent } from "./pageAgent.js";
import { IllustrationAgent } from "./illustrationAgent.js";
import { ArtStyleAgent } from "./artStyleAgent.js";
import { saveJson, ensureStorageDirectories } from "../utils/storage.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Orchestrator");

/**
 * Story Orchestrator - Coordinates all agents to generate a complete illustrated story
 */
export class StoryOrchestrator {
  constructor(options = {}) {
    this.characterAgent = new CharacterAgent();
    this.avatarAgent = new AvatarAgent();
    this.pageAgent = new PageAgent();
    this.illustrationAgent = new IllustrationAgent();
    this.artStyleAgent = new ArtStyleAgent();

    this.options = {
      pageCount: options.pageCount || 8,
      targetAudience: options.targetAudience || "children",
      artStyle: options.artStyle || null, // null = auto-detect
      artStyleKey: options.artStyleKey || null, // Style key like 'manga', 'anime', etc.
      autoDetectStyle: options.autoDetectStyle !== false, // Auto-detect if no style specified
      generateCover: options.generateCover !== false,
      ...options,
    };

    this.callbacks = {
      onPhaseStart: options.onPhaseStart || (() => {}),
      onPhaseComplete: options.onPhaseComplete || (() => {}),
      onProgress: options.onProgress || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Get available art styles
   * @returns {Array} - List of available styles
   */
  getAvailableStyles() {
    return this.artStyleAgent.getStyleList();
  }

  /**
   * Main orchestration method - generates complete illustrated story
   * @param {string} story - The input story text
   * @returns {Promise<object>} - Complete story output with all assets
   */
  async generateStory(story) {
    await ensureStorageDirectories();
    logger.section("Story Generation Started");
    logger.info(`Story length: ${story.length} characters`);

    const result = {
      originalStory: story,
      artStyleDecision: null,
      characters: [],
      storyPages: null,
      cover: null,
      outputPaths: {},
      metadata: {
        startTime: new Date().toISOString(),
        options: this.options,
      },
    };

    try {
      // Phase 0: Determine Art Style
      logger.step(1, 5, "Art Style Selection");
      this.callbacks.onPhaseStart(
        "art_style_selection",
        "Analyzing story for best art style..."
      );

      let artStylePrompt;
      let artStyleKey;

      if (this.options.artStyle) {
        // User provided a full custom art style prompt
        artStylePrompt = this.options.artStyle;
        artStyleKey = "custom";
        result.artStyleDecision = {
          selectedStyle: "custom",
          source: "user_custom_prompt",
          stylePrompt: artStylePrompt,
          reasoning: "User provided custom art style prompt",
        };
      } else if (this.options.artStyleKey) {
        // User selected a predefined style
        const styleDecision = await this.artStyleAgent.decideStyle(
          story,
          this.options.artStyleKey
        );
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        result.artStyleDecision = styleDecision;
      } else if (this.options.autoDetectStyle) {
        // Auto-detect best style
        const styleDecision = await this.artStyleAgent.decideStyle(story, null);
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        result.artStyleDecision = styleDecision;
      } else {
        // Default to illustration style
        artStylePrompt = this.artStyleAgent.getStylePrompt("illustration");
        artStyleKey = "illustration";
        result.artStyleDecision = {
          selectedStyle: "illustration",
          source: "default",
          stylePrompt: artStylePrompt,
          reasoning: "Default illustration style used",
        };
      }

      this.callbacks.onPhaseComplete(
        "art_style_selection",
        result.artStyleDecision
      );
      logger.success(`Art style selected: ${artStyleKey}`);

      // Phase 1: Extract Characters
      logger.step(2, 5, "Character Extraction");
      this.callbacks.onPhaseStart(
        "character_extraction",
        "Extracting characters from story..."
      );
      result.characters = await this.characterAgent.extractCharacters(story);
      this.callbacks.onPhaseComplete("character_extraction", result.characters);
      logger.success(`Extracted ${result.characters.length} characters`);

      // Phase 2: Generate Avatars (with art style)
      logger.step(3, 5, "Avatar Generation");
      this.callbacks.onPhaseStart(
        "avatar_generation",
        "Generating character avatars..."
      );
      // Enhance avatar prompts with selected art style
      const charactersWithStyle = result.characters.map((char) => ({
        ...char,
        avatarPrompt: this.artStyleAgent.enhancePromptWithStyle(
          char.avatarPrompt,
          artStyleKey
        ),
      }));
      result.characters = await this.avatarAgent.generateAvatars(
        charactersWithStyle,
        (name, current, total) => {
          logger.debug(`Avatar ${current}/${total}: ${name}`);
          this.callbacks.onProgress(
            "avatar",
            `Generating avatar for ${name}`,
            current,
            total
          );
        }
      );
      this.callbacks.onPhaseComplete("avatar_generation", result.characters);
      logger.success(`Generated ${result.characters.length} avatars`);

      // Phase 3: Generate Story Pages
      logger.step(4, 5, "Page Generation");
      this.callbacks.onPhaseStart("page_generation", "Creating story pages...");
      result.storyPages = await this.pageAgent.generatePages(
        story,
        result.characters,
        {
          pageCount: this.options.pageCount,
          targetAudience: this.options.targetAudience,
        }
      );

      // Enhance descriptions with character details
      result.storyPages = this.pageAgent.enhanceImageDescriptions(
        result.storyPages,
        result.characters
      );
      this.callbacks.onPhaseComplete("page_generation", result.storyPages);
      logger.success(`Created ${result.storyPages.pages.length} pages`);

      // Phase 4: Generate Page Illustrations
      logger.step(5, 5, "Illustration Generation");
      this.callbacks.onPhaseStart(
        "illustration_generation",
        "Creating page illustrations..."
      );

      // Set character reference for consistent illustrations across all pages
      this.illustrationAgent.setCharacterReference(result.characters);
      logger.debug("Character reference set for illustration consistency");

      result.storyPages = await this.illustrationAgent.generateAllIllustrations(
        result.storyPages,
        { artStyle: artStylePrompt },
        (pageNum, current, total) => {
          logger.debug(`Illustration ${current}/${total}: Page ${pageNum}`);
          this.callbacks.onProgress(
            "illustration",
            `Illustrating page ${pageNum}`,
            current,
            total
          );
        }
      );
      this.callbacks.onPhaseComplete(
        "illustration_generation",
        result.storyPages
      );
      logger.success(
        "All page illustrations generated with character consistency"
      );

      // Phase 5: Generate Cover (optional)
      if (this.options.generateCover) {
        logger.info("Generating cover illustration...");
        this.callbacks.onPhaseStart(
          "cover_generation",
          "Creating book cover..."
        );
        result.cover = await this.illustrationAgent.generateCoverIllustration(
          result.storyPages,
          result.characters,
          { artStyle: artStylePrompt }
        );
        this.callbacks.onPhaseComplete("cover_generation", result.cover);
        logger.success("Cover illustration generated");
      }

      // Save final output
      result.metadata.endTime = new Date().toISOString();
      result.metadata.artStyle = {
        key: artStyleKey,
        prompt: artStylePrompt,
      };
      const outputPath = await saveJson(
        result,
        `story_output_${Date.now()}.json`
      );
      result.outputPaths.fullOutput = outputPath;

      logger.section("Story Generation Complete");
      logger.success(`Output saved to: ${outputPath}`);

      return result;
    } catch (error) {
      logger.error("Story generation failed:", error.message);
      this.callbacks.onError(error);
      throw error;
    }
  }

  /**
   * Analyzes a story and returns recommended art style without generating
   * @param {string} story - Input story
   * @returns {Promise<object>} - Art style recommendation
   */
  async analyzeStoryStyle(story) {
    return await this.artStyleAgent.analyzeAndRecommend(story);
  }

  /**
   * Generates only the story structure (no images)
   * @param {string} story - Input story
   * @returns {Promise<object>} - Story structure with characters and pages
   */
  async generateStoryStructure(story) {
    const characters = await this.characterAgent.extractCharacters(story);
    const storyPages = await this.pageAgent.generatePages(story, characters, {
      pageCount: this.options.pageCount,
      targetAudience: this.options.targetAudience,
    });

    return {
      characters,
      storyPages: this.pageAgent.enhanceImageDescriptions(
        storyPages,
        characters
      ),
    };
  }

  /**
   * Regenerates a specific page illustration with character consistency
   * @param {object} page - Page object
   * @param {string} storyTitle - Story title
   * @param {string} artStyleKey - Art style to use
   * @param {Array} characters - Character array for consistency (optional if already set)
   * @returns {Promise<object>} - Updated page with new illustration
   */
  async regeneratePageIllustration(
    page,
    storyTitle,
    artStyleKey = null,
    characters = null
  ) {
    const artStyle = artStyleKey
      ? this.artStyleAgent.getStylePrompt(artStyleKey)
      : this.options.artStyle ||
        this.artStyleAgent.getStylePrompt("illustration");

    // Ensure character reference is set for consistency
    if (characters) {
      this.illustrationAgent.setCharacterReference(characters);
    }

    return await this.illustrationAgent.generatePageIllustration(
      page,
      storyTitle,
      {
        artStyle,
      }
    );
  }

  /**
   * Regenerates a character avatar
   * @param {object} character - Character object
   * @param {string} artStyleKey - Art style to use
   * @returns {Promise<object>} - Updated character with new avatar
   */
  async regenerateAvatar(character, artStyleKey = null) {
    if (artStyleKey) {
      character = {
        ...character,
        avatarPrompt: this.artStyleAgent.enhancePromptWithStyle(
          character.avatarPrompt,
          artStyleKey
        ),
      };
    }
    return await this.avatarAgent.generateAvatar(character);
  }
}

export default StoryOrchestrator;
