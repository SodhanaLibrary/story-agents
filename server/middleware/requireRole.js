import { getUserById, hasRole } from "../../src/services/storyRepository.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("requireRole");

/**
 * Middleware factory: require request user to have at least the given role.
 * Expects req.userId to be set by auth middleware.
 */
export function requireRole(requiredRole) {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await getUserById(req.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!hasRole(user.role, requiredRole)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: requiredRole,
          current: user.role,
        });
      }

      req.userRole = user.role;
      next();
    } catch (error) {
      logger.error("Role check error:", error.message);
      res.status(500).json({ error: error.message });
    }
  };
}
