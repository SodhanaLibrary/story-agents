import {
  getUserAvatars,
  saveUserAvatar,
  getUserAvatarById,
  deleteUserAvatar,
  getUserProfile,
  updateUserProfile,
  getUserStoriesByUserId,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  isFollowing,
  getPersonalizedFeed,
  listSavedStories,
  searchUsersForMessaging,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("UsersRoutes");

/**
 * Register user profile, avatars, followers, and feed routes.
 * @param {import('express').Application} app
 */
export function registerUsersRoutes(app) {
  app.get("/api/users/search", async (req, res) => {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
      const users = await searchUsersForMessaging(q || null, currentUserId, limit);
      res.json({ users });
    } catch (error) {
      logger.error("Error searching users:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/avatars", async (req, res) => {
    try {
      const { userId } = req.params;
      const avatars = await getUserAvatars(parseInt(userId, 10));
      res.json({ avatars });
    } catch (error) {
      logger.error("Error fetching user avatars:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/:userId/avatars", async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        name,
        description,
        avatarUrl,
        avatarPath,
        avatarPrompt,
      } = req.body;

      if (!name || !avatarUrl) {
        return res
          .status(400)
          .json({ error: "Name and avatarUrl are required" });
      }

      const avatar = await saveUserAvatar(parseInt(userId, 10), {
        name,
        description,
        avatarUrl,
        avatarPath: avatarPath || avatarUrl,
        avatarPrompt,
      });

      logger.info(`Avatar saved for user ${userId}: ${name}`);
      res.json({ avatar });
    } catch (error) {
      logger.error("Error saving user avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/avatars/:avatarId", async (req, res) => {
    try {
      const { avatarId } = req.params;
      const avatar = await getUserAvatarById(parseInt(avatarId, 10));

      if (!avatar) {
        return res.status(404).json({ error: "Avatar not found" });
      }

      res.json({ avatar });
    } catch (error) {
      logger.error("Error fetching avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:userId/avatars/:avatarId", async (req, res) => {
    try {
      const { userId, avatarId } = req.params;
      await deleteUserAvatar(parseInt(userId, 10), parseInt(avatarId, 10));
      res.json({ success: true, message: "Avatar deleted" });
    } catch (error) {
      logger.error("Error deleting avatar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = await getUserProfile(userId);

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ profile });
    } catch (error) {
      logger.error("Error fetching profile:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/users/:userId/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { name, username, bio, isPublic } = req.body;

      await updateUserProfile(userId, { name, username, bio, isPublic });
      const profile = await getUserProfile(userId);

      res.json({ profile });
    } catch (error) {
      logger.error("Error updating profile:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/stories", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const viewerId = req.query.viewerId
        ? parseInt(req.query.viewerId)
        : null;
      const stories = await getUserStoriesByUserId(userId, viewerId);
      res.json({ stories });
    } catch (error) {
      logger.error("Error fetching user stories:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/followers", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const followers = await getFollowers(userId);
      res.json({ followers });
    } catch (error) {
      logger.error("Error fetching followers:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/following", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const following = await getFollowing(userId);
      res.json({ following });
    } catch (error) {
      logger.error("Error fetching following:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/:userId/follow", async (req, res) => {
    try {
      const followingId = parseInt(req.params.userId);
      const { followerId } = req.body;

      if (!followerId) {
        return res.status(400).json({ error: "followerId is required" });
      }

      await followUser(parseInt(followerId), followingId);
      res.json({ success: true, message: "Now following user" });
    } catch (error) {
      logger.error("Error following user:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:userId/follow", async (req, res) => {
    try {
      const followingId = parseInt(req.params.userId);
      const followerId = parseInt(req.query.followerId);

      if (!followerId) {
        return res.status(400).json({ error: "followerId is required" });
      }

      await unfollowUser(followerId, followingId);
      res.json({ success: true, message: "Unfollowed user" });
    } catch (error) {
      logger.error("Error unfollowing user:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:userId/is-following/:targetId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const targetId = parseInt(req.params.targetId);
      const following = await isFollowing(userId, targetId);
      res.json({ isFollowing: following });
    } catch (error) {
      logger.error("Error checking follow status:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/feed", async (req, res) => {
    try {
      const userId = req.query.userId
        ? parseInt(req.query.userId)
        : null;

      if (userId) {
        const feed = await getPersonalizedFeed(userId);
        res.json({ stories: feed });
      } else {
        const stories = await listSavedStories();
        res.json({ stories });
      }
    } catch (error) {
      logger.error("Error fetching feed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
