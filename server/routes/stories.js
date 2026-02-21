import {
  searchStories,
  listSavedStories,
  getAllTags,
  createTag,
  getTagsByStoryId,
  setStoryTags,
  getUserFavorites,
  getUserFavoriteIds,
  addFavorite,
  removeFavorite,
  getCurrentlyReading,
  getReadingHistory,
  getReadingProgress,
  updateReadingProgress,
  loadJson,
  updateJson,
  getStoryById,
  deleteStory,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("StoriesRoutes");

function extractStoryId(storyIdParam) {
  if (typeof storyIdParam === "number") return storyIdParam;
  if (storyIdParam.startsWith("story_")) {
    return parseInt(storyIdParam.replace("story_", ""), 10);
  }
  return parseInt(storyIdParam, 10);
}

/**
 * Register story, tags, favorites, and reading routes.
 * @param {import('express').Application} app
 * @param {{ activeJobs: Map }} deps
 */
export function registerStoriesRoutes(app, deps) {
  const { activeJobs } = deps;

  app.get("/api/v1/stories", async (req, res) => {
    try {
      const { q, tag, userId } = req.query;

      if (q || tag) {
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

  app.get("/api/v1/tags", async (req, res) => {
    try {
      const tags = await getAllTags();
      res.json({ tags });
    } catch (error) {
      logger.error("Error fetching tags:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/v1/tags", async (req, res) => {
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

  app.get("/api/v1/stories/:storyId/tags", async (req, res) => {
    try {
      const id = extractStoryId(req.params.storyId);
      const tags = await getTagsByStoryId(id);
      res.json({ tags });
    } catch (error) {
      logger.error("Error fetching story tags:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/v1/stories/:storyId/tags", async (req, res) => {
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

  app.get("/api/v1/users/:userId/favorites", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const favorites = await getUserFavorites(userId);
      res.json({ favorites });
    } catch (error) {
      logger.error("Error fetching favorites:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/users/:userId/favorite-ids", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const ids = await getUserFavoriteIds(userId);
      res.json({ favoriteIds: ids });
    } catch (error) {
      logger.error("Error fetching favorite IDs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/v1/users/:userId/favorites", async (req, res) => {
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

  app.delete("/api/v1/users/:userId/favorites/:storyId", async (req, res) => {
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

  app.get("/api/v1/users/:userId/reading", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const reading = await getCurrentlyReading(userId);
      res.json({ reading });
    } catch (error) {
      logger.error("Error fetching reading list:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/users/:userId/reading/history", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const history = await getReadingHistory(userId);
      res.json({ history });
    } catch (error) {
      logger.error("Error fetching reading history:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/users/:userId/reading/:storyId", async (req, res) => {
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

  app.put("/api/v1/users/:userId/reading/:storyId", async (req, res) => {
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
        totalPages,
      );
      res.json({ progress });
    } catch (error) {
      logger.error("Error updating reading progress:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/stories/:storyId", async (req, res) => {
    try {
      const { storyId } = req.params;

      let id = storyId;
      if (storyId.startsWith("story_output_")) {
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

  app.delete("/api/v1/stories/:storyId", async (req, res) => {
    try {
      const { storyId } = req.params;

      let id = storyId;
      if (storyId.startsWith("story_")) {
        id = storyId.replace("story_", "");
      }

      const story = await getStoryById(id);
      if (!story) {
        return res.status(404).json({ error: "Story not found" });
      }

      const requestUserId = req.userId;
      if (!requestUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (story.userId !== requestUserId) {
        logger.warn(
          `Delete story ${id} denied: story.userId=${story.userId}, requestUserId=${requestUserId}`,
        );
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

  app.post("/api/v1/stories/:storyId/edit", async (req, res) => {
    try {
      const { storyId } = req.params;

      let id = storyId;
      if (storyId.startsWith("story_")) {
        id = storyId.replace("story_", "");
      }

      const storyData = await loadJson(id);

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const job = {
        status: "pages_ready",
        phase: "awaiting_page_review",
        progress: 95,
        message:
          "Story loaded for editing. Modify pages or avatars as needed.",
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
        genre: storyData.metadata?.genre || null,
        generateCover: true,
        originalStoryId: id,
        isEditing: true,
      };

      if (job.storyPages?.pages) {
        job.storyPages.pages = job.storyPages.pages.map((page) => ({
          ...page,
          approved: false,
        }));
      }
      if (job.cover) {
        job.cover.approved = false;
      }

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

  app.post("/api/v1/stories/:storyId/save", async (req, res) => {
    try {
      const { storyId } = req.params;
      const { jobId } = req.body;

      let originalId = storyId;
      if (storyId.startsWith("story_")) {
        originalId = storyId.replace("story_", "");
      }

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

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

      await updateJson(originalId, updatedStory);

      job.status = "completed";
      job.phase = "complete";
      job.progress = 100;
      job.message = "Story updated successfully!";
      job.storyId = originalId;
      job.result = updatedStory;
      activeJobs.set(jobId, job);

      res.json({
        success: true,
        message: "Story saved successfully",
        storyId: originalId,
        story: updatedStory,
      });
    } catch (error) {
      logger.error("Error saving edited story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
