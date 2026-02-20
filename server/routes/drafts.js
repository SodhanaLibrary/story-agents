import { getUserById } from "../../src/services/storyRepository.js";
import {
  saveDraft,
  loadDraft,
  listDrafts,
  deleteDraft,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("DraftsRoutes");

/**
 * Register draft routes.
 * @param {import('express').Application} app
 * @param {{ activeJobs: Map }} deps
 */
export function registerDraftsRoutes(app, deps) {
  const { activeJobs } = deps;

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

  app.post("/api/drafts", async (req, res) => {
    try {
      const { story, targetAudience, genre, userId } = req.body;

      if (!story) {
        return res.status(400).json({ error: "Story text is required" });
      }

      let validUserId = null;
      if (userId !== null && userId !== undefined) {
        const parsedId = parseInt(userId, 10);
        if (
          !isNaN(parsedId) &&
          parsedId > 0 &&
          parsedId < 2147483647
        ) {
          const user = await getUserById(parsedId);
          if (user) {
            validUserId = parsedId;
          }
        }
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const draftData = {
        story,
        status: "draft",
        phase: "story_input",
        progress: 0,
        message: "Story saved as draft",
        pageCount: null,
        targetAudience: targetAudience || "children",
        genre: genre != null && String(genre).trim() ? String(genre).trim() : null,
        artStyleDecision: null,
        characters: [],
        storyPages: null,
        cover: null,
      };

      await saveDraft(jobId, draftData, validUserId);

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

  app.put("/api/drafts/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const updates = req.body;

      let validUserId = null;
      if (updates.userId !== null && updates.userId !== undefined) {
        const parsedId = parseInt(updates.userId, 10);
        if (
          !isNaN(parsedId) &&
          parsedId > 0 &&
          parsedId < 2147483647
        ) {
          const user = await getUserById(parsedId);
          if (user) {
            validUserId = parsedId;
          }
        }
      }

      let existingData = activeJobs.get(jobId);
      if (!existingData) {
        try {
          existingData = await loadDraft(jobId);
        } catch (e) {
          return res.status(404).json({ error: "Draft not found" });
        }
      }

      const updatedData = {
        ...existingData,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await saveDraft(jobId, updatedData, validUserId);
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

  app.post("/api/drafts/:jobId/resume", async (req, res) => {
    try {
      const { jobId } = req.params;
      const draft = await loadDraft(jobId);

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

  app.delete("/api/drafts/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const success = await deleteDraft(jobId);

      if (success) {
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
}
