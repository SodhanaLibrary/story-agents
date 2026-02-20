import { query } from "../../src/services/database.js";
import {
  getOrganizationsByUserId,
  getOrganizationById,
  getOrganizationMember,
  getOrgMembers,
  createOrganization,
  isOrgOwnerOrAdmin,
  addOrgMemberByEmail,
  removeOrgMember,
  updateOrgMemberRole,
  leaveOrganization,
} from "../../src/services/storyRepository.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("OrgsRoutes");

/**
 * Register organization (team plan) routes.
 * @param {import('express').Application} app
 */
export function registerOrgsRoutes(app) {
  app.get("/api/orgs", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgs = await getOrganizationsByUserId(userId);
      res.json({ organizations: orgs });
    } catch (error) {
      logger.error("Error listing orgs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orgs", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const { name } = req.body;
      if (!name || !String(name).trim()) {
        return res
          .status(400)
          .json({ error: "Organization name is required" });
      }
      const org = await createOrganization(String(name).trim(), userId);
      res.status(201).json(org);
    } catch (error) {
      logger.error("Error creating org:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orgs/:orgId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
      const membership = await getOrganizationMember(orgId, userId);
      if (!membership)
        return res
          .status(404)
          .json({ error: "Not a member of this organization" });
      const org = await getOrganizationById(orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });
      const members = await getOrgMembers(orgId);
      res.json({ ...org, members });
    } catch (error) {
      logger.error("Error fetching org:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/orgs/:orgId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
      if (!(await isOrgOwnerOrAdmin(orgId, userId))) {
        return res
          .status(403)
          .json({
            error:
              "Only owners and admins can update the organization",
          });
      }
      const { name } = req.body;
      if (!name || !String(name).trim()) {
        return res
          .status(400)
          .json({ error: "Organization name is required" });
      }
      await query("UPDATE organizations SET name = ? WHERE id = ?", [
        String(name).trim(),
        orgId,
      ]);
      const org = await getOrganizationById(orgId);
      res.json(org);
    } catch (error) {
      logger.error("Error updating org:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orgs/:orgId/members", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
      const membership = await getOrganizationMember(orgId, userId);
      if (!membership)
        return res
          .status(404)
          .json({ error: "Not a member of this organization" });
      const members = await getOrgMembers(orgId);
      res.json({ members });
    } catch (error) {
      logger.error("Error listing org members:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orgs/:orgId/members", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
      const { email } = req.body;
      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: "Member email is required" });
      }
      const added = await addOrgMemberByEmail(
        orgId,
        String(email).trim(),
        userId,
      );
      res.status(201).json({ user: added });
    } catch (error) {
      if (error.message === "No user found with that email") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "User is already a member") {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("Only owners and admins")) {
        return res.status(403).json({ error: error.message });
      }
      logger.error("Error adding org member:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/orgs/:orgId/members/:memberId", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      const memberId = parseInt(req.params.memberId, 10);
      if (isNaN(orgId) || isNaN(memberId))
        return res.status(400).json({ error: "Invalid ID" });
      await removeOrgMember(orgId, memberId, userId);
      res.json({ success: true });
    } catch (error) {
      if (
        error.message?.includes("Cannot remove") ||
        error.message?.includes("Only owners")
      ) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === "User is not a member of this organization") {
        return res.status(404).json({ error: error.message });
      }
      logger.error("Error removing org member:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/orgs/:orgId/members/:memberId/role", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      const memberId = parseInt(req.params.memberId, 10);
      const { role } = req.body;
      if (isNaN(orgId) || isNaN(memberId))
        return res.status(400).json({ error: "Invalid ID" });
      if (!role) return res.status(400).json({ error: "Role is required" });
      const members = await updateOrgMemberRole(
        orgId,
        memberId,
        role,
        userId,
      );
      res.json({ members });
    } catch (error) {
      if (
        error.message?.includes("Only the owner") ||
        error.message?.includes("Cannot change")
      ) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === "User is not a member")
        return res.status(404).json({ error: error.message });
      logger.error("Error updating org member role:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orgs/:orgId/leave", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId)
        return res.status(401).json({ error: "Authentication required" });
      const orgId = parseInt(req.params.orgId, 10);
      if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
      await leaveOrganization(orgId, userId);
      res.json({ success: true });
    } catch (error) {
      if (
        error.message?.includes("Owner cannot leave") ||
        error.message === "You are not a member of this organization"
      ) {
        return res.status(400).json({ error: error.message });
      }
      logger.error("Error leaving org:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
