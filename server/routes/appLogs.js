import {
  getAppLogs,
  getAppLogStats,
  clearOldAppLogs,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("AppLogsRoutes");

/**
 * Register app log routes.
 * @param {import('express').Application} app
 */
export function registerAppLogsRoutes(app) {
  app.get("/api/app-logs", async (req, res) => {
    try {
      const { level, context, jobId, userId, search, limit, offset } =
        req.query;

      const logs = await getAppLogs({
        level,
        context,
        jobId,
        userId: userId || null,
        search,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
      });

      res.json({ logs });
    } catch (error) {
      logger.error("Error fetching app logs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/app-logs/stats", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await getAppLogStats({
        startDate,
        endDate,
      });

      res.json({ stats });
    } catch (error) {
      logger.error("Error fetching app log stats:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/app-logs/clear", async (req, res) => {
    try {
      const { daysOld } = req.query;

      const deletedCount = await clearOldAppLogs(parseInt(daysOld) || 7);

      res.json({
        success: true,
        message: `Cleared ${deletedCount} logs older than ${daysOld || 7} days`,
      });
    } catch (error) {
      logger.error("Error clearing app logs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:jobId/app-logs", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { limit } = req.query;

      const logs = await getAppLogs({
        jobId,
        limit: parseInt(limit) || 500,
      });

      res.json({ logs });
    } catch (error) {
      logger.error("Error fetching job app logs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
