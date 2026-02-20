import {
  getVolumesByUserId,
  getVolumeById,
  getStoriesByVolumeId,
  createVolume,
  updateVolume,
  deleteVolume,
  setStoryVolume,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("VolumesRoutes");

/**
 * Register volume routes. Some require auth (create, update, delete, setStoryVolume).
 * @param {import('express').Application} app
 */
export function registerVolumesRoutes(app) {
  // List volumes by user (public)
  app.get("/api/users/:userId/volumes", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
      const volumes = await getVolumesByUserId(userId);
      res.json({ volumes });
    } catch (error) {
      logger.error("Error fetching user volumes:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Create volume (auth, must be own userId)
  app.post("/api/users/:userId/volumes", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      const targetUserId = parseInt(req.params.userId, 10);
      if (targetUserId !== userId) return res.status(403).json({ error: "Can only create volumes for yourself" });
      const { title, description } = req.body || {};
      const id = await createVolume(userId, { title, description });
      const volume = (await getVolumesByUserId(userId)).find((v) => v.id === id);
      res.status(201).json(volume || { id, userId, title: title?.trim(), description: description?.trim() || null, storyCount: 0 });
    } catch (error) {
      if (error.message === "Volume title is required")
        return res.status(400).json({ error: error.message });
      logger.error("Error creating volume:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single volume (public metadata)
  app.get("/api/volumes/:volumeId", async (req, res) => {
    try {
      const volumeId = parseInt(req.params.volumeId, 10);
      if (isNaN(volumeId)) return res.status(400).json({ error: "Invalid volume ID" });
      const volume = await getVolumeById(volumeId, req.userId || null);
      if (!volume) return res.status(404).json({ error: "Volume not found" });
      res.json(volume);
    } catch (error) {
      logger.error("Error fetching volume:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get volume with its stories (public, respecting is_public)
  app.get("/api/volumes/:volumeId/stories", async (req, res) => {
    try {
      const volumeId = parseInt(req.params.volumeId, 10);
      if (isNaN(volumeId)) return res.status(400).json({ error: "Invalid volume ID" });
      const data = await getStoriesByVolumeId(volumeId, req.userId || null);
      if (!data) return res.status(404).json({ error: "Volume not found" });
      res.json(data);
    } catch (error) {
      logger.error("Error fetching volume stories:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Update volume (auth, owner only)
  app.put("/api/volumes/:volumeId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      const volumeId = parseInt(req.params.volumeId, 10);
      if (isNaN(volumeId)) return res.status(400).json({ error: "Invalid volume ID" });
      const { title, description } = req.body || {};
      await updateVolume(volumeId, userId, { title, description });
      const volume = await getVolumeById(volumeId);
      res.json(volume);
    } catch (error) {
      logger.error("Error updating volume:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete volume (auth, owner only)
  app.delete("/api/volumes/:volumeId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      const volumeId = parseInt(req.params.volumeId, 10);
      if (isNaN(volumeId)) return res.status(400).json({ error: "Invalid volume ID" });
      await deleteVolume(volumeId, userId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error deleting volume:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Assign story to volume or remove (auth, story owner only)
  app.put("/api/stories/:storyId/volume", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      const storyId = parseInt(req.params.storyId, 10);
      if (isNaN(storyId)) return res.status(400).json({ error: "Invalid story ID" });
      const volumeId = req.body?.volumeId === null || req.body?.volumeId === undefined
        ? null
        : parseInt(req.body?.volumeId, 10);
      if (volumeId !== null && isNaN(volumeId)) return res.status(400).json({ error: "Invalid volume ID" });
      await setStoryVolume(storyId, userId, volumeId);
      res.json({ success: true });
    } catch (error) {
      if (error.message === "Story not found" || error.message === "Volume not found")
        return res.status(404).json({ error: error.message });
      if (error.message.includes("Not authorized"))
        return res.status(403).json({ error: error.message });
      logger.error("Error setting story volume:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
