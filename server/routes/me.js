import { getUserById } from "../../src/services/storyRepository.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("MeRoutes");

/**
 * Register current-user route.
 * @param {import('express').Application} app
 */
export function registerMeRoutes(app) {
  app.get("/api/users/me", async (req, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        plan: user.plan || "free",
        hasPassword: !!user.password_hash,
        createdAt: user.created_at,
      });
    } catch (error) {
      logger.error("Error fetching current user:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
