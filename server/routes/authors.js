import { listAuthors } from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("AuthorsRoutes");

/**
 * Register public authors list route (users with at least one completed public story).
 * @param {import('express').Application} app
 */
export function registerAuthorsRoutes(app) {
  app.get("/api/v1/authors", async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const limit = Math.min(parseInt(req.query.limit, 10) || 48, 100);
      const offset = parseInt(req.query.offset, 10) || 0;
      const authors = await listAuthors({ search: q || undefined, limit, offset });
      res.json({ authors });
    } catch (error) {
      logger.error("Error listing authors:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
