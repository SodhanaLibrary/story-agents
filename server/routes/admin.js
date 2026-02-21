import { requireRole } from "../middleware/requireRole.js";
import {
  getAllUsers,
  getUserStats,
  getUserById,
  updateUserRole,
} from "../../src/services/storyRepository.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("AdminRoutes");

/**
 * Register admin user management routes.
 * @param {import('express').Application} app
 */
export function registerAdminRoutes(app) {
  app.get("/api/v1/admin/users", requireRole("admin"), async (req, res) => {
    try {
      const { search, role, limit, offset } = req.query;

      const users = await getAllUsers({
        search,
        role,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
      });

      const sanitizedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        picture: u.picture,
        role: u.role,
        storyCount: u.story_count,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      res.json({ users: sanitizedUsers });
    } catch (error) {
      logger.error("Error fetching users:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/admin/users/stats", requireRole("admin"), async (req, res) => {
    try {
      const stats = await getUserStats();
      res.json(stats);
    } catch (error) {
      logger.error("Error fetching user stats:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put(
    "/api/v1/admin/users/:userId/role",
    requireRole("super-admin"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const { role: newRole } = req.body;

        if (!newRole) {
          return res.status(400).json({ error: "Role is required" });
        }

        if (parseInt(userId) === req.userId) {
          return res
            .status(400)
            .json({ error: "Cannot change your own role" });
        }

        const targetUser = await getUserById(parseInt(userId));
        if (!targetUser) {
          return res.status(404).json({ error: "User not found" });
        }

        const updatedUser = await updateUserRole(parseInt(userId), newRole);

        logger.info(
          `User ${req.userId} changed role of user ${userId} to ${newRole}`,
        );

        res.json({
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
          },
        });
      } catch (error) {
        logger.error("Error updating user role:", error.message);
        res.status(500).json({ error: error.message });
      }
    },
  );
}
