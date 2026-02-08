import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  StoryOrchestrator,
  ArtStyleAgent,
  ART_STYLES,
  CharacterAgent,
  AvatarAgent,
  PageAgent,
  IllustrationAgent,
} from "../src/agents/index.js";
import {
  saveJson,
  ensureStorageDirectories,
  listSavedStories,
  loadJson,
  deleteStory,
  saveDraft,
  loadDraft,
  listDrafts,
  deleteDraft,
  saveCompleteStory,
  getStoryById,
  searchStories,
  // Tags
  getAllTags,
  createTag,
  getTagsByStoryId,
  setStoryTags,
  // Favorites
  addFavorite,
  removeFavorite,
  getUserFavorites,
  getUserFavoriteIds,
  // Reading History
  updateReadingProgress,
  getReadingProgress,
  getCurrentlyReading,
  getReadingHistory,
  // Users
  findOrCreateUser,
  getUserById,
  // User Profiles
  getUserProfile,
  updateUserProfile,
  getUserStoriesByUserId,
  // Followers
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  // Personalized Feed
  getPersonalizedFeed,
  // Storage type check
  isUsingS3,
} from "../src/utils/storage.js";
import { generateTextResponse } from "../src/services/openai.js";
import { initializeDatabase, query, insert } from "../src/services/database.js";
import config from "../src/config.js";
import { createLogger, requestLogger } from "../src/utils/logger.js";
import {
  getPromptLogs,
  getPromptStats,
  setContext as setPromptContext,
} from "../src/services/promptLogger.js";

const logger = createLogger("Server");

/**
 * Convert image path to URL
 * If using S3, the path is already a full URL, so return it as-is
 * For local storage, construct the /storage URL
 * @param {string} imagePath - Path or URL to image
 * @param {string} type - Type of image ('avatar' or 'page')
 * @returns {string|null} - URL to image
 */
function getImageUrl(imagePath, type = "page") {
  if (!imagePath) return null;

  // If using S3, the path is already a full URL
  if (isUsingS3() || imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // For local storage, construct the URL
  const folder = type === "avatar" ? "avatars" : "pages";
  return `/storage/${folder}/${path.basename(imagePath)}`;
}

// Initialize database on startup
initializeDatabase().catch((err) => {
  logger.error("Failed to initialize database:", err.message);
  logger.warn("Server will continue but database features may not work.");
});

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// Auth middleware - extract user ID from request and set in prompt context
app.use((req, res, next) => {
  // Check for user ID in headers, body, or query params
  const userId =
    req.headers["x-user-id"] || req.body?.userId || req.query?.userId || null;

  if (userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!isNaN(parsedUserId)) {
      req.userId = parsedUserId;
      setPromptContext({ userId: parsedUserId });
    }
  }
  next();
});

// Serve static files from storage
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

// Store active generation jobs
const activeJobs = new Map();

/**
 * Helper to update job and auto-save as draft
 */
async function updateJobWithDraft(jobId, updates) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const updatedJob = { ...job, ...updates };
  activeJobs.set(jobId, updatedJob);

  // Auto-save draft for non-completed jobs
  if (updatedJob.status !== "completed" && updatedJob.status !== "error") {
    try {
      await saveDraft(jobId, updatedJob);
    } catch (err) {
      logger.error("Failed to auto-save draft:", err.message);
    }
  }

  return updatedJob;
}

