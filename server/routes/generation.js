import {
  ART_STYLES,
  ArtStyleAgent,
  CharacterAgent,
  AvatarAgent,
  PageAgent,
  IllustrationAgent,
} from "../../src/agents/index.js";
import {
  saveJson,
  ensureStorageDirectories,
  saveDraft,
  loadDraft,
  deleteDraft,
} from "../../src/utils/storage.js";
import { setContext as setPromptContext } from "../../src/services/promptLogger.js";
import { generateTextResponse } from "../../src/services/openai.js";
import { checkStoryContent } from "../../src/services/contentModerator.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("GenerationRoutes");

/**
 * Analyze reference image to extract visual characteristics
 */
async function analyzeReferenceImage(base64Image) {
  const response = await generateTextResponse([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze this reference image for character design. Describe:
1. Visual appearance (colors, clothing, style)
2. Artistic style (realistic, cartoon, anime, etc.)
3. Key distinguishing features
4. Mood and expression

Provide a concise description that can be used to generate a similar character avatar.`,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
    },
  ]);
  return response;
}

/**
 * Register all generation-related routes.
 * @param {import('express').Application} app
 * @param {{ activeJobs: Map, getImageUrl: (path: string, type?: string) => string|null, checkFreePlanTokenLimit: (userId: number) => Promise<object>, updateJobWithDraft: (jobId: string, updates: object) => Promise<object|undefined> }} deps
 */
export function registerGenerationRoutes(app, deps) {
  const {
    activeJobs,
    getImageUrl,
    checkFreePlanTokenLimit,
    updateJobWithDraft,
  } = deps;

  /**
   * Background character extraction function (Phase 1 - without auto avatar generation)
   */
  async function extractCharactersAsync(jobId, options) {
    const job = activeJobs.get(jobId);

    try {
      await ensureStorageDirectories();
      const artStyleAgent = new ArtStyleAgent();
      const characterAgent = new CharacterAgent();

      // Determine art style
      job.phase = "art_style_selection";
      job.message = "Analyzing story for best art style...";
      job.progress = 10;
      activeJobs.set(jobId, { ...job });

      let artStylePrompt;
      let artStyleKey;

      if (options.customArtStyle) {
        artStylePrompt = options.customArtStyle;
        artStyleKey = "custom";
        job.artStyleDecision = {
          selectedStyle: "custom",
          source: "user_custom_prompt",
          stylePrompt: artStylePrompt,
        };
      } else if (options.artStyleKey && options.artStyleKey !== "auto") {
        const styleDecision = await artStyleAgent.decideStyle(
          options.story,
          options.artStyleKey,
        );
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        job.artStyleDecision = styleDecision;
      } else {
        const styleDecision = await artStyleAgent.decideStyle(
          options.story,
          null,
        );
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        job.artStyleDecision = styleDecision;
      }

      job.artStyleKey = artStyleKey;
      job.artStylePrompt = artStylePrompt;
      job.progress = 30;
      activeJobs.set(jobId, { ...job });

      // Extract characters
      job.phase = "character_extraction";
      job.message = "Extracting characters from story...";
      job.progress = 40;
      activeJobs.set(jobId, { ...job });

      const characters = await characterAgent.extractCharacters(options.story);

      // Mark characters as awaiting user input for avatar
      const charactersWithStatus = characters.map((char) => ({
        ...char,
        avatarGenerated: false,
        avatarUrl: null,
        avatarPath: null,
        customDescription: null,
        hasReferenceImage: false,
      }));

      job.characters = charactersWithStatus;
      job.status = "characters_ready";
      job.phase = "awaiting_avatar_input";
      job.progress = 50;
      job.message =
        "Characters extracted. Please provide description or image for each character.";
      activeJobs.set(jobId, { ...job });

      // Auto-save draft at this milestone
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }
    } catch (error) {
      logger.error("Character extraction error:", error.message);
      job.status = "error";
      job.error = error.message;
      activeJobs.set(jobId, { ...job });
    }
  }

  /**
   * Background avatar generation function (Phase 1 - legacy)
   */
  async function generateAvatarsAsync(jobId, options) {
    const job = activeJobs.get(jobId);

    try {
      await ensureStorageDirectories();
      const artStyleAgent = new ArtStyleAgent();
      const characterAgent = new CharacterAgent();
      const avatarAgent = new AvatarAgent();

      // Determine art style
      job.phase = "art_style_selection";
      job.message = "Analyzing story for best art style...";
      job.progress = 5;
      activeJobs.set(jobId, { ...job });

      let artStylePrompt;
      let artStyleKey;

      if (options.customArtStyle) {
        artStylePrompt = options.customArtStyle;
        artStyleKey = "custom";
        job.artStyleDecision = {
          selectedStyle: "custom",
          source: "user_custom_prompt",
          stylePrompt: artStylePrompt,
        };
      } else if (options.artStyleKey && options.artStyleKey !== "auto") {
        const styleDecision = await artStyleAgent.decideStyle(
          options.story,
          options.artStyleKey,
        );
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        job.artStyleDecision = styleDecision;
      } else {
        const styleDecision = await artStyleAgent.decideStyle(
          options.story,
          null,
        );
        artStylePrompt = styleDecision.stylePrompt;
        artStyleKey = styleDecision.selectedStyle;
        job.artStyleDecision = styleDecision;
      }

      job.artStyleKey = artStyleKey;
      job.artStylePrompt = artStylePrompt;
      job.progress = 10;
      activeJobs.set(jobId, { ...job });

      // Extract characters
      job.phase = "character_extraction";
      job.message = "Extracting characters from story...";
      job.progress = 15;
      activeJobs.set(jobId, { ...job });

      const characters = await characterAgent.extractCharacters(options.story);
      job.progress = 25;
      activeJobs.set(jobId, { ...job });

      // Generate avatars
      job.phase = "avatar_generation";
      job.message = "Generating character avatars...";
      activeJobs.set(jobId, { ...job });

      const charactersWithStyle = characters.map((char) => ({
        ...char,
        avatarPrompt: artStyleAgent.enhancePromptWithStyle(
          char.avatarPrompt,
          artStyleKey,
        ),
        originalPrompt: char.avatarPrompt, // Keep original for editing
      }));

      const charactersWithAvatars = await avatarAgent.generateAvatars(
        charactersWithStyle,
        (name, current, total) => {
          job.message = `Generating avatar for ${name}...`;
          job.progress = 25 + Math.round((current / total) * 20);
          activeJobs.set(jobId, { ...job });
        },
      );

      // Convert paths to URLs
      const finalCharacters = charactersWithAvatars.map((char) => ({
        ...char,
        avatarPrompt: char.originalPrompt, // Return original prompt for user editing
        avatarUrl: getImageUrl(char.avatarPath, "avatar"),
      }));

      job.characters = finalCharacters;
      job.status = "avatars_ready";
      job.phase = "awaiting_approval";
      job.progress = 45;
      job.message = "Avatars ready for review. Please approve or regenerate.";
      activeJobs.set(jobId, { ...job });
    } catch (error) {
      logger.error("Avatar generation error:", error.message);
      job.status = "error";
      job.error = error.message;
      activeJobs.set(jobId, { ...job });
    }
  }

  /**
   * Background page generation function (Phase 2)
   * Generates page text and prompts only - does NOT generate illustrations
   * User must review prompts and click generate for illustrations
   */
  async function generatePagesAsync(jobId) {
    const job = activeJobs.get(jobId);

    try {
      const artStyleAgent = new ArtStyleAgent();
      const pageAgent = new PageAgent();

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      // Generate story pages (text and image descriptions only)
      job.phase = "page_generation";
      job.message = "Creating story pages...";
      job.progress = 50;
      activeJobs.set(jobId, { ...job });

      let storyPages = await pageAgent.generatePages(job.story, job.characters, {
        pageCount: job.pageCount || undefined, // Let PageAgent auto-determine if not set
        targetAudience: job.targetAudience,
      });

      storyPages = pageAgent.enhanceImageDescriptions(storyPages, job.characters);
      job.storyPages = storyPages;
      // Update pageCount with actual number of pages generated
      job.pageCount = storyPages.pages?.length || job.pageCount;
      job.progress = 70;
      activeJobs.set(jobId, { ...job });

      // Mark pages with review status (no illustrations yet)
      job.storyPages.pages = job.storyPages.pages.map((page) => ({
        ...page,
        approved: false,
        regenerated: false,
        illustrationGenerated: false,
        illustrationUrl: null,
        illustrationPath: null,
      }));

      // Save current result
      const result = {
        originalStory: job.story,
        artStyleDecision: job.artStyleDecision,
        characters: job.characters,
        storyPages: job.storyPages,
        cover: null,
        metadata: {
          timestamp: new Date().toISOString(),
          pageCount: job.pageCount,
          targetAudience: job.targetAudience,
          genre: job.genre || null,
        },
      };

      // Stop here - wait for user to review and trigger illustration generation
      job.status = "pages_text_ready";
      job.phase = "awaiting_prompt_review";
      job.progress = 75;
      job.message =
        "Page text and prompts ready for review. Click Generate to create illustrations.";
      job.result = result;
      activeJobs.set(jobId, { ...job });

      // Auto-save draft at this milestone
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }
    } catch (error) {
      logger.error("Page generation error:", error.message);
      job.status = "error";
      job.error = error.message;
      activeJobs.set(jobId, { ...job });
    }
  }

  /**
   * Background illustration generation function (Phase 3)
   * Generates all page illustrations and cover
   */
  async function generateIllustrationsAsync(jobId) {
    const job = activeJobs.get(jobId);

    try {
      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      // Set character reference for consistency
      illustrationAgent.setCharacterReference(job.characters);

      // Generate page illustrations
      job.phase = "illustration_generation";
      job.message = "Creating page illustrations...";
      job.progress = 75;
      activeJobs.set(jobId, { ...job });

      const illustratedPages = await illustrationAgent.generateAllIllustrations(
        job.storyPages,
        { artStyle: artStylePrompt },
        (pageNum, current, total) => {
          job.message = `Illustrating page ${pageNum}...`;
          job.progress = 75 + Math.round((current / total) * 15);
          activeJobs.set(jobId, { ...job });
        },
      );

      job.storyPages = illustratedPages;

      // Generate cover
      if (job.generateCover) {
        job.phase = "cover_generation";
        job.message = "Creating book cover...";
        job.progress = 92;
        activeJobs.set(jobId, { ...job });

        const cover = await illustrationAgent.generateCoverIllustration(
          illustratedPages,
          job.characters,
          { artStyle: artStylePrompt },
        );
        job.cover = cover;
      }

      // Convert paths to URLs
      job.storyPages.pages = job.storyPages.pages.map((page) => ({
        ...page,
        illustrationUrl: getImageUrl(page.illustrationPath, "page"),
        illustrationGenerated: true,
      }));

      if (job.cover) {
        job.cover.illustrationUrl = getImageUrl(
          job.cover.illustrationPath,
          "page",
        );
      }

      // Save final output
      const result = {
        originalStory: job.story,
        artStyleDecision: job.artStyleDecision,
        characters: job.characters,
        storyPages: job.storyPages,
        cover: job.cover,
        metadata: {
          timestamp: new Date().toISOString(),
          pageCount: job.pageCount,
          targetAudience: job.targetAudience,
          genre: job.genre || null,
        },
      };

      // Mark pages and approved status for each page
      job.storyPages.pages = job.storyPages.pages.map((page) => ({
        ...page,
        approved: false,
        regenerated: false,
      }));

      if (job.cover) {
        job.cover.approved = false;
        job.cover.regenerated = false;
      }

      job.status = "pages_ready";
      job.phase = "awaiting_page_review";
      job.progress = 95;
      job.message = "Pages ready for review. Edit any illustrations if needed.";
      job.result = result;
      activeJobs.set(jobId, { ...job });

      // Auto-save draft at this milestone
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }
    } catch (error) {
      logger.error("Illustration generation error:", error.message);
      job.status = "error";
      job.error = error.message;
      activeJobs.set(jobId, { ...job });
    }
  }

  // ==================== Routes ====================

  /**
   * GET /api/styles - Get all available art styles
   */
  app.get("/api/styles", (req, res) => {
    const styles = Object.entries(ART_STYLES).map(([key, style]) => ({
      key,
      name: style.name,
      description: style.description,
      bestFor: style.bestFor,
    }));
    res.json({ styles });
  });

  /**
   * POST /api/analyze-style - Analyze story and recommend art style
   */
  app.post("/api/analyze-style", async (req, res) => {
    try {
      if (req.userId) {
        const limitCheck = await checkFreePlanTokenLimit(req.userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            error: "Free plan limit reached",
            upgradeRequired: true,
            freeTokensUsed: limitCheck.used,
            freeTokensLimit: limitCheck.limit,
          });
        }
      }

      const { story } = req.body;

      if (!story || story.trim().length === 0) {
        return res.status(400).json({ error: "Story text is required" });
      }

      const artStyleAgent = new ArtStyleAgent();
      const recommendation = await artStyleAgent.analyzeAndRecommend(story);

      res.json({
        recommendedStyle: recommendation.recommendedStyle,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        alternativeStyles: recommendation.alternativeStyles,
        storyAnalysis: recommendation.storyAnalysis,
        styleDetails: ART_STYLES[recommendation.recommendedStyle],
      });
    } catch (error) {
      logger.error("Error analyzing style:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/extract-characters - Extract characters from story (no avatar generation)
   */
  app.post("/api/extract-characters", async (req, res) => {
    try {
      if (req.userId) {
        const limitCheck = await checkFreePlanTokenLimit(req.userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            error: "Free plan limit reached",
            upgradeRequired: true,
            freeTokensUsed: limitCheck.used,
            freeTokensLimit: limitCheck.limit,
          });
        }
      }

      const {
        story,
        artStyleKey,
        customArtStyle,
        jobId: existingJobId,
      } = req.body;

      if (!story || story.trim().length === 0) {
        return res.status(400).json({ error: "Story text is required" });
      }

      // Use existing jobId if provided, otherwise create new one
      const jobId =
        existingJobId ||
        `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get existing job data if resuming
      let existingData = {};
      if (existingJobId) {
        existingData = activeJobs.get(existingJobId) || {};
        try {
          const draft = await loadDraft(existingJobId);
          existingData = { ...draft, ...existingData };
        } catch (e) {
          // No existing draft, that's ok
        }
      }

      const jobData = {
        ...existingData,
        status: "running",
        phase: "character_extraction",
        progress: 0,
        message: "Extracting characters from story...",
        story,
        artStyleKey,
        customArtStyle,
        characters: [],
        artStyleDecision: null,
        error: null,
      };

      activeJobs.set(jobId, jobData);

      // Set prompt context for tracing
      setPromptContext({ jobId, userId: req.userId || null });

      // Update draft in database
      await saveDraft(jobId, jobData);

      // Start character extraction in background (without avatar generation)
      extractCharactersAsync(jobId, { story, artStyleKey, customArtStyle });

      res.json({ jobId, message: "Character extraction started" });
    } catch (error) {
      logger.error("Error starting character extraction:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate-avatar - Generate avatar for a single character with user input
   */
  app.post("/api/generate-avatar", async (req, res) => {
    try {
      if (req.userId) {
        const limitCheck = await checkFreePlanTokenLimit(req.userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            error: "Free plan limit reached",
            upgradeRequired: true,
            freeTokensUsed: limitCheck.used,
            freeTokensLimit: limitCheck.limit,
          });
        }
      }

      const { jobId, characterName, customDescription, referenceImageBase64 } =
        req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Set prompt context for tracing
      setPromptContext({ jobId, userId: req.userId || null });

      const characterIndex = job.characters.findIndex(
        (c) => c.name === characterName,
      );
      if (characterIndex === -1) {
        return res.status(404).json({ error: "Character not found" });
      }

      const character = { ...job.characters[characterIndex] };
      const artStyleAgent = new ArtStyleAgent();
      const avatarAgent = new AvatarAgent();
      const styleKey = job.artStyleKey || "illustration";

      // Build avatar prompt from user description or character's original prompt
      let avatarPrompt = customDescription || character.avatarPrompt;

      // Store original prompt for user editing
      character.customDescription = customDescription || null;
      character.avatarPrompt = avatarPrompt;

      // Apply art style
      const enhancedPrompt = artStyleAgent.enhancePromptWithStyle(
        avatarPrompt,
        styleKey,
      );

      // Generate avatar
      const updatedCharacter = await avatarAgent.generateAvatar({
        ...character,
        avatarPrompt: enhancedPrompt,
        referenceImageBase64: referenceImageBase64,
        hasReferenceImage: referenceImageBase64 ? true : false,
      });

      // Convert path to URL
      updatedCharacter.avatarUrl = getImageUrl(
        updatedCharacter.avatarPath,
        "avatar",
      );

      // Preserve user's description
      updatedCharacter.avatarPrompt = avatarPrompt;
      updatedCharacter.customDescription = character.customDescription;
      updatedCharacter.avatarGenerated = true;

      // Update job
      job.characters[characterIndex] = updatedCharacter;
      activeJobs.set(jobId, job);

      // Auto-save draft to persist avatar data
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft after avatar generation:", err.message);
      }

      res.json({
        success: true,
        character: updatedCharacter,
      });
    } catch (error) {
      console.error("Error generating avatar:", error);
      logger.error("Error generating avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate/avatars - Generate only characters and avatars (Phase 1)
   * @deprecated Use /api/extract-characters and /api/generate-avatar instead
   */
  app.post("/api/generate/avatars", async (req, res) => {
    try {
      if (req.userId) {
        const limitCheck = await checkFreePlanTokenLimit(req.userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            error: "Free plan limit reached",
            upgradeRequired: true,
            freeTokensUsed: limitCheck.used,
            freeTokensLimit: limitCheck.limit,
          });
        }
      }

      const { story, artStyleKey, customArtStyle } = req.body;

      if (!story || story.trim().length === 0) {
        return res.status(400).json({ error: "Story text is required" });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      activeJobs.set(jobId, {
        status: "running",
        phase: "character_extraction",
        progress: 0,
        message: "Extracting characters from story...",
        story,
        artStyleKey,
        customArtStyle,
        characters: [],
        artStyleDecision: null,
        error: null,
      });

      // Start avatar generation in background
      generateAvatarsAsync(jobId, { story, artStyleKey, customArtStyle });

      res.json({ jobId, message: "Avatar generation started" });
    } catch (error) {
      logger.error("Error starting avatar generation:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/job/:jobId/character/:characterName/avatar - Update character with existing avatar
   */
  app.put("/api/job/:jobId/character/:characterName/avatar", async (req, res) => {
    try {
      const { jobId, characterName } = req.params;
      const { avatarUrl, avatarPath, avatarPrompt } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Find and update the character
      const charIndex = job.characters?.findIndex(
        (c) => c.name.toLowerCase() === characterName.toLowerCase(),
      );

      if (charIndex === -1) {
        return res.status(404).json({ error: "Character not found" });
      }

      // Update character with the existing avatar
      const updatedCharacter = {
        ...job.characters[charIndex],
        avatarUrl,
        avatarPath: avatarPath || avatarUrl,
        avatarPrompt: avatarPrompt || job.characters[charIndex].avatarPrompt,
        avatarGenerated: true,
        fromLibrary: true,
      };

      job.characters[charIndex] = updatedCharacter;

      // Update the job
      await updateJobWithDraft(jobId, {
        characters: job.characters,
      });

      logger.info(`Character ${characterName} updated with existing avatar`);

      res.json({
        success: true,
        character: updatedCharacter,
      });
    } catch (error) {
      logger.error("Error updating character avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/regenerate-avatar - Regenerate a single avatar with custom prompt
   */
  app.post("/api/regenerate-avatar", async (req, res) => {
    try {
      const { jobId, characterName, customPrompt, artStyleKey } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const characterIndex = job.characters.findIndex(
        (c) => c.name === characterName,
      );
      if (characterIndex === -1) {
        return res.status(404).json({ error: "Character not found" });
      }

      // Update character prompt if provided
      const character = { ...job.characters[characterIndex] };
      if (customPrompt) {
        character.avatarPrompt = customPrompt;
      }

      // Apply art style if specified
      const artStyleAgent = new ArtStyleAgent();
      const styleKey = artStyleKey || job.artStyleKey || "illustration";
      const enhancedCharacter = {
        ...character,
        avatarPrompt: artStyleAgent.enhancePromptWithStyle(
          character.avatarPrompt,
          styleKey,
        ),
      };

      // Regenerate avatar
      const avatarAgent = new AvatarAgent();
      const updatedCharacter =
        await avatarAgent.generateAvatar(enhancedCharacter);

      // Convert path to URL
      updatedCharacter.avatarUrl = getImageUrl(
        updatedCharacter.avatarPath,
        "avatar",
      );

      // Preserve the original prompt (not the enhanced one)
      updatedCharacter.avatarPrompt = customPrompt || character.avatarPrompt;

      // Update job
      job.characters[characterIndex] = updatedCharacter;
      activeJobs.set(jobId, job);

      // Auto-save draft to persist avatar data
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn(
          "Failed to save draft after avatar regeneration:",
          err.message,
        );
      }

      res.json({
        success: true,
        character: updatedCharacter,
      });
    } catch (error) {
      logger.error("Error regenerating avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate/pages - Generate pages and illustrations (Phase 2)
   * Called after user approves avatars
   */
  app.post("/api/generate/pages", async (req, res) => {
    try {
      if (req.userId) {
        const limitCheck = await checkFreePlanTokenLimit(req.userId);
        if (!limitCheck.allowed) {
          return res.status(402).json({
            error: "Free plan limit reached",
            upgradeRequired: true,
            freeTokensUsed: limitCheck.used,
            freeTokensLimit: limitCheck.limit,
          });
        }
      }

      const { jobId, pageCount, targetAudience, generateCover } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.characters || job.characters.length === 0) {
        return res
          .status(400)
          .json({ error: "No characters found. Generate avatars first." });
      }

      // Update job for phase 2
      job.status = "running";
      job.phase = "page_generation";
      job.progress = 50;
      job.message = "Creating story pages...";
      // pageCount will be auto-determined by PageAgent based on story length
      job.pageCount = pageCount || null;
      job.targetAudience = targetAudience || "children";
      job.generateCover = generateCover !== false;
      activeJobs.set(jobId, job);

      // Save draft to persist characters/avatars before starting page generation
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft before page generation:", err.message);
      }

      // Start page generation in background
      generatePagesAsync(jobId);

      res.json({ jobId, message: "Page generation started" });
    } catch (error) {
      logger.error("Error starting page generation:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate/illustrations - Generate all page illustrations and cover (Phase 3)
   * Called after user reviews and approves page text/prompts
   */
  app.post("/api/generate/illustrations", async (req, res) => {
    try {
      const { jobId, generateCover } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages || !job.storyPages.pages) {
        return res
          .status(400)
          .json({ error: "No pages found. Generate pages first." });
      }

      // Update job for illustration phase
      job.status = "running";
      job.phase = "illustration_generation";
      job.progress = 75;
      job.message = "Starting illustration generation...";
      job.generateCover = generateCover !== false;
      activeJobs.set(jobId, job);

      // Set prompt context for tracing
      setPromptContext({ jobId, userId: req.userId || null });

      // Start illustration generation in background
      generateIllustrationsAsync(jobId);

      res.json({ jobId, message: "Illustration generation started" });
    } catch (error) {
      logger.error("Error starting illustration generation:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate/page/:pageNumber/illustration - Generate a single page illustration
   * Called when user wants to generate illustration for a specific page
   */
  app.post("/api/generate/page/:pageNumber/illustration", async (req, res) => {
    try {
      const { jobId } = req.body;
      const pageNumber = parseInt(req.params.pageNumber);

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages || !job.storyPages.pages) {
        return res
          .status(400)
          .json({ error: "No pages found. Generate pages first." });
      }

      const pageIndex = job.storyPages.pages.findIndex(
        (p) => p.pageNumber === pageNumber,
      );
      if (pageIndex === -1) {
        return res.status(404).json({ error: "Page not found" });
      }

      const page = job.storyPages.pages[pageIndex];

      // Set prompt context for tracing
      setPromptContext({ jobId, userId: req.userId || null });

      // Generate illustration for this page
      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();
      illustrationAgent.setCharacterReference(job.characters);

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");
      const storyTitle = job.storyPages?.title || "story";

      job.message = `Generating illustration for page ${pageNumber}...`;
      activeJobs.set(jobId, { ...job });

      const updatedPage = await illustrationAgent.generatePageIllustration(
        page,
        storyTitle,
        { artStyle: artStylePrompt },
      );

      // Convert path to URL
      updatedPage.illustrationUrl = getImageUrl(
        updatedPage.illustrationPath,
        "page",
      );

      updatedPage.illustrationGenerated = true;
      updatedPage.approved = false;
      updatedPage.regenerated = false;

      // Update job
      job.storyPages.pages[pageIndex] = updatedPage;
      activeJobs.set(jobId, job);

      // Auto-save draft
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }

      res.json({
        success: true,
        page: updatedPage,
      });
    } catch (error) {
      logger.error("Error generating page illustration:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/generate/cover/illustration - Generate cover illustration only
   * Called when user wants to generate only the cover illustration
   */
  app.post("/api/generate/cover/illustration", async (req, res) => {
    try {
      const { jobId } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages || !job.storyPages.pages) {
        return res
          .status(400)
          .json({ error: "No pages found. Generate pages first." });
      }

      // Set prompt context for tracing
      setPromptContext({ jobId, userId: req.userId || null });

      // Generate cover illustration
      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();
      illustrationAgent.setCharacterReference(job.characters);

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      job.message = "Generating cover illustration...";
      activeJobs.set(jobId, { ...job });

      const cover = await illustrationAgent.generateCoverIllustration(
        job.storyPages,
        job.characters,
        { artStyle: artStylePrompt },
      );

      // Convert path to URL
      cover.illustrationUrl = getImageUrl(cover.illustrationPath, "page");

      cover.approved = false;

      // Update job with cover
      job.cover = cover;
      job.message = "Cover generated successfully";
      activeJobs.set(jobId, job);

      // Auto-save draft
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }

      res.json({
        success: true,
        cover,
      });
    } catch (error) {
      console.error(error);
      logger.error("Error generating cover illustration:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/pages/update - Update page text and description
   */
  app.post("/api/pages/update", async (req, res) => {
    try {
      const { jobId, pageNumber, text, imageDescription } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages?.pages) {
        return res.status(400).json({ error: "No pages found" });
      }

      const pageIndex = job.storyPages.pages.findIndex(
        (p) => p.pageNumber === pageNumber,
      );
      if (pageIndex === -1) {
        return res.status(404).json({ error: "Page not found" });
      }

      // Update page
      const updatedPage = {
        ...job.storyPages.pages[pageIndex],
        text: text || job.storyPages.pages[pageIndex].text,
        imageDescription:
          imageDescription || job.storyPages.pages[pageIndex].imageDescription,
        illustrationGenerated: false, // Reset illustration status since text changed
        illustrationUrl: null,
        illustrationPath: null,
        approved: false,
        regenerated: true,
      };

      job.storyPages.pages[pageIndex] = updatedPage;
      activeJobs.set(jobId, job);

      // Auto-save draft
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }

      res.json({ success: true, page: updatedPage });
    } catch (error) {
      logger.error("Error updating page:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/pages/add - Add a new page
   */
  app.post("/api/pages/add", async (req, res) => {
    try {
      const { jobId, text, imageDescription } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages) {
        job.storyPages = { pages: [] };
      }

      // Create new page with next page number
      const newPageNumber = (job.storyPages.pages?.length || 0) + 1;
      const newPage = {
        pageNumber: newPageNumber,
        text: text || "",
        imageDescription: imageDescription || "",
        charactersInScene: [],
        illustrationGenerated: false,
        illustrationUrl: null,
        illustrationPath: null,
        approved: false,
        regenerated: false,
      };

      job.storyPages.pages = [...(job.storyPages.pages || []), newPage];
      activeJobs.set(jobId, job);

      // Auto-save draft
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }

      res.json({ success: true, page: newPage });
    } catch (error) {
      logger.error("Error adding page:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/pages/delete - Delete a page and renumber remaining pages
   */
  app.post("/api/pages/delete", async (req, res) => {
    try {
      const { jobId, pageNumber } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages?.pages) {
        return res.status(400).json({ error: "No pages found" });
      }

      // Filter out the deleted page
      let pages = job.storyPages.pages.filter((p) => p.pageNumber !== pageNumber);

      // Renumber remaining pages
      pages = pages.map((page, index) => ({
        ...page,
        pageNumber: index + 1,
      }));

      job.storyPages.pages = pages;
      activeJobs.set(jobId, job);

      // Auto-save draft
      try {
        await saveDraft(jobId, job);
      } catch (err) {
        logger.warn("Failed to save draft:", err.message);
      }

      res.json({ success: true, pages });
    } catch (error) {
      logger.error("Error deleting page:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/regenerate-page - Regenerate a single page illustration
   */
  app.post("/api/regenerate-page", async (req, res) => {
    try {
      const { jobId, pageNumber, customDescription, referenceImageBase64 } =
        req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.storyPages?.pages) {
        return res.status(400).json({ error: "No pages found" });
      }

      const pageIndex = job.storyPages.pages.findIndex(
        (p) => p.pageNumber === pageNumber,
      );
      if (pageIndex === -1) {
        return res.status(404).json({ error: "Page not found" });
      }

      const page = { ...job.storyPages.pages[pageIndex] };
      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();

      // Set character reference for avatar-based illustration generation
      if (job.characters && job.characters.length > 0) {
        illustrationAgent.setCharacterReference(job.characters);
      }

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      // Build illustration prompt
      let illustrationPrompt = customDescription || page.imageDescription;

      // If reference image is provided, analyze it
      if (referenceImageBase64) {
        try {
          const imageAnalysis = await analyzeReferenceImage(referenceImageBase64);
          illustrationPrompt = `Based on reference image style: ${imageAnalysis}. Scene: ${illustrationPrompt}`;
          page.hasReferenceImage = true;
        } catch (err) {
          logger.warn("Error analyzing reference image:", err.message);
        }
      }

      // Store custom description
      page.customDescription = customDescription || null;

      // Generate new illustration
      const storyTitle = job.storyPages?.title || "story";
      const updatedPage = await illustrationAgent.generatePageIllustration(
        { ...page, imageDescription: illustrationPrompt },
        storyTitle,
        { artStyle: artStylePrompt },
      );

      // Convert path to URL
      updatedPage.illustrationUrl = getImageUrl(
        updatedPage.illustrationPath,
        "page",
      );

      // Preserve metadata
      updatedPage.customDescription = page.customDescription;
      updatedPage.hasReferenceImage = page.hasReferenceImage || false;
      updatedPage.regenerated = true;

      // Update job
      job.storyPages.pages[pageIndex] = updatedPage;
      activeJobs.set(jobId, job);

      res.json({
        success: true,
        page: updatedPage,
      });
    } catch (error) {
      logger.error("Error regenerating page illustration:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/regenerate-cover - Regenerate the cover illustration
   */
  app.post("/api/regenerate-cover", async (req, res) => {
    try {
      const { jobId, customDescription, referenceImageBase64 } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.cover) {
        return res.status(400).json({ error: "No cover found" });
      }

      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();

      // Set character reference for avatar-based illustration generation
      if (job.characters && job.characters.length > 0) {
        illustrationAgent.setCharacterReference(job.characters);
      }

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      // Build cover prompt
      let coverPrompt = customDescription;

      if (!coverPrompt) {
        const mainCharacters = job.characters
          .filter((c) => c.role === "main")
          .map((c) => c.name)
          .join(", ");
        coverPrompt = `Book cover for "${job.storyPages.title}". ${job.storyPages.summary}. Main characters: ${mainCharacters}.`;
      }

      // If reference image is provided, analyze it
      if (referenceImageBase64) {
        try {
          const imageAnalysis = await analyzeReferenceImage(referenceImageBase64);
          coverPrompt = `Based on reference image style: ${imageAnalysis}. ${coverPrompt}`;
        } catch (err) {
          logger.warn("Error analyzing reference image:", err.message);
        }
      }

      // Generate new cover
      const cover = await illustrationAgent.generateCoverIllustration(
        { ...job.storyPages, customCoverPrompt: coverPrompt },
        job.characters,
        { artStyle: artStylePrompt },
      );

      // Convert path to URL
      cover.illustrationUrl = getImageUrl(cover.illustrationPath, "page");

      cover.customDescription = customDescription || null;
      cover.regenerated = true;

      // Update job
      job.cover = cover;
      activeJobs.set(jobId, job);

      res.json({
        success: true,
        cover,
      });
    } catch (error) {
      logger.error("Error regenerating cover:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/finalize-story - Finalize the story after page review
   */
  app.post("/api/finalize-story", async (req, res) => {
    try {
      const { jobId } = req.body;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Build full story text for content moderation
      const parts = [];
      if (job.story && String(job.story).trim()) parts.push(String(job.story).trim());
      const pages = job.storyPages?.pages || [];
      for (const p of pages) {
        if (p?.text && String(p.text).trim()) parts.push(String(p.text).trim());
      }
      const fullText = parts.join("\n\n");

      const moderation = await checkStoryContent(fullText);
      if (!moderation.safe) {
        return res.status(400).json({
          error: "Content not allowed",
          reason: moderation.reason || "Story contains content that is not permitted.",
        });
      }

      // Save final output
      const result = {
        originalStory: job.story,
        artStyleDecision: job.artStyleDecision,
        characters: job.characters,
        storyPages: job.storyPages,
        cover: job.cover,
        metadata: {
          timestamp: new Date().toISOString(),
          pageCount: job.pageCount,
          targetAudience: job.targetAudience,
          genre: job.genre || null,
        },
      };

      // Save to MySQL and get story ID
      const storyId = await saveJson(result, req.userId);
      job.storyId = storyId;
      job.outputPath = `story_${storyId}`; // For backward compatibility

      job.status = "completed";
      job.phase = "complete";
      job.progress = 100;
      job.message = "Story generation complete!";
      job.result = result;
      activeJobs.set(jobId, { ...job });

      // Delete draft since story is now complete
      try {
        await deleteDraft(jobId);
      } catch (err) {
        // Ignore if draft doesn't exist
      }

      // Clean up after 1 hour
      setTimeout(() => {
        activeJobs.delete(jobId);
      }, 3600000);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      logger.error("Error finalizing story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/job/:jobId - Get job status
   */
  app.get("/api/job/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = activeJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  });
}
