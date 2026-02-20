import {
  getConversationsForUser,
  getMessagesBetween,
  createMessage,
  markMessagesAsRead,
  getUserById,
} from "../../src/services/storyRepository.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("MessagesRoutes");

/**
 * Register P2P message routes. All require authentication.
 * @param {import('express').Application} app
 */
export function registerMessagesRoutes(app) {
  app.get("/api/messages/conversations", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const conversations = await getConversationsForUser(userId);
      res.json({ conversations });
    } catch (error) {
      logger.error("Error fetching conversations:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/messages/with/:userId", async (req, res) => {
    try {
      const currentUserId = req.userId;
      if (!currentUserId)
        return res.status(401).json({ error: "Authentication required" });
      const otherUserId = parseInt(req.params.userId, 10);
      if (isNaN(otherUserId))
        return res.status(400).json({ error: "Invalid user ID" });
      const { limit, beforeId } = req.query;
      const messages = await getMessagesBetween(
        currentUserId,
        otherUserId,
        parseInt(limit, 10) || 50,
        beforeId ? parseInt(beforeId, 10) : null,
      );
      res.json({ messages });
    } catch (error) {
      logger.error("Error fetching messages:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const senderId = req.userId;
      if (!senderId)
        return res.status(401).json({ error: "Authentication required" });
      const { recipientId, body } = req.body;
      const rid = parseInt(recipientId, 10);
      if (isNaN(rid))
        return res.status(400).json({ error: "Valid recipientId is required" });
      const recipient = await getUserById(rid);
      if (!recipient)
        return res.status(404).json({ error: "Recipient not found" });
      const message = await createMessage(senderId, rid, body || "");
      res.status(201).json(message);
    } catch (error) {
      if (error.message === "Message body is required")
        return res.status(400).json({ error: error.message });
      if (error.message === "Cannot message yourself")
        return res.status(400).json({ error: error.message });
      logger.error("Error sending message:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/messages/with/:userId/read", async (req, res) => {
    try {
      const recipientUserId = req.userId;
      if (!recipientUserId)
        return res.status(401).json({ error: "Authentication required" });
      const senderUserId = parseInt(req.params.userId, 10);
      if (isNaN(senderUserId))
        return res.status(400).json({ error: "Invalid user ID" });
      await markMessagesAsRead(recipientUserId, senderUserId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error marking messages read:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