// API Routes

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
    const { jobId, characterName, customDescription, referenceImageBase64 } =
      req.body;

    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Set prompt context for tracing
    setPromptContext({ jobId, userId: req.userId || null });

    const characterIndex = job.characters.findIndex(
      (c) => c.name === characterName
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
      styleKey
    );

    // Generate avatar
    const updatedCharacter = await avatarAgent.generateAvatar({
      ...character,
      avatarPrompt: enhancedPrompt,
      referenceImageBase64: referenceImageBase64,
      hasReferenceImage: referenceImageBase64 ? true : false,
    });

    // Convert path to URL
    updatedCharacter.avatarUrl = getImageUrl(updatedCharacter.avatarPath, "avatar");

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
      (c) => c.name === characterName
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
        styleKey
      ),
    };

    // Regenerate avatar
    const avatarAgent = new AvatarAgent();
    const updatedCharacter =
      await avatarAgent.generateAvatar(enhancedCharacter);

    // Convert path to URL
    updatedCharacter.avatarUrl = getImageUrl(updatedCharacter.avatarPath, "avatar");

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
        err.message
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
      (p) => p.pageNumber === pageNumber
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
      { artStyle: artStylePrompt }
    );

    // Convert path to URL
    updatedPage.illustrationUrl = getImageUrl(updatedPage.illustrationPath, "page");

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
      { artStyle: artStylePrompt }
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
      (p) => p.pageNumber === pageNumber
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
      (p) => p.pageNumber === pageNumber
    );
    if (pageIndex === -1) {
      return res.status(404).json({ error: "Page not found" });
    }

    const page = { ...job.storyPages.pages[pageIndex] };
    const artStyleAgent = new ArtStyleAgent();
    const illustrationAgent = new IllustrationAgent();
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
      { artStyle: artStylePrompt }
    );

    // Convert path to URL
    updatedPage.illustrationUrl = getImageUrl(updatedPage.illustrationPath, "page");

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
      { artStyle: artStylePrompt }
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
        options.artStyleKey
      );
      artStylePrompt = styleDecision.stylePrompt;
      artStyleKey = styleDecision.selectedStyle;
      job.artStyleDecision = styleDecision;
    } else {
      const styleDecision = await artStyleAgent.decideStyle(
        options.story,
        null
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
        options.artStyleKey
      );
      artStylePrompt = styleDecision.stylePrompt;
      artStyleKey = styleDecision.selectedStyle;
      job.artStyleDecision = styleDecision;
    } else {
      const styleDecision = await artStyleAgent.decideStyle(
        options.story,
        null
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
        artStyleKey
      ),
      originalPrompt: char.avatarPrompt, // Keep original for editing
    }));

    const charactersWithAvatars = await avatarAgent.generateAvatars(
      charactersWithStyle,
      (name, current, total) => {
        job.message = `Generating avatar for ${name}...`;
        job.progress = 25 + Math.round((current / total) * 20);
        activeJobs.set(jobId, { ...job });
      }
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
      }
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
        { artStyle: artStylePrompt }
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
      job.cover.illustrationUrl = getImageUrl(job.cover.illustrationPath, "page");
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

/**
 * GET /api/stories - List/search all saved stories (public access)
 * Query params:
 *   - q: search query
 *   - tag: filter by tag
 *   - userId: filter by creator (for user's own stories)
 */
