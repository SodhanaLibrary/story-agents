import {
  getPromptLogs,
  getPromptStats,
} from "../../src/services/promptLogger.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("PromptsRoutes");

/**
 * Register prompt log routes.
 * @param {import('express').Application} app
 */
export function registerPromptsRoutes(app) {
  app.get("/api/v1/prompts", async (req, res) => {
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

  app.get("/api/v1/prompts/stats", async (req, res) => {
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

  app.get("/api/v1/jobs/:jobId/prompts", async (req, res) => {
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

  app.get("/api/v1/stories/:storyId/prompts", async (req, res) => {
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
}
