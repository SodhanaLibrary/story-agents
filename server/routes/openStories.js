import path from "path";
import {
  getOpenStorySubmissions,
  getOpenStorySubmissionById,
  createOpenStorySubmission,
  updateOpenStorySubmission,
  deleteOpenStorySubmission,
  toggleOpenStoryVote,
  getOpenStoryComments,
  createOpenStoryComment,
  getOpenStoryCommentById,
  updateOpenStoryComment,
  deleteOpenStoryComment,
  createOpenStoryImage,
  getOpenStoryImages,
  deleteOpenStoryImage,
} from "../../src/services/storyRepository.js";
import { saveImage, deleteImage } from "../../src/utils/storage.js";
import { checkStoryContent } from "../../src/services/contentModerator.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("OpenStoriesRoutes");

function imageUrlToPublic(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `/storage/open-stories/${path.basename(url)}`;
}

/**
 * Register open story submission and vote routes.
 * @param {import('express').Application} app
 */
export function registerOpenStoriesRoutes(app) {
  app.get("/api/open-stories", async (req, res) => {
    try {
      const userId = req.userId || null;
      const list = await getOpenStorySubmissions(userId);
      res.json({ submissions: list });
    } catch (error) {
      logger.error("Error listing open stories:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/open-stories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission)
        return res.status(404).json({ error: "Submission not found" });
      const list = await getOpenStorySubmissions(req.userId || null);
      const one = list.find((s) => s.id === id);
      if (one) {
        submission.vote_count = one.vote_count;
        submission.user_has_voted = one.user_has_voted;
      }
      const imageRows = await getOpenStoryImages(id);
      submission.images = imageRows.map((row) => ({
        id: row.id,
        submission_id: row.submission_id,
        image_url: imageUrlToPublic(row.image_url),
        sort_order: row.sort_order,
        created_at: row.created_at,
      }));
      res.json(submission);
    } catch (error) {
      logger.error("Error fetching open story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/open-stories", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const { title, story, genre } = req.body;
      if (!title || !String(title).trim())
        return res.status(400).json({ error: "Title is required" });
      if (!story || !String(story).trim())
        return res.status(400).json({ error: "Story text is required" });

      const moderation = await checkStoryContent(String(story).trim());
      if (!moderation.safe) {
        return res.status(400).json({
          error: "Content not allowed",
          reason: moderation.reason || "Story contains content that is not permitted.",
        });
      }

      const submission = await createOpenStorySubmission(
        userId,
        String(title).trim(),
        String(story).trim(),
        genre != null ? String(genre).trim() : null,
      );
      res.status(201).json(submission);
    } catch (error) {
      logger.error("Error creating open story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/open-stories/:id", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const { title, story, genre } = req.body;

      if (story != null && String(story).trim()) {
        const moderation = await checkStoryContent(String(story).trim());
        if (!moderation.safe) {
          return res.status(400).json({
            error: "Content not allowed",
            reason: moderation.reason || "Story contains content that is not permitted.",
          });
        }
      }

      const submission = await updateOpenStorySubmission(id, userId, {
        title: title != null ? String(title).trim() : undefined,
        storyText: story != null ? String(story).trim() : undefined,
        genre: genre !== undefined ? (genre != null ? String(genre).trim() : null) : undefined,
      });
      if (!submission)
        return res.status(403).json({ error: "You can only edit your own story" });
      res.json(submission);
    } catch (error) {
      logger.error("Error updating open story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/open-stories/:id", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission || submission.user_id !== userId)
        return res.status(403).json({ error: "You can only delete your own story" });
      // Delete uploaded image files from storage before deleting the submission
      const images = await getOpenStoryImages(id);
      for (const row of images) {
        if (row.image_url) {
          try {
            await deleteImage(row.image_url);
          } catch (err) {
            logger.warn("Failed to delete open story image file:", row.image_url, err.message);
          }
        }
      }
      const deleted = await deleteOpenStorySubmission(id, userId);
      if (!deleted)
        return res.status(403).json({ error: "You can only delete your own story" });
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting open story:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/open-stories/:id/vote", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await toggleOpenStoryVote(id, userId);
      res.json(result);
    } catch (error) {
      logger.error("Error toggling vote:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/open-stories/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission)
        return res.status(404).json({ error: "Submission not found" });
      const comments = await getOpenStoryComments(id);
      res.json({ comments });
    } catch (error) {
      logger.error("Error fetching comments:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/open-stories/:id/comments", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission)
        return res.status(404).json({ error: "Submission not found" });
      const { comment } = req.body;
      if (!comment || !String(comment).trim())
        return res.status(400).json({ error: "Comment text is required" });
      const created = await createOpenStoryComment(
        id,
        userId,
        String(comment).trim(),
      );
      res.status(201).json(created);
    } catch (error) {
      logger.error("Error creating comment:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/open-stories/:id/comments/:commentId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(id) || isNaN(commentId))
        return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission)
        return res.status(404).json({ error: "Submission not found" });
      const { comment } = req.body;
      if (!comment || !String(comment).trim())
        return res.status(400).json({ error: "Comment text is required" });
      const updated = await updateOpenStoryComment(
        commentId,
        userId,
        String(comment).trim(),
      );
      if (!updated)
        return res.status(403).json({ error: "You can only edit your own comment" });
      res.json(updated);
    } catch (error) {
      logger.error("Error updating comment:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/open-stories/:id/comments/:commentId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId))
        return res.status(400).json({ error: "Invalid ID" });
      const deleted = await deleteOpenStoryComment(commentId, userId);
      if (!deleted)
        return res.status(403).json({ error: "You can only delete your own comment" });
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting comment:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/open-stories/:id/images", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const submission = await getOpenStorySubmissionById(id);
      if (!submission)
        return res.status(404).json({ error: "Submission not found" });
      if (submission.user_id !== userId)
        return res.status(403).json({ error: "You can only add images to your own story" });
      const { image } = req.body;
      if (!image || typeof image !== "string")
        return res.status(400).json({ error: "Image data (base64) is required" });
      const name = `sub_${id}_${Date.now()}`;
      const savedPathOrUrl = await saveImage(image, "open_story", name);
      const existing = await getOpenStoryImages(id);
      const sortOrder = existing.length;
      const created = await createOpenStoryImage(id, savedPathOrUrl, sortOrder);
      res.status(201).json({
        id: created.id,
        submission_id: created.submission_id,
        image_url: imageUrlToPublic(created.image_url),
        sort_order: created.sort_order,
        created_at: created.created_at,
      });
    } catch (error) {
      logger.error("Error uploading open story image:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/open-stories/:id/images/:imageId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const imageId = parseInt(req.params.imageId, 10);
      if (isNaN(imageId))
        return res.status(400).json({ error: "Invalid image ID" });
      const deleted = await deleteOpenStoryImage(imageId, userId);
      if (!deleted)
        return res.status(403).json({ error: "You can only delete images from your own story" });
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting open story image:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