app.get("/api/stories", async (req, res) => {
  try {
    const { q, tag, userId } = req.query;

    if (q || tag) {
      // Use search with query
      const stories = await searchStories(q || tag, {
        userId: userId ? parseInt(userId) : null,
        includePrivate: false,
      });
      res.json({ stories });
    } else {
      const stories = await listSavedStories();
      res.json({ stories });
    }
  } catch (error) {
    logger.error("Error listing stories:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TAGS API ====================

/**
 * GET /api/tags - Get all available tags
 */
app.get("/api/tags", async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json({ tags });
  } catch (error) {
    logger.error("Error fetching tags:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tags - Create a new tag
 */
app.post("/api/tags", async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tag name is required" });
    }
    const tag = await createTag(name, color);
    res.json({ tag });
  } catch (error) {
    logger.error("Error creating tag:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stories/:storyId/tags - Get tags for a story
 */
app.get("/api/stories/:storyId/tags", async (req, res) => {
  try {
    const id = extractStoryId(req.params.storyId);
    const tags = await getTagsByStoryId(id);
    res.json({ tags });
  } catch (error) {
    logger.error("Error fetching story tags:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/stories/:storyId/tags - Set tags for a story (requires ownership)
 */
app.put("/api/stories/:storyId/tags", async (req, res) => {
  try {
    const id = extractStoryId(req.params.storyId);
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "Tags must be an array" });
    }
    await setStoryTags(id, tags);
    const updatedTags = await getTagsByStoryId(id);
    res.json({ tags: updatedTags });
  } catch (error) {
    logger.error("Error setting story tags:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FAVORITES API ====================

/**
 * GET /api/users/:userId/favorites - Get user's favorite stories
 */
app.get("/api/users/:userId/favorites", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const favorites = await getUserFavorites(userId);
    res.json({ favorites });
  } catch (error) {
    logger.error("Error fetching favorites:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/favorite-ids - Get just the IDs of favorited stories
 */
app.get("/api/users/:userId/favorite-ids", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const ids = await getUserFavoriteIds(userId);
    res.json({ favoriteIds: ids });
  } catch (error) {
    logger.error("Error fetching favorite IDs:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users/:userId/favorites - Add a story to favorites
 */
app.post("/api/users/:userId/favorites", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { storyId } = req.body;
    if (!storyId) {
      return res.status(400).json({ error: "storyId is required" });
    }
    await addFavorite(userId, extractStoryId(storyId));
    res.json({ success: true, message: "Added to favorites" });
  } catch (error) {
    logger.error("Error adding favorite:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/users/:userId/favorites/:storyId - Remove from favorites
 */
app.delete("/api/users/:userId/favorites/:storyId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const storyId = extractStoryId(req.params.storyId);
    await removeFavorite(userId, storyId);
    res.json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    logger.error("Error removing favorite:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== READING HISTORY API ====================

/**
 * GET /api/users/:userId/reading - Get currently reading stories
 */
app.get("/api/users/:userId/reading", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const reading = await getCurrentlyReading(userId);
    res.json({ reading });
  } catch (error) {
    logger.error("Error fetching reading list:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/reading/history - Get reading history
 */
app.get("/api/users/:userId/reading/history", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const history = await getReadingHistory(userId);
    res.json({ history });
  } catch (error) {
    logger.error("Error fetching reading history:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/reading/:storyId - Get reading progress for a story
 */
app.get("/api/users/:userId/reading/:storyId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const storyId = extractStoryId(req.params.storyId);
    const progress = await getReadingProgress(userId, storyId);
    res.json({ progress });
  } catch (error) {
    logger.error("Error fetching reading progress:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/users/:userId/reading/:storyId - Update reading progress
 */
app.put("/api/users/:userId/reading/:storyId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const storyId = extractStoryId(req.params.storyId);
    const { currentPage, totalPages } = req.body;

    if (currentPage === undefined || totalPages === undefined) {
      return res
        .status(400)
        .json({ error: "currentPage and totalPages are required" });
    }

    const progress = await updateReadingProgress(
      userId,
      storyId,
      currentPage,
      totalPages
    );
    res.json({ progress });
  } catch (error) {
    logger.error("Error updating reading progress:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUTH API ====================

/**
 * POST /api/auth/google - Authenticate with Google token
 */
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Credential is required" });
    }

    // Decode JWT (in production, verify with Google)
    const base64Url = credential.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString());

    const user = await findOrCreateUser({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

    // Save user ID in prompt context for tracing
    setPromptContext({ userId: user.id });
    logger.info(`User logged in: ${user.email} (ID: ${user.id})`);

    res.json({ user, token: credential });
  } catch (error) {
    logger.error("Error authenticating:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== USER PROFILES API ====================

/**
 * GET /api/users/:userId/profile - Get user profile
 */
app.get("/api/users/:userId/profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ profile });
  } catch (error) {
    logger.error("Error fetching profile:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/users/:userId/profile - Update user profile
 */
app.put("/api/users/:userId/profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { name, username, bio, isPublic } = req.body;

    await updateUserProfile(userId, { name, username, bio, isPublic });
    const profile = await getUserProfile(userId);

    res.json({ profile });
  } catch (error) {
    logger.error("Error updating profile:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/stories - Get user's stories
 */
app.get("/api/users/:userId/stories", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const viewerId = req.query.viewerId ? parseInt(req.query.viewerId) : null;
    const stories = await getUserStoriesByUserId(userId, viewerId);
    res.json({ stories });
  } catch (error) {
    logger.error("Error fetching user stories:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FOLLOWERS API ====================

/**
 * GET /api/users/:userId/followers - Get user's followers
 */
app.get("/api/users/:userId/followers", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const followers = await getFollowers(userId);
    res.json({ followers });
  } catch (error) {
    logger.error("Error fetching followers:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/following - Get users that this user follows
 */
app.get("/api/users/:userId/following", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const following = await getFollowing(userId);
    res.json({ following });
  } catch (error) {
    logger.error("Error fetching following:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users/:userId/follow - Follow a user
 */
app.post("/api/users/:userId/follow", async (req, res) => {
  try {
    const followingId = parseInt(req.params.userId);
    const { followerId } = req.body;

    if (!followerId) {
      return res.status(400).json({ error: "followerId is required" });
    }

    await followUser(parseInt(followerId), followingId);
    res.json({ success: true, message: "Now following user" });
  } catch (error) {
    logger.error("Error following user:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/users/:userId/follow - Unfollow a user
 */
app.delete("/api/users/:userId/follow", async (req, res) => {
  try {
    const followingId = parseInt(req.params.userId);
    const followerId = parseInt(req.query.followerId);

    if (!followerId) {
      return res.status(400).json({ error: "followerId is required" });
    }

    await unfollowUser(followerId, followingId);
    res.json({ success: true, message: "Unfollowed user" });
  } catch (error) {
    logger.error("Error unfollowing user:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId/is-following/:targetId - Check if following
 */
app.get("/api/users/:userId/is-following/:targetId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const targetId = parseInt(req.params.targetId);
    const following = await isFollowing(userId, targetId);
    res.json({ isFollowing: following });
  } catch (error) {
    logger.error("Error checking follow status:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PERSONALIZED FEED API ====================

/**
 * GET /api/feed - Get personalized story feed
 */
app.get("/api/feed", async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId) : null;

    if (userId) {
      const feed = await getPersonalizedFeed(userId);
      res.json({ stories: feed });
    } else {
      // Guest user - return regular list
      const stories = await listSavedStories();
      res.json({ stories });
    }
  } catch (error) {
    logger.error("Error fetching feed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract story ID from various formats
function extractStoryId(storyIdParam) {
  if (typeof storyIdParam === "number") return storyIdParam;
  if (storyIdParam.startsWith("story_")) {
    return parseInt(storyIdParam.replace("story_", ""), 10);
  }
  return parseInt(storyIdParam, 10);
}

/**
 * GET /api/drafts - List all drafts (optionally filtered by userId)
 */
app.get("/api/drafts", async (req, res) => {
  try {
    const { userId } = req.query;
    const drafts = await listDrafts(userId ? parseInt(userId, 10) : null);
    res.json({ drafts });
  } catch (error) {
    logger.error("Error listing drafts:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/drafts/:jobId - Get a specific draft
 */
app.get("/api/drafts/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const draft = await loadDraft(jobId);
    res.json({ draft });
  } catch (error) {
    logger.error("Error loading draft:", error.message);
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "Draft not found" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * POST /api/drafts - Create a new draft from step 1
 */
app.post("/api/drafts", async (req, res) => {
  try {
    const { story, targetAudience, userId } = req.body;

    if (!story) {
      return res.status(400).json({ error: "Story text is required" });
    }

    // Validate userId - must be a valid database integer ID that exists in users table
    let validUserId = null;
    if (userId !== null && userId !== undefined) {
      const parsedId = parseInt(userId, 10);
      // Check if it's a valid small integer (database IDs are typically < 2 billion)
      if (!isNaN(parsedId) && parsedId > 0 && parsedId < 2147483647) {
        // Verify user exists in database
        const user = await getUserById(parsedId);
        if (user) {
          validUserId = parsedId;
        }
      }
    }

    // Generate a job ID for this draft
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create initial draft data (pageCount will be auto-determined by PageAgent)
    const draftData = {
      story,
      status: "draft",
      phase: "story_input",
      progress: 0,
      message: "Story saved as draft",
      pageCount: null, // Auto-determined later by PageAgent
      targetAudience: targetAudience || "children",
      artStyleDecision: null,
      characters: [],
      storyPages: null,
      cover: null,
    };

    // Save to database
    await saveDraft(jobId, draftData, validUserId);

    // Also add to active jobs so it can be continued
    activeJobs.set(jobId, {
      ...draftData,
      createdAt: new Date().toISOString(),
    });

    logger.info(`Created new draft: ${jobId}`);

    res.json({
      success: true,
      jobId,
      message: "Draft created successfully",
    });
  } catch (error) {
    logger.error("Error creating draft:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/drafts/:jobId - Update an existing draft
 */
app.put("/api/drafts/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;

    // Validate userId - must be a valid database integer ID that exists in users table
    let validUserId = null;
    if (updates.userId !== null && updates.userId !== undefined) {
      const parsedId = parseInt(updates.userId, 10);
      // Check if it's a valid small integer (database IDs are typically < 2 billion)
      if (!isNaN(parsedId) && parsedId > 0 && parsedId < 2147483647) {
        // Verify user exists in database
        const user = await getUserById(parsedId);
        if (user) {
          validUserId = parsedId;
        }
      }
    }

    // Get existing draft or job
    let existingData = activeJobs.get(jobId);
    if (!existingData) {
      try {
        existingData = await loadDraft(jobId);
      } catch (e) {
        return res.status(404).json({ error: "Draft not found" });
      }
    }

    // Merge updates
    const updatedData = {
      ...existingData,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save updated draft
    await saveDraft(jobId, updatedData, validUserId);

    // Update active jobs
    activeJobs.set(jobId, updatedData);

    res.json({
      success: true,
      jobId,
      message: "Draft updated successfully",
    });
  } catch (error) {
    logger.error("Error updating draft:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/drafts/:jobId/resume - Resume a draft and restore job state
 */
app.post("/api/drafts/:jobId/resume", async (req, res) => {
  try {
    const { jobId } = req.params;
    const draft = await loadDraft(jobId);

    // Restore job to active jobs
    activeJobs.set(jobId, {
      ...draft,
      resumedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      jobId,
      draft,
      message: "Draft resumed successfully",
    });
  } catch (error) {
    logger.error("Error resuming draft:", error.message);
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "Draft not found" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * DELETE /api/drafts/:jobId - Delete a draft
 */
app.delete("/api/drafts/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await deleteDraft(jobId);

    if (success) {
      // Also remove from active jobs if present
      activeJobs.delete(jobId);
      res.json({ success: true, message: "Draft deleted" });
    } else {
      res.status(500).json({ error: "Failed to delete draft" });
    }
  } catch (error) {
    logger.error("Error deleting draft:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/drafts/save - Manually save current job as draft
 */
app.post("/api/drafts/save", async (req, res) => {
  try {
    const { jobId } = req.body;

    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    await saveDraft(jobId, job);

    res.json({
      success: true,
      message: "Draft saved successfully",
    });
  } catch (error) {
    logger.error("Error saving draft:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stories/:storyId - Get a specific saved story
 * Supports both new format (story_123) and legacy format (story_output_xxx.json)
 */
app.get("/api/stories/:storyId", async (req, res) => {
  try {
    const { storyId } = req.params;

    // Extract numeric ID from various formats
    let id = storyId;
    if (storyId.startsWith("story_output_")) {
      // Legacy format - not supported in MySQL mode
      return res.status(400).json({
        error:
          "Legacy JSON format not supported. Please use story ID (e.g., story_123 or just 123)",
      });
    } else if (storyId.startsWith("story_")) {
      id = storyId.replace("story_", "");
    }

    const story = await loadJson(id);
    res.json({ story });
  } catch (error) {
    logger.error("Error loading story:", error.message);
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "Story not found" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * DELETE /api/stories/:storyId - Delete a saved story
 */
app.delete("/api/stories/:storyId", async (req, res) => {
  try {
    const { storyId } = req.params;

    // Extract numeric ID
    let id = storyId;
    if (storyId.startsWith("story_")) {
      id = storyId.replace("story_", "");
    }

    // Get the story to verify ownership
    const story = await getStoryById(id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    // Verify the user owns this story
    const requestUserId = req.userId;
    if (!requestUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (story.user_id !== requestUserId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own stories" });
    }

    const success = await deleteStory(id);
    if (success) {
      res.json({ success: true, message: "Story deleted" });
    } else {
      res.status(500).json({ error: "Failed to delete story" });
    }
  } catch (error) {
    logger.error("Error deleting story:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/stories/:storyId/edit - Load a saved story into an editable job
 */
app.post("/api/stories/:storyId/edit", async (req, res) => {
  try {
    const { storyId } = req.params;

    // Extract numeric ID
    let id = storyId;
    if (storyId.startsWith("story_")) {
      id = storyId.replace("story_", "");
    }

    const storyData = await loadJson(id);

    // Create a new job from the saved story
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Reconstruct job state from saved story
    const job = {
      status: "pages_ready",
      phase: "awaiting_page_review",
      progress: 95,
      message: "Story loaded for editing. Modify pages or avatars as needed.",
      story: storyData.originalStory,
      artStyleKey: storyData.artStyleDecision?.selectedStyle || "illustration",
      artStylePrompt: storyData.artStyleDecision?.stylePrompt || null,
      artStyleDecision: storyData.artStyleDecision,
      characters: storyData.characters || [],
      storyPages: storyData.storyPages || { pages: [] },
      cover: storyData.cover || null,
      pageCount:
        storyData.metadata?.pageCount ||
        storyData.storyPages?.pages?.length ||
        6,
      targetAudience: storyData.metadata?.targetAudience || "children",
      generateCover: true,
      originalStoryId: id,
      isEditing: true,
    };

    // Mark pages and cover for re-approval
    if (job.storyPages?.pages) {
      job.storyPages.pages = job.storyPages.pages.map((page) => ({
        ...page,
        approved: false,
      }));
    }
    if (job.cover) {
      job.cover.approved = false;
    }

    // Mark characters as already generated
    job.characters = job.characters.map((char) => ({
      ...char,
      avatarGenerated: true,
      approved: false,
    }));

    activeJobs.set(jobId, job);

    res.json({
      success: true,
      jobId,
      job,
      message: "Story loaded for editing",
      editMode: true,
    });
  } catch (error) {
    logger.error("Error loading story for editing:", error.message);
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "Story not found" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * POST /api/stories/:storyId/save - Save edited story (creates new version in MySQL)
 */
app.post("/api/stories/:storyId/save", async (req, res) => {
  try {
    const { storyId } = req.params;
    const { jobId } = req.body;

    // Extract numeric ID
    let originalId = storyId;
    if (storyId.startsWith("story_")) {
      originalId = storyId.replace("story_", "");
    }

    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Build updated story data
    const updatedStory = {
      originalStory: job.story,
      artStyleDecision: job.artStyleDecision,
      characters: job.characters,
      storyPages: job.storyPages,
      cover: job.cover,
      metadata: {
        ...job.metadata,
        timestamp: new Date().toISOString(),
        pageCount: job.pageCount,
        targetAudience: job.targetAudience,
        lastEdited: new Date().toISOString(),
      },
    };

    // Delete old story and save new version (or update in place)
    await deleteStory(originalId);

    const newStoryId = await saveJson(updatedStory, req.userId);

    // Update job status
    job.status = "completed";
    job.phase = "complete";
    job.progress = 100;
    job.message = "Story updated successfully!";
    job.storyId = newStoryId;
    job.result = updatedStory;
    activeJobs.set(jobId, job);

    res.json({
      success: true,
      message: "Story saved successfully",
      storyId: newStoryId,
      story: updatedStory,
    });
  } catch (error) {
    logger.error("Error saving edited story:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiProvider: config.aiProvider || "openai",
    providers: {
      openai: !!config.openai.apiKey,
      gemini: !!config.gemini.apiKey,
    },
    timestamp: new Date().toISOString(),
  });
});

// Get available AI providers
app.get("/api/providers", (req, res) => {
  res.json({
    current: config.aiProvider || "openai",
    available: {
      openai: {
        enabled: !!config.openai.apiKey,
        model: config.openai.model,
        imageModel: config.openai.imageModel,
      },
      gemini: {
        enabled: !!config.gemini.apiKey,
        model: config.gemini.model,
        imageModel: config.gemini.imageModel,
      },
    },
  });
});

// ====================
// PROMPT LOGS ENDPOINTS
// ====================

// Get prompt logs with filtering
app.get("/api/prompts", async (req, res) => {
  try {
    const {
      provider,
      model,
      requestType,
      jobId,
      storyId,
      status,
      limit,
      offset,
    } = req.query;

    const logs = await getPromptLogs({
      provider,
      model,
      requestType,
      jobId,
      storyId,
      userId: req.userId,
      status,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    });

    res.json({ logs });
  } catch (error) {
    logger.error("Error fetching prompt logs:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get prompt statistics
app.get("/api/prompts/stats", async (req, res) => {
  try {
    const { startDate, endDate, provider } = req.query;

    const stats = await getPromptStats({
      startDate,
      endDate,
      provider,
    });

    res.json({ stats });
  } catch (error) {
    logger.error("Error fetching prompt stats:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get prompts for a specific job
app.get("/api/jobs/:jobId/prompts", async (req, res) => {
  try {
    const { jobId } = req.params;

    const logs = await getPromptLogs({
      jobId,
      limit: 500,
    });

    res.json({ logs });
  } catch (error) {
    logger.error("Error fetching job prompts:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get prompts for a specific story
app.get("/api/stories/:storyId/prompts", async (req, res) => {
  try {
    const { storyId } = req.params;

    const logs = await getPromptLogs({
      storyId: parseInt(storyId),
      limit: 500,
    });

    res.json({ logs });
  } catch (error) {
    logger.error("Error fetching story prompts:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BATCH REQUESTS API ====================

// Store active batch processing jobs
const activeBatchJobs = new Map();

/**
 * POST /api/batch/create - Create a new batch request for illustration generation
 */
app.post("/api/batch/create", async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!jobId) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const pageCount = job.storyPages?.pages?.length || 0;
    const storyTitle = job.storyPages?.title || "Untitled Story";
    // Include cover in total count if it needs to be generated
    const needsCover = job.generateCover !== false && !job.cover?.illustrationUrl;
    const totalPages = pageCount + (needsCover ? 1 : 0);

    // Create batch request in database
    const batchId = await insert(
      `INSERT INTO batch_requests (user_id, job_id, story_title, total_pages, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, jobId, storyTitle, totalPages]
    );

    // Start batch processing
    processBatchRequest(batchId, jobId, userId);

    res.json({
      success: true,
      batchId,
      message: "Batch request created",
      totalPages,
    });
  } catch (error) {
    logger.error("Error creating batch request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/batch/list - List batch requests for current user
 */
app.get("/api/batch/list", async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batches = await query(
      `SELECT * FROM batch_requests 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json({ batches });
  } catch (error) {
    logger.error("Error listing batch requests:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/batch/:batchId - Get batch request status
 */
app.get("/api/batch/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;
    const userId = req.userId;

    const batches = await query(`SELECT * FROM batch_requests WHERE id = ?`, [
      parseInt(batchId),
    ]);

    if (batches.length === 0) {
      return res.status(404).json({ error: "Batch request not found" });
    }

    const batch = batches[0];

    // Verify ownership
    if (batch.user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ batch });
  } catch (error) {
    logger.error("Error fetching batch request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/batch/:batchId/cancel - Cancel a pending batch request
 */
app.post("/api/batch/:batchId/cancel", async (req, res) => {
  try {
    const { batchId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const batches = await query(`SELECT * FROM batch_requests WHERE id = ?`, [
      parseInt(batchId),
    ]);

    if (batches.length === 0) {
      return res.status(404).json({ error: "Batch request not found" });
    }

    const batch = batches[0];

    if (batch.user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (batch.status === "completed" || batch.status === "cancelled") {
      return res.status(400).json({ error: "Batch already " + batch.status });
    }

    // Mark as cancelled
    await query(
      `UPDATE batch_requests SET status = 'cancelled', completed_at = NOW() WHERE id = ?`,
      [parseInt(batchId)]
    );

    // Remove from active processing
    activeBatchJobs.delete(parseInt(batchId));

    res.json({ success: true, message: "Batch request cancelled" });
  } catch (error) {
    logger.error("Error cancelling batch request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process batch request asynchronously
 */
async function processBatchRequest(batchId, jobId, userId) {
  try {
    // Mark as processing
    await query(
      `UPDATE batch_requests SET status = 'processing', started_at = NOW() WHERE id = ?`,
      [batchId]
    );

    activeBatchJobs.set(batchId, { jobId, status: "processing" });

    const job = activeJobs.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    setPromptContext({ jobId, userId });

    const artStyleAgent = new ArtStyleAgent();
    const illustrationAgent = new IllustrationAgent();
    illustrationAgent.setCharacterReference(job.characters);

    const artStylePrompt =
      job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

    const pages = job.storyPages?.pages || [];
    let completedCount = 0;

    // Generate illustrations for each page
    for (let i = 0; i < pages.length; i++) {
      // Check if cancelled
      if (!activeBatchJobs.has(batchId)) {
        logger.info(`Batch ${batchId} was cancelled, stopping processing`);
        return;
      }

      const page = pages[i];

      // Skip if already has illustration
      if (page.illustrationGenerated || page.illustrationUrl) {
        completedCount++;
        continue;
      }

      try {
        logger.info(
          `Batch ${batchId}: Generating illustration for page ${page.pageNumber}`
        );

        const illustratedPage =
          await illustrationAgent.generatePageIllustration(page, {
            artStyle: artStylePrompt,
          });

        // Update page in job
        illustratedPage.illustrationUrl = getImageUrl(illustratedPage.illustrationPath, "page");
        illustratedPage.illustrationGenerated = true;

        job.storyPages.pages[i] = illustratedPage;
        activeJobs.set(jobId, job);

        completedCount++;

        // Update progress in database
        await query(
          `UPDATE batch_requests SET completed_pages = ? WHERE id = ?`,
          [completedCount, batchId]
        );

        // Save draft progress
        await saveDraft(jobId, job);
      } catch (pageError) {
        logger.error(
          `Batch ${batchId}: Error generating page ${page.pageNumber}:`,
          pageError.message
        );
      }
    }

    // Generate cover if needed
    if (job.generateCover !== false && !job.cover?.illustrationUrl) {
      // Check if cancelled
      if (!activeBatchJobs.has(batchId)) {
        logger.info(`Batch ${batchId} was cancelled, stopping processing`);
        return;
      }

      try {
        logger.info(`Batch ${batchId}: Generating cover illustration`);
        const cover = await illustrationAgent.generateCoverIllustration(
          job.storyPages,
          job.characters,
          { artStyle: artStylePrompt }
        );

        cover.illustrationUrl = getImageUrl(cover.illustrationPath, "page");

        job.cover = cover;
        activeJobs.set(jobId, job);
        await saveDraft(jobId, job);

        // Increment completed count for cover
        completedCount++;
        await query(
          `UPDATE batch_requests SET completed_pages = ? WHERE id = ?`,
          [completedCount, batchId]
        );
      } catch (coverError) {
        logger.error(
          `Batch ${batchId}: Error generating cover:`,
          coverError.message
        );
      }
    }

    // Update job status
    job.status = "pages_ready";
    job.phase = "awaiting_page_review";
    job.progress = 95;
    job.message = "All illustrations generated. Ready for review.";
    activeJobs.set(jobId, job);
    await saveDraft(jobId, job);

    // Mark batch as completed
    await query(
      `UPDATE batch_requests SET status = 'completed', completed_pages = ?, completed_at = NOW() WHERE id = ?`,
      [completedCount, batchId]
    );

    activeBatchJobs.delete(batchId);
    logger.success(
      `Batch ${batchId} completed: ${completedCount} pages generated`
    );
  } catch (error) {
    logger.error(`Batch ${batchId} failed:`, error.message);

    await query(
      `UPDATE batch_requests SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
      [error.message, batchId]
    );

    activeBatchJobs.delete(batchId);
  }
}

// Start server
app.listen(PORT, () => {
  logger.section("Story Agents API Server");
  logger.success(`Server running on http://localhost:${PORT}`);
  logger.info(`API Key configured: ${config.openai.apiKey ? "Yes" : "No"}`);
  logger.info(`AI Provider: ${config.aiProvider || "openai"}`);
  logger.info(`Log level: ${process.env.LOG_LEVEL || "info"}`);
});

export default app;
