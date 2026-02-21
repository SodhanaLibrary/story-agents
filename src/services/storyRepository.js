import crypto from "crypto";
import { query, insert } from "./database.js";
import { createLogger } from "../utils/logger.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const logger = createLogger("StoryRepo");

/**
 * Story Repository - MySQL operations for stories
 */

// ==================== USERS ====================

export async function findOrCreateUser(googleUser) {
  const { sub: googleId, email, name, picture } = googleUser;

  // Check if user exists
  const existing = await query(
    "SELECT * FROM users WHERE google_id = ? OR email = ?",
    [googleId, email],
  );

  if (existing.length > 0) {
    // Update user info (but not role)
    await query(
      "UPDATE users SET name = ?, picture = ?, google_id = ? WHERE id = ?",
      [name, picture, googleId, existing[0].id],
    );
    // Return updated user with role
    const updated = await query("SELECT * FROM users WHERE id = ?", [existing[0].id]);
    return updated[0];
  }

  // Create new user with default role 'user' and plan 'free'
  const userId = await insert(
    "INSERT INTO users (google_id, email, name, picture, role, plan) VALUES (?, ?, ?, ?, 'user', 'free')",
    [googleId, email, name, picture],
  );

  return { id: userId, google_id: googleId, email, name, picture, role: 'user', plan: 'free' };
}

export async function getUserById(userId) {
  const rows = await query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0] || null;
}

/** Get user by email (for login). Returns user without password_hash in safe object. */
export async function getUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const rows = await query(
    "SELECT id, google_id, email, name, picture, role, plan, password_hash, email_verified, created_at, updated_at FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  return rows[0] || null;
}

/** Create user with email and password. Fails if email exists. Returns user without password_hash. */
export async function createUserWithEmail({ email, name, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (existing.length > 0) return { error: "EMAIL_EXISTS" };

  const passwordHash = hashPassword(password);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const userId = await insert(
    `INSERT INTO users (email, name, password_hash, email_verified, email_verification_token, email_verification_expires, role, plan)
     VALUES (?, ?, ?, 0, ?, ?, 'user', 'free')`,
    [normalizedEmail, (name || "").trim() || null, passwordHash, verificationToken, expires],
  );

  const user = await query(
    "SELECT id, email, name, picture, role, plan, email_verified, created_at FROM users WHERE id = ?",
    [userId],
  );
  return { user: user[0], verificationToken };
}

/** Verify email by token. Returns { user } on success, { error: 'expired' | 'invalid' } otherwise. */
export async function verifyEmailByToken(token) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return { error: "invalid" };
  const now = new Date();
  const rows = await query(
    "SELECT id, email, name, picture, role, plan, email_verification_expires FROM users WHERE email_verification_token = ? AND email_verification_expires > ?",
    [t, now],
  );
  if (rows.length > 0) {
    await query(
      "UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?",
      [rows[0].id],
    );
    const user = await getUserById(rows[0].id);
    return { user };
  }
  const expiredRows = await query(
    "SELECT id FROM users WHERE email_verification_token = ?",
    [t],
  );
  if (expiredRows.length > 0) return { error: "expired" };
  return { error: "invalid" };
}

/**
 * Create a new verification token for a user who has not verified email.
 * Returns { verificationToken, email } or { error: 'already_verified' | 'not_found' }.
 */
export async function createEmailVerificationToken(userId) {
  const user = await getUserById(userId);
  if (!user) return { error: "not_found" };
  if (user.email_verified) return { error: "already_verified" };
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await query(
    "UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?",
    [verificationToken, expires, userId],
  );
  return { verificationToken, email: user.email };
}

/** Set password for user (for change-password and reset-password). */
export async function setUserPassword(userId, newPassword) {
  const hash = hashPassword(newPassword);
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
}

/** Check password for user. */
export function checkUserPassword(user, password) {
  return user && user.password_hash && verifyPassword(password, user.password_hash);
}

/** Create password reset token for email. Returns token and expires. */
export async function createPasswordResetToken(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (rows.length === 0) return { error: "USER_NOT_FOUND" };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await query(
    "UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
    [token, expires, rows[0].id],
  );
  return { token, expires };
}

/** Get user by valid password reset token; clear token after use. */
export async function getUserByPasswordResetToken(token) {
  if (!token) return null;
  const rows = await query(
    "SELECT id, email, name, picture, role, plan FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()",
    [token],
  );
  if (rows.length === 0) return null;
  await query(
    "UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?",
    [rows[0].id],
  );
  return rows[0];
}

/**
 * Search users by name or username (for messaging). Excludes current user.
 * Returns only safe fields: id, name, username, picture.
 */
export async function searchUsersForMessaging(searchQuery, currentUserId, limit = 20) {
  const limitInt = Math.min(parseInt(limit, 10) || 20, 50);
  if (!searchQuery || typeof searchQuery !== "string") {
    const rows = await query(
      `SELECT id, name, username, picture FROM users WHERE id != ? ORDER BY name ASC LIMIT ${limitInt}`,
      [currentUserId],
    );
    return rows;
  }
  const term = `%${searchQuery.trim()}%`;
  const rows = await query(
    `SELECT id, name, username, picture FROM users WHERE id != ? AND (name LIKE ? OR (username IS NOT NULL AND username LIKE ?)) ORDER BY name ASC LIMIT ${limitInt}`,
    [currentUserId, term, term],
  );
  return rows;
}

/**
 * List authors: users who have at least one completed public story.
 * Returns id, name, username, picture, story_count. Optional search by name/username.
 */
export async function listAuthors(options = {}) {
  const { search, limit = 48, offset = 0 } = options;
  const limitInt = Math.min(parseInt(limit, 10) || 48, 100);
  const offsetInt = parseInt(offset, 10) || 0;

  let sql = `
    SELECT u.id, u.name, u.username, u.picture, COUNT(s.id) AS story_count
    FROM users u
    INNER JOIN stories s ON s.user_id = u.id AND s.status = 'completed' AND s.is_public = TRUE
  `;
  const params = [];

  if (search && typeof search === "string" && search.trim()) {
    const term = `%${search.trim()}%`;
    sql += " WHERE (u.name LIKE ? OR (u.username IS NOT NULL AND u.username LIKE ?))";
    params.push(term, term);
  }
  sql += ` GROUP BY u.id, u.name, u.username, u.picture ORDER BY story_count DESC, u.name ASC LIMIT ${limitInt} OFFSET ${offsetInt}`;

  const rows = await query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    picture: r.picture,
    story_count: r.story_count,
  }));
}

/**
 * Get all users (for admin panel)
 */
export async function getAllUsers(options = {}) {
  const { search, role, limit = 100, offset = 0 } = options;
  
  // Ensure limit and offset are integers (MySQL prepared statements issue)
  const limitInt = parseInt(limit, 10) || 100;
  const offsetInt = parseInt(offset, 10) || 0;
  
  let sql = `
    SELECT id, google_id, email, name, picture, role, created_at, updated_at,
           (SELECT COUNT(*) FROM stories WHERE user_id = users.id) as story_count
    FROM users
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += " AND (name LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (role) {
    sql += " AND role = ?";
    params.push(role);
  }

  // LIMIT and OFFSET embedded directly (safe since they're validated integers)
  sql += ` ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

  return await query(sql, params);
}

/**
 * Get user count by role (for admin stats)
 */
export async function getUserStats() {
  const stats = await query(`
    SELECT 
      role,
      COUNT(*) as count
    FROM users
    GROUP BY role
  `);
  
  const totalUsers = await query("SELECT COUNT(*) as total FROM users");
  
  return {
    total: totalUsers[0]?.total || 0,
    byRole: stats.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, {}),
  };
}

/**
 * Update user role (super-admin only)
 */
export async function updateUserRole(userId, newRole) {
  const validRoles = ['user', 'premium-user', 'admin', 'super-admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  await query("UPDATE users SET role = ? WHERE id = ?", [newRole, userId]);
  
  // Return updated user
  const rows = await query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0] || null;
}

/**
 * Update user plan (free | pro). Used after successful Razorpay payment.
 */
export async function updateUserPlan(userId, newPlan) {
  const validPlans = ['free', 'pro'];
  if (!validPlans.includes(newPlan)) {
    throw new Error(`Invalid plan: ${newPlan}`);
  }
  await query("UPDATE users SET plan = ? WHERE id = ?", [newPlan, userId]);
  const rows = await query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0] || null;
}

/**
 * Check if user has required role
 */
export function hasRole(userRole, requiredRole) {
  const roleHierarchy = {
    'user': 1,
    'premium-user': 2,
    'admin': 3,
    'super-admin': 4,
  };
  
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

// ==================== ORGANIZATIONS (TEAM PLAN) ====================

export async function createOrganization(name, ownerId) {
  const orgId = await insert(
    "INSERT INTO organizations (name, owner_id) VALUES (?, ?)",
    [name.trim(), ownerId]
  );
  await query(
    "INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, 'owner')",
    [orgId, ownerId]
  );
  return getOrganizationById(orgId);
}

export async function getOrganizationById(orgId) {
  const rows = await query(
    `SELECT o.*, u.name as owner_name, u.email as owner_email
     FROM organizations o
     LEFT JOIN users u ON o.owner_id = u.id
     WHERE o.id = ?`,
    [orgId]
  );
  return rows[0] || null;
}

export async function getOrganizationsByUserId(userId) {
  return query(
    `SELECT o.*, m.role as my_role,
        (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id) as member_count
     FROM organizations o
     INNER JOIN organization_members m ON m.org_id = o.id AND m.user_id = ?
     ORDER BY o.updated_at DESC`,
    [userId]
  );
}

export async function getOrgMembers(orgId) {
  return query(
    `SELECT m.id, m.org_id, m.user_id, m.role, m.created_at,
        u.email, u.name, u.picture
     FROM organization_members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ?
     ORDER BY m.role = 'owner' DESC, m.role = 'admin' DESC, u.name ASC`,
    [orgId]
  );
}

export async function getOrganizationMember(orgId, userId) {
  const rows = await query(
    "SELECT * FROM organization_members WHERE org_id = ? AND user_id = ?",
    [orgId, userId]
  );
  return rows[0] || null;
}

export async function isOrgOwnerOrAdmin(orgId, userId) {
  const m = await getOrganizationMember(orgId, userId);
  return m && (m.role === "owner" || m.role === "admin");
}

export async function addOrgMemberByEmail(orgId, email, inviterId) {
  const inviter = await getOrganizationMember(orgId, inviterId);
  if (!inviter || (inviter.role !== "owner" && inviter.role !== "admin")) {
    throw new Error("Only owners and admins can add members");
  }
  const users = await query("SELECT id FROM users WHERE email = ?", [email.trim()]);
  if (!users.length) {
    throw new Error("No user found with that email");
  }
  const userId = users[0].id;
  try {
    await query(
      "INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, 'member')",
      [orgId, userId]
    );
  } catch (err) {
    if (err.message?.includes("Duplicate") || err.code === "ER_DUP_ENTRY") {
      throw new Error("User is already a member");
    }
    throw err;
  }
  return getUserById(userId);
}

export async function removeOrgMember(orgId, userId, actorId) {
  const actor = await getOrganizationMember(orgId, actorId);
  const target = await getOrganizationMember(orgId, userId);
  if (!target) {
    throw new Error("User is not a member of this organization");
  }
  if (target.role === "owner") {
    throw new Error("Cannot remove the organization owner");
  }
  if (userId !== actorId && (!actor || (actor.role !== "owner" && actor.role !== "admin"))) {
    throw new Error("Only owners and admins can remove other members");
  }
  await query("DELETE FROM organization_members WHERE org_id = ? AND user_id = ?", [orgId, userId]);
  return true;
}

export async function updateOrgMemberRole(orgId, userId, newRole, actorId) {
  const actor = await getOrganizationMember(orgId, actorId);
  if (!actor || actor.role !== "owner") {
    throw new Error("Only the owner can change member roles");
  }
  const target = await getOrganizationMember(orgId, userId);
  if (!target) throw new Error("User is not a member");
  if (target.role === "owner") throw new Error("Cannot change owner role");
  const validRoles = ["admin", "member"];
  if (!validRoles.includes(newRole)) throw new Error(`Invalid role: ${newRole}`);
  await query("UPDATE organization_members SET role = ? WHERE org_id = ? AND user_id = ?", [
    newRole,
    orgId,
    userId,
  ]);
  return getOrgMembers(orgId);
}

/** Returns true if user is in at least one organization (team plan benefit) */
export async function userBelongsToAnyOrg(userId) {
  const rows = await query(
    "SELECT 1 FROM organization_members WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows.length > 0;
}

export async function leaveOrganization(orgId, userId) {
  const m = await getOrganizationMember(orgId, userId);
  if (!m) throw new Error("You are not a member of this organization");
  if (m.role === "owner") throw new Error("Owner cannot leave; transfer ownership or delete the organization first");
  await query("DELETE FROM organization_members WHERE org_id = ? AND user_id = ?", [orgId, userId]);
  return true;
}

// ==================== OPEN STORY SUBMISSIONS ====================

export async function createOpenStorySubmission(userId, title, storyText, genre = null) {
  const genreVal = genre != null && String(genre).trim() ? String(genre).trim() : null;
  const id = await insert(
    "INSERT INTO open_story_submissions (user_id, title, story_text, genre) VALUES (?, ?, ?, ?)",
    [userId, title.trim(), storyText.trim(), genreVal]
  );
  return getOpenStorySubmissionById(id);
}

export async function getOpenStorySubmissionById(id) {
  const rows = await query(
    `SELECT s.*, u.name as author_name, u.email as author_email
     FROM open_story_submissions s
     LEFT JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Hacker News–style ranking: score = (votes - 1) / (age_hours + 2)^gravity
 * So newer and more upvoted stories rank higher.
 * @see https://news.ycombinator.com/
 */
const OPEN_STORY_RANK_GRAVITY = 1.8;

export async function getOpenStorySubmissions(currentUserId = null) {
  const rows = await query(
    `SELECT s.*, u.name as author_name, u.email as author_email,
        (SELECT COUNT(*) FROM open_story_votes v WHERE v.submission_id = s.id) as vote_count,
        (SELECT COUNT(*) FROM open_story_comments c WHERE c.submission_id = s.id) as comment_count
     FROM open_story_submissions s
     LEFT JOIN users u ON s.user_id = u.id
     ORDER BY (
       (SELECT COUNT(*) FROM open_story_votes v WHERE v.submission_id = s.id) - 1
     ) / POWER(TIMESTAMPDIFF(HOUR, s.created_at, NOW()) + 2, ?) DESC`,
    [OPEN_STORY_RANK_GRAVITY]
  );
  const list = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    story_text: r.story_text,
    genre: r.genre || null,
    created_at: r.created_at,
    author_name: r.author_name,
    author_email: r.author_email,
    vote_count: parseInt(r.vote_count, 10) || 0,
    comment_count: parseInt(r.comment_count, 10) || 0,
  }));

  if (currentUserId) {
    const voted = await query(
      "SELECT submission_id FROM open_story_votes WHERE user_id = ?",
      [currentUserId]
    );
    const votedSet = new Set(voted.map((v) => v.submission_id));
    list.forEach((s) => {
      s.user_has_voted = votedSet.has(s.id);
    });
  } else {
    list.forEach((s) => {
      s.user_has_voted = false;
    });
  }
  return list;
}

export async function toggleOpenStoryVote(submissionId, userId) {
  const existing = await query(
    "SELECT id FROM open_story_votes WHERE submission_id = ? AND user_id = ?",
    [submissionId, userId]
  );
  if (existing.length > 0) {
    await query("DELETE FROM open_story_votes WHERE submission_id = ? AND user_id = ?", [
      submissionId,
      userId,
    ]);
    return { voted: false };
  }
  await query("INSERT INTO open_story_votes (submission_id, user_id) VALUES (?, ?)", [
    submissionId,
    userId,
  ]);
  return { voted: true };
}

export async function getOpenStoryComments(submissionId) {
  const rows = await query(
    `SELECT c.id, c.submission_id, c.user_id, c.comment_text, c.created_at,
        u.name as author_name, u.email as author_email
     FROM open_story_comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.submission_id = ?
     ORDER BY c.created_at ASC`,
    [submissionId]
  );
  return rows.map((r) => ({
    id: r.id,
    submission_id: r.submission_id,
    user_id: r.user_id,
    comment_text: r.comment_text,
    created_at: r.created_at,
    author_name: r.author_name,
    author_email: r.author_email,
  }));
}

export async function createOpenStoryComment(submissionId, userId, commentText) {
  const text = String(commentText).trim();
  if (!text) throw new Error("Comment text is required");
  const id = await insert(
    "INSERT INTO open_story_comments (submission_id, user_id, comment_text) VALUES (?, ?, ?)",
    [submissionId, userId, text]
  );
  const rows = await query(
    `SELECT c.id, c.submission_id, c.user_id, c.comment_text, c.created_at,
        u.name as author_name, u.email as author_email
     FROM open_story_comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function updateOpenStorySubmission(id, userId, { title, storyText, genre }) {
  const sub = await getOpenStorySubmissionById(id);
  if (!sub || sub.user_id !== userId) return null;
  const newTitle = title != null ? String(title).trim() : sub.title;
  const newStory = storyText != null ? String(storyText).trim() : sub.story_text;
  const newGenre = genre !== undefined ? (genre != null && String(genre).trim() ? String(genre).trim() : null) : sub.genre;
  if (!newTitle || !newStory) return null;
  await query(
    "UPDATE open_story_submissions SET title = ?, story_text = ?, genre = ? WHERE id = ? AND user_id = ?",
    [newTitle, newStory, newGenre, id, userId]
  );
  return getOpenStorySubmissionById(id);
}

export async function deleteOpenStorySubmission(id, userId) {
  const sub = await getOpenStorySubmissionById(id);
  if (!sub || sub.user_id !== userId) return false;
  await query("DELETE FROM open_story_submissions WHERE id = ? AND user_id = ?", [id, userId]);
  return true;
}

export async function getOpenStoryCommentById(commentId) {
  const rows = await query(
    `SELECT c.id, c.submission_id, c.user_id, c.comment_text, c.created_at,
        u.name as author_name, u.email as author_email
     FROM open_story_comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [commentId]
  );
  return rows[0] || null;
}

export async function updateOpenStoryComment(commentId, userId, commentText) {
  const comment = await getOpenStoryCommentById(commentId);
  if (!comment || comment.user_id !== userId) return null;
  const text = String(commentText).trim();
  if (!text) return null;
  await query(
    "UPDATE open_story_comments SET comment_text = ? WHERE id = ? AND user_id = ?",
    [text, commentId, userId]
  );
  return getOpenStoryCommentById(commentId);
}

export async function deleteOpenStoryComment(commentId, userId) {
  const comment = await getOpenStoryCommentById(commentId);
  if (!comment || comment.user_id !== userId) return false;
  await query("DELETE FROM open_story_comments WHERE id = ? AND user_id = ?", [commentId, userId]);
  return true;
}

export async function createOpenStoryImage(submissionId, imageUrl, sortOrder = 0) {
  const id = await insert(
    "INSERT INTO open_story_images (submission_id, image_url, sort_order) VALUES (?, ?, ?)",
    [submissionId, imageUrl, sortOrder]
  );
  const rows = await query("SELECT * FROM open_story_images WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function getOpenStoryImages(submissionId) {
  const rows = await query(
    "SELECT id, submission_id, image_url, sort_order, created_at FROM open_story_images WHERE submission_id = ? ORDER BY sort_order ASC, id ASC",
    [submissionId]
  );
  return rows;
}

export async function getOpenStoryImageById(imageId) {
  const rows = await query("SELECT * FROM open_story_images WHERE id = ?", [imageId]);
  return rows[0] || null;
}

export async function deleteOpenStoryImage(imageId, userId) {
  const img = await getOpenStoryImageById(imageId);
  if (!img) return false;
  const submission = await getOpenStorySubmissionById(img.submission_id);
  if (!submission || submission.user_id !== userId) return false;
  await query("DELETE FROM open_story_images WHERE id = ?", [imageId]);
  return true;
}

// ==================== STORIES ====================

export async function createStory(storyData, userId = null) {
  const {
    title,
    summary,
    originalStory,
    artStyleKey,
    artStylePrompt,
    artStyleReasoning,
    coverUrl,
    coverPath,
    pageCount,
    targetAudience,
    genre,
  } = storyData;

  const storyId = await insert(
    `INSERT INTO stories 
     (user_id, title, summary, original_story, art_style_key, art_style_prompt, 
      art_style_reasoning, cover_url, cover_path, page_count, target_audience, genre, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
    [
      userId ?? null,
      title ?? null,
      summary ?? null,
      originalStory ?? null,
      artStyleKey ?? null,
      artStylePrompt ?? null,
      artStyleReasoning ?? null,
      coverUrl ?? null,
      coverPath ?? null,
      pageCount ?? 0,
      targetAudience ?? "children",
      genre != null && String(genre).trim() ? String(genre).trim() : null,
    ],
  );

  logger.info(`Created story ${storyId}: ${title}`);
  return storyId;
}

export async function updateStory(storyId, updates) {
  const fields = [];
  const values = [];

  const fieldMap = {
    title: "title",
    summary: "summary",
    originalStory: "original_story",
    artStyleKey: "art_style_key",
    artStylePrompt: "art_style_prompt",
    coverUrl: "cover_url",
    coverPath: "cover_path",
    pageCount: "page_count",
    genre: "genre",
    volumeId: "volume_id",
    volumeSortOrder: "volume_sort_order",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  values.push(storyId);
  await query(`UPDATE stories SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function getStoryById(storyId) {
  const stories = await query("SELECT * FROM stories WHERE id = ?", [storyId]);
  if (stories.length === 0) return null;

  const story = stories[0];

  // Get characters
  const characters = await query(
    "SELECT * FROM characters WHERE story_id = ? ORDER BY id",
    [storyId],
  );

  // Get pages
  const pages = await query(
    "SELECT * FROM pages WHERE story_id = ? ORDER BY page_number",
    [storyId],
  );

  return formatStoryOutput(story, characters, pages);
}

export async function listStories(userId = null) {
  let sql = `
    SELECT s.*, 
           u.name as author_name, u.username as author_username, u.picture as author_picture,
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count,
           GROUP_CONCAT(DISTINCT t.name) as tag_names
    FROM stories s 
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN story_tags st ON s.id = st.story_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.status = 'completed'
  `;
  const params = [];

  if (userId) {
    sql += " AND s.user_id = ?";
    params.push(userId);
  }

  sql += " GROUP BY s.id ORDER BY s.created_at DESC";

  const stories = await query(sql, params);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`, // For compatibility with old API
    title: s.title,
    summary: s.summary,
    genre: s.genre || null,
    characterCount: s.character_count,
    pageCount: s.actual_page_count || s.page_count,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    userId: s.user_id,
    author: s.author_name
      ? {
          id: s.user_id,
          name: s.author_name,
          username: s.author_username,
          picture: s.author_picture,
        }
      : null,
    tags: s.tag_names ? s.tag_names.split(",") : [],
  }));
}

export async function deleteStory(storyId, deleteImages = false) {
  // First, collect and delete all images associated with the story
  if (deleteImages) {
    try {
      const imagesToDelete = [];

      // Get story cover
      const stories = await query(
        "SELECT cover_url, cover_path FROM stories WHERE id = ?",
        [storyId],
      );
      if (stories.length > 0) {
        const story = stories[0];
        if (story.cover_path) imagesToDelete.push(story.cover_path);
        if (story.cover_url && story.cover_url.includes("s3"))
          imagesToDelete.push(story.cover_url);
      }

      // NOTE: We do NOT delete avatar images as they can be reused across stories

      // Get page illustrations
      const pages = await query(
        "SELECT illustration_url, illustration_path FROM pages WHERE story_id = ?",
        [storyId],
      );
      for (const page of pages) {
        if (page.illustration_path) imagesToDelete.push(page.illustration_path);
        if (page.illustration_url && page.illustration_url.includes("s3"))
          imagesToDelete.push(page.illustration_url);
      }

      // Delete all images
      if (imagesToDelete.length > 0) {
        logger.info(
          `Deleting ${imagesToDelete.length} images for story ${storyId} (avatars preserved)`,
        );

        // Import deleteImage dynamically to avoid circular dependency
        const { deleteImage } = await import("../utils/storage.js");

        for (const imagePath of imagesToDelete) {
          try {
            await deleteImage(imagePath);
            logger.debug(`Deleted image: ${imagePath}`);
          } catch (err) {
            logger.warn(`Failed to delete image ${imagePath}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Error cleaning up story images: ${err.message}`);
      // Continue with story deletion even if image cleanup fails
    }
  }

  // Characters and pages will be cascade deleted
  await query("DELETE FROM stories WHERE id = ?", [storyId]);
  logger.info(`Deleted story ${storyId}`);
  return true;
}

// ==================== CHARACTERS ====================

export async function createCharacter(storyId, characterData) {
  const {
    name,
    role,
    description,
    avatarPrompt,
    avatarUrl,
    avatarPath,
    customDescription,
    hasReferenceImage,
  } = characterData;

  const characterId = await insert(
    `INSERT INTO characters 
     (story_id, name, role, description, avatar_prompt, avatar_url, avatar_path, 
      custom_description, has_reference_image) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      storyId,
      name ?? null,
      role ?? "supporting",
      description ?? null,
      avatarPrompt ?? null,
      avatarUrl ?? null,
      avatarPath ?? null,
      customDescription ?? null,
      hasReferenceImage ?? false,
    ],
  );

  return characterId;
}

export async function updateCharacter(characterId, updates) {
  const fields = [];
  const values = [];

  const fieldMap = {
    avatarUrl: "avatar_url",
    avatarPath: "avatar_path",
    avatarPrompt: "avatar_prompt",
    customDescription: "custom_description",
    hasReferenceImage: "has_reference_image",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  values.push(characterId);
  await query(
    `UPDATE characters SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
}

export async function getCharactersByStoryId(storyId) {
  return await query("SELECT * FROM characters WHERE story_id = ?", [storyId]);
}

export async function getCharacterById(characterId) {
  const rows = await query("SELECT * FROM characters WHERE id = ?", [characterId]);
  return rows[0] || null;
}

// ==================== PAGES ====================

export async function createPage(storyId, pageData) {
  const {
    pageNumber,
    text,
    imageDescription,
    charactersInScene,
    illustrationUrl,
    illustrationPath,
  } = pageData;

  const pageId = await insert(
    `INSERT INTO pages 
     (story_id, page_number, text, image_description, characters_in_scene, 
      illustration_url, illustration_path) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      storyId,
      pageNumber ?? 0,
      text ?? null,
      imageDescription ?? null,
      JSON.stringify(charactersInScene ?? []),
      illustrationUrl ?? null,
      illustrationPath ?? null,
    ],
  );

  return pageId;
}

export async function updatePage(pageId, updates) {
  const fields = [];
  const values = [];

  const fieldMap = {
    text: "text",
    imageDescription: "image_description",
    illustrationUrl: "illustration_url",
    illustrationPath: "illustration_path",
    customDescription: "custom_description",
    regenerated: "regenerated",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  values.push(pageId);
  await query(`UPDATE pages SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function getPagesByStoryId(storyId) {
  return await query(
    "SELECT * FROM pages WHERE story_id = ? ORDER BY page_number",
    [storyId],
  );
}

export async function getPageById(pageId) {
  const rows = await query("SELECT * FROM pages WHERE id = ?", [pageId]);
  return rows[0] || null;
}

// ==================== DRAFTS ====================

export async function saveDraft(jobId, draftData, userId = null) {
  const existingDrafts = await query("SELECT id FROM drafts WHERE job_id = ?", [
    jobId,
  ]);

  // Extract values with null fallbacks (MySQL doesn't accept undefined)
  const story = draftData.story ?? null;
  const status = draftData.status ?? "draft";
  const phase = draftData.phase ?? "story_input";
  const progress = draftData.progress ?? 0;
  const message = draftData.message ?? null;
  const artStyleKey = draftData.artStyleKey ?? null;
  const artStylePrompt = draftData.artStylePrompt ?? null;
  const artStyleDecision = draftData.artStyleDecision ?? null;
  const characters = draftData.characters ?? [];
  const storyPages = draftData.storyPages ?? null;
  const cover = draftData.cover ?? null;
  const pageCount = draftData.pageCount ?? 6;
  const targetAudience = draftData.targetAudience ?? "children";
  const genre = draftData.genre != null ? draftData.genre : null;

  // Determine current step based on phase
  let currentStep = 0;
  if (
    status === "pages_ready" ||
    status === "pages_text_ready" ||
    phase === "awaiting_page_review" ||
    phase === "awaiting_prompt_review" ||
    phase === "page_generation" ||
    phase === "illustration_generation"
  ) {
    currentStep = 3;
  } else if (
    status === "characters_ready" ||
    status === "avatars_ready" ||
    phase === "awaiting_avatar_input" ||
    phase === "character_extraction"
  ) {
    currentStep = 2;
  } else if (
    phase === "art_style_selection" ||
    artStyleDecision ||
    artStyleKey
  ) {
    currentStep = 1;
  } else if (phase === "story_input" || story) {
    currentStep = 0;
  }

  if (existingDrafts.length > 0) {
    await query(
      `UPDATE drafts SET 
       story_text = ?, status = ?, phase = ?, progress = ?, message = ?,
       art_style_key = ?, art_style_prompt = ?, art_style_decision = ?,
       characters = ?, story_pages = ?, cover = ?, page_count = ?,
       target_audience = ?, genre = ?, current_step = ?, user_id = COALESCE(?, user_id)
       WHERE job_id = ?`,
      [
        story,
        status,
        phase,
        progress || 0,
        message,
        artStyleKey,
        artStylePrompt,
        JSON.stringify(artStyleDecision),
        JSON.stringify(characters),
        JSON.stringify(storyPages),
        JSON.stringify(cover),
        pageCount || 6,
        targetAudience || "children",
        genre,
        currentStep,
        userId,
        jobId,
      ],
    );
  } else {
    await insert(
      `INSERT INTO drafts 
       (job_id, user_id, story_text, status, phase, progress, message,
        art_style_key, art_style_prompt, art_style_decision,
        characters, story_pages, cover, page_count, target_audience, genre, current_step)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        userId,
        story,
        status,
        phase,
        progress || 0,
        message,
        artStyleKey,
        artStylePrompt,
        JSON.stringify(artStyleDecision),
        JSON.stringify(characters),
        JSON.stringify(storyPages),
        JSON.stringify(cover),
        pageCount || 6,
        targetAudience || "children",
        genre,
        currentStep,
      ],
    );
  }

  logger.debug(`Draft saved: ${jobId}`);
}

export async function loadDraft(jobId) {
  const drafts = await query("SELECT * FROM drafts WHERE job_id = ?", [jobId]);
  if (drafts.length === 0) {
    const error = new Error("Draft not found");
    error.code = "ENOENT";
    throw error;
  }

  const draft = drafts[0];
  return formatDraftOutput(draft);
}

export async function listDrafts(userId = null) {
  let sql = "SELECT * FROM drafts";
  const params = [];

  if (userId) {
    sql += " WHERE user_id = ?";
    params.push(userId);
  }

  sql += " ORDER BY updated_at DESC";

  const drafts = await query(sql, params);
  return drafts.map(formatDraftOutput);
}

export async function deleteDraft(jobId, deleteImages = true) {
  // First, load the draft to get image paths for cleanup
  if (deleteImages) {
    try {
      const drafts = await query("SELECT * FROM drafts WHERE job_id = ?", [
        jobId,
      ]);
      if (drafts.length > 0) {
        const draft = drafts[0];
        const imagesToDelete = [];

        // NOTE: We do NOT delete avatar images as they can be reused across stories

        // Collect page illustration paths
        const storyPages = safeJsonParse(draft.story_pages, null);
        if (storyPages?.pages) {
          for (const page of storyPages.pages) {
            if (page.illustrationPath) {
              imagesToDelete.push(page.illustrationPath);
            }
            if (page.illustrationUrl && page.illustrationUrl.includes("s3")) {
              imagesToDelete.push(page.illustrationUrl);
            }
          }
        }

        // Collect cover image path
        const cover = safeJsonParse(draft.cover, null);
        if (cover?.illustrationPath) {
          imagesToDelete.push(cover.illustrationPath);
        }
        if (cover?.illustrationUrl && cover.illustrationUrl.includes("s3")) {
          imagesToDelete.push(cover.illustrationUrl);
        }

        // Log images to be deleted
        if (imagesToDelete.length > 0) {
          logger.info(
            `Deleting ${imagesToDelete.length} images for draft ${jobId} (avatars preserved)`,
          );

          // Import deleteImage dynamically to avoid circular dependency
          const { deleteImage } = await import("../utils/storage.js");

          // Delete all images (don't fail if some don't exist)
          for (const imagePath of imagesToDelete) {
            try {
              await deleteImage(imagePath);
              logger.debug(`Deleted image: ${imagePath}`);
            } catch (err) {
              logger.warn(
                `Failed to delete image ${imagePath}: ${err.message}`,
              );
            }
          }
        }
      }
    } catch (err) {
      logger.warn(`Error cleaning up draft images: ${err.message}`);
      // Continue with draft deletion even if image cleanup fails
    }
  }

  await query("DELETE FROM drafts WHERE job_id = ?", [jobId]);
  logger.debug(`Draft deleted: ${jobId}`);
  return true;
}

// ==================== SAVE COMPLETE STORY ====================

export async function saveCompleteStory(result, userId = null) {
  const {
    originalStory,
    artStyleDecision,
    characters,
    storyPages,
    cover,
    metadata,
  } = result;

  // Create story
  const storyId = await createStory(
    {
      title: storyPages?.title || "Untitled Story",
      summary: storyPages?.summary || "",
      originalStory,
      artStyleKey: artStyleDecision?.selectedStyle,
      artStylePrompt: artStyleDecision?.stylePrompt,
      artStyleReasoning: artStyleDecision?.reasoning,
      coverUrl: cover?.illustrationUrl,
      coverPath: cover?.illustrationPath,
      pageCount: storyPages?.pages?.length || 0,
      targetAudience: metadata?.targetAudience,
      genre: metadata?.genre || null,
    },
    userId,
  );

  // Create characters
  for (const char of characters || []) {
    await createCharacter(storyId, {
      name: char.name,
      role: char.role,
      description: char.description,
      avatarPrompt: char.avatarPrompt,
      avatarUrl: char.avatarUrl,
      avatarPath: char.avatarPath,
      customDescription: char.customDescription,
      hasReferenceImage: char.hasReferenceImage,
    });
  }

  // Create pages
  for (const page of storyPages?.pages || []) {
    await createPage(storyId, {
      pageNumber: page.pageNumber,
      text: page.text,
      imageDescription: page.imageDescription,
      charactersInScene: page.charactersInScene,
      illustrationUrl: page.illustrationUrl,
      illustrationPath: page.illustrationPath,
    });
  }

  logger.success(`Saved complete story ${storyId}: ${storyPages?.title}`);
  return storyId;
}

/**
 * Update an existing complete story (story + characters + pages)
 * @param {number} storyId - The ID of the story to update
 * @param {Object} result - The complete story data
 * @returns {Promise<number>} - The same story ID
 */
export async function updateCompleteStory(storyId, result) {
  const {
    originalStory,
    artStyleDecision,
    characters,
    storyPages,
    cover,
    metadata,
  } = result;

  // Update story record
  await query(
    `UPDATE stories SET 
      title = ?,
      summary = ?,
      original_story = ?,
      art_style_key = ?,
      art_style_prompt = ?,
      art_style_reasoning = ?,
      cover_url = ?,
      cover_path = ?,
      page_count = ?,
      target_audience = ?,
      genre = ?,
      updated_at = NOW()
    WHERE id = ?`,
    [
      storyPages?.title || "Untitled Story",
      storyPages?.summary || "",
      originalStory,
      artStyleDecision?.selectedStyle,
      artStyleDecision?.stylePrompt,
      artStyleDecision?.reasoning,
      cover?.illustrationUrl,
      cover?.illustrationPath,
      storyPages?.pages?.length || 0,
      metadata?.targetAudience,
      metadata?.genre != null ? metadata.genre : null,
      storyId,
    ],
  );

  // Get existing characters and pages to update them
  const existingCharacters = await query(
    "SELECT * FROM characters WHERE story_id = ?",
    [storyId],
  );
  const existingPages = await query("SELECT * FROM pages WHERE story_id = ?", [
    storyId,
  ]);

  // Update characters - match by id or name
  for (const char of characters || []) {
    // Try to find existing character by id first, then by name
    let existingChar = existingCharacters.find((c) => c.id === char.id);
    if (!existingChar) {
      existingChar = existingCharacters.find((c) => c.name === char.name);
    }

    if (existingChar) {
      // Update existing character
      await query(
        `UPDATE characters SET
          name = ?,
          role = ?,
          description = ?,
          avatar_prompt = ?,
          avatar_url = ?,
          avatar_path = ?,
          custom_description = ?,
          has_reference_image = ?
        WHERE id = ?`,
        [
          char.name,
          char.role,
          char.description,
          char.avatarPrompt,
          char.avatarUrl,
          char.avatarPath,
          char.customDescription,
          char.hasReferenceImage || false,
          existingChar.id,
        ],
      );
    } else {
      // Create new character if not found
      await createCharacter(storyId, {
        name: char.name,
        role: char.role,
        description: char.description,
        avatarPrompt: char.avatarPrompt,
        avatarUrl: char.avatarUrl,
        avatarPath: char.avatarPath,
        customDescription: char.customDescription,
        hasReferenceImage: char.hasReferenceImage,
      });
    }
  }

  // Update pages - match by id or page number
  for (const page of storyPages?.pages || []) {
    // Try to find existing page by id first, then by page number
    let existingPage = existingPages.find((p) => p.id === page.id);
    if (!existingPage) {
      existingPage = existingPages.find(
        (p) => p.page_number === page.pageNumber,
      );
    }

    if (existingPage) {
      // Update existing page
      await query(
        `UPDATE pages SET
          page_number = ?,
          text = ?,
          image_description = ?,
          characters_in_scene = ?,
          illustration_url = ?,
          illustration_path = ?,
          custom_description = ?,
          regenerated = ?
        WHERE id = ?`,
        [
          page.pageNumber,
          page.text,
          page.imageDescription,
          JSON.stringify(page.charactersInScene || []),
          page.illustrationUrl,
          page.illustrationPath,
          page.customDescription,
          page.regenerated || false,
          existingPage.id,
        ],
      );
    } else {
      // Create new page if not found
      await createPage(storyId, {
        pageNumber: page.pageNumber,
        text: page.text,
        imageDescription: page.imageDescription,
        charactersInScene: page.charactersInScene,
        illustrationUrl: page.illustrationUrl,
        illustrationPath: page.illustrationPath,
      });
    }
  }

  logger.success(`Updated complete story ${storyId}: ${storyPages?.title}`);
  return storyId;
}

// ==================== SEARCH ====================

export async function searchStories(searchQuery, options = {}) {
  const { userId, includePrivate = false, limit = 50 } = options;

  let sql = `
    SELECT s.*, 
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count,
           GROUP_CONCAT(DISTINCT t.name) as tag_names
    FROM stories s
    LEFT JOIN story_tags st ON s.id = st.story_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.status = 'completed'
  `;
  const params = [];

  // Public access filter
  if (!includePrivate) {
    sql += " AND s.is_public = TRUE";
  } else if (userId) {
    sql += " AND (s.is_public = TRUE OR s.user_id = ?)";
    params.push(userId);
  }

  // Search filter
  if (searchQuery) {
    sql += ` AND (s.title LIKE ? OR s.summary LIKE ? OR t.name LIKE ?)`;
    const searchPattern = `%${searchQuery}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const limitInt = parseInt(limit, 10) || 50;
  sql += ` GROUP BY s.id ORDER BY s.created_at DESC LIMIT ${limitInt}`;

  const stories = await query(sql, params);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    genre: s.genre || null,
    characterCount: s.character_count,
    pageCount: s.actual_page_count || s.page_count,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    isPublic: s.is_public,
    userId: s.user_id,
    tags: s.tag_names ? s.tag_names.split(",") : [],
  }));
}

// ==================== TAGS ====================

export async function getAllTags() {
  return await query("SELECT * FROM tags ORDER BY name");
}

export async function createTag(name, color = "#6366f1") {
  try {
    const tagId = await insert("INSERT INTO tags (name, color) VALUES (?, ?)", [
      name.toLowerCase().trim(),
      color,
    ]);
    return { id: tagId, name: name.toLowerCase().trim(), color };
  } catch (e) {
    // Tag might already exist
    const existing = await query("SELECT * FROM tags WHERE name = ?", [
      name.toLowerCase().trim(),
    ]);
    return existing[0];
  }
}

export async function getTagsByStoryId(storyId) {
  return await query(
    `SELECT t.* FROM tags t 
     JOIN story_tags st ON t.id = st.tag_id 
     WHERE st.story_id = ?`,
    [storyId],
  );
}

export async function addTagToStory(storyId, tagId) {
  try {
    await insert("INSERT INTO story_tags (story_id, tag_id) VALUES (?, ?)", [
      storyId,
      tagId,
    ]);
    return true;
  } catch (e) {
    // Already exists
    return false;
  }
}

export async function removeTagFromStory(storyId, tagId) {
  await query("DELETE FROM story_tags WHERE story_id = ? AND tag_id = ?", [
    storyId,
    tagId,
  ]);
  return true;
}

export async function setStoryTags(storyId, tagNames) {
  // Remove existing tags
  await query("DELETE FROM story_tags WHERE story_id = ?", [storyId]);

  // Add new tags
  for (const tagName of tagNames) {
    const tag = await createTag(tagName);
    await addTagToStory(storyId, tag.id);
  }
}

// ==================== FAVORITES ====================

export async function addFavorite(userId, storyId) {
  try {
    await insert(
      "INSERT INTO user_favorites (user_id, story_id) VALUES (?, ?)",
      [userId, storyId],
    );
    return true;
  } catch (e) {
    // Already favorited
    return false;
  }
}

export async function removeFavorite(userId, storyId) {
  await query("DELETE FROM user_favorites WHERE user_id = ? AND story_id = ?", [
    userId,
    storyId,
  ]);
  return true;
}

export async function getUserFavorites(userId) {
  const sql = `
    SELECT s.*, 
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count,
           uf.created_at as favorited_at
    FROM stories s
    JOIN user_favorites uf ON s.id = uf.story_id
    WHERE uf.user_id = ? AND s.status = 'completed'
    ORDER BY uf.created_at DESC
  `;

  const stories = await query(sql, [userId]);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    characterCount: s.character_count,
    pageCount: s.actual_page_count || s.page_count,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    createdAt: s.created_at,
    favoritedAt: s.favorited_at,
    isFavorite: true,
  }));
}

export async function isFavorite(userId, storyId) {
  const rows = await query(
    "SELECT id FROM user_favorites WHERE user_id = ? AND story_id = ?",
    [userId, storyId],
  );
  return rows.length > 0;
}

export async function getUserFavoriteIds(userId) {
  const rows = await query(
    "SELECT story_id FROM user_favorites WHERE user_id = ?",
    [userId],
  );
  return rows.map((r) => r.story_id);
}

// ==================== READING HISTORY ====================

export async function updateReadingProgress(
  userId,
  storyId,
  currentPage,
  totalPages,
) {
  const completed = currentPage >= totalPages;

  const existing = await query(
    "SELECT id FROM user_reading_history WHERE user_id = ? AND story_id = ?",
    [userId, storyId],
  );

  if (existing.length > 0) {
    await query(
      `UPDATE user_reading_history 
       SET current_page = ?, total_pages = ?, completed = ?, last_read_at = NOW()
       WHERE user_id = ? AND story_id = ?`,
      [currentPage, totalPages, completed, userId, storyId],
    );
  } else {
    await insert(
      `INSERT INTO user_reading_history 
       (user_id, story_id, current_page, total_pages, completed)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, storyId, currentPage, totalPages, completed],
    );
  }

  return { currentPage, totalPages, completed };
}

export async function getReadingProgress(userId, storyId) {
  const rows = await query(
    "SELECT * FROM user_reading_history WHERE user_id = ? AND story_id = ?",
    [userId, storyId],
  );
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    currentPage: r.current_page,
    totalPages: r.total_pages,
    completed: r.completed,
    lastReadAt: r.last_read_at,
  };
}

export async function getCurrentlyReading(userId, limit = 10) {
  const limitInt = parseInt(limit, 10) || 10;
  const sql = `
    SELECT s.*, 
           urh.current_page, urh.total_pages, urh.completed, urh.last_read_at,
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count
    FROM stories s
    JOIN user_reading_history urh ON s.id = urh.story_id
    WHERE urh.user_id = ? AND urh.completed = FALSE AND s.status = 'completed'
    ORDER BY urh.last_read_at DESC
    LIMIT ${limitInt}
  `;

  const stories = await query(sql, [userId]);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    currentPage: s.current_page,
    totalPages: s.total_pages,
    progress: Math.round((s.current_page / s.total_pages) * 100),
    lastReadAt: s.last_read_at,
  }));
}

export async function getReadingHistory(userId, limit = 20) {
  const limitInt = parseInt(limit, 10) || 20;
  const sql = `
    SELECT s.*, 
           urh.current_page, urh.total_pages, urh.completed, urh.last_read_at
    FROM stories s
    JOIN user_reading_history urh ON s.id = urh.story_id
    WHERE urh.user_id = ? AND s.status = 'completed'
    ORDER BY urh.last_read_at DESC
    LIMIT ${limitInt}
  `;

  const stories = await query(sql, [userId]);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    coverUrl: s.cover_url,
    currentPage: s.current_page,
    totalPages: s.total_pages,
    completed: s.completed,
    progress: Math.round((s.current_page / s.total_pages) * 100),
    lastReadAt: s.last_read_at,
  }));
}

// ==================== USER PROFILES ====================

export async function getUserProfile(userId) {
  const users = await query(
    `SELECT u.*, 
            (SELECT COUNT(*) FROM user_followers WHERE following_id = u.id) as follower_count,
            (SELECT COUNT(*) FROM user_followers WHERE follower_id = u.id) as following_count,
            (SELECT COUNT(*) FROM stories WHERE user_id = u.id AND status = 'completed') as story_count
     FROM users u WHERE u.id = ?`,
    [userId],
  );

  if (users.length === 0) return null;

  const user = users[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    picture: user.picture,
    bio: user.bio,
    role: user.role || "user",
    isPublic: user.is_public,
    followerCount: user.follower_count,
    followingCount: user.following_count,
    storyCount: user.story_count,
    createdAt: user.created_at,
  };
}

export async function updateUserProfile(userId, updates) {
  const fields = [];
  const values = [];

  const fieldMap = {
    name: "name",
    username: "username",
    bio: "bio",
    isPublic: "is_public",
    picture: "picture",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  values.push(userId);
  await query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function getUserStoriesByUserId(userId, viewerId = null) {
  let sql = `
    SELECT s.*, 
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count
    FROM stories s
    WHERE s.user_id = ? AND s.status = 'completed'
  `;
  const params = [userId];

  // If viewer is not the owner, only show public stories
  if (viewerId !== userId) {
    sql += " AND s.is_public = TRUE";
  }

  sql += " ORDER BY s.created_at DESC";

  const stories = await query(sql, params);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    characterCount: s.character_count,
    pageCount: s.actual_page_count || s.page_count,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    volumeId: s.volume_id,
    volumeSortOrder: s.volume_sort_order,
  }));
}

// ==================== VOLUMES ====================

export async function createVolume(userId, { title, description }) {
  if (!title || !String(title).trim()) throw new Error("Volume title is required");
  const id = await insert(
    "INSERT INTO volumes (user_id, title, description) VALUES (?, ?, ?)",
    [userId, String(title).trim(), description ? String(description).trim() : null],
  );
  return id;
}

export async function getVolumesByUserId(userId) {
  const rows = await query(
    `SELECT v.*, (SELECT COUNT(*) FROM stories s WHERE s.volume_id = v.id) as story_count
     FROM volumes v WHERE v.user_id = ? ORDER BY v.created_at DESC`,
    [userId],
  );
  return rows.map((v) => ({
    id: v.id,
    userId: v.user_id,
    title: v.title,
    description: v.description,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
    storyCount: v.story_count ?? 0,
  }));
}

export async function getVolumeById(volumeId, viewerId = null) {
  const rows = await query(
    `SELECT v.*, u.name as author_name, u.username as author_username, u.picture as author_picture
     FROM volumes v
     LEFT JOIN users u ON v.user_id = u.id
     WHERE v.id = ?`,
    [volumeId],
  );
  if (rows.length === 0) return null;
  const v = rows[0];
  return {
    id: v.id,
    userId: v.user_id,
    title: v.title,
    description: v.description,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
    author: v.author_name ? { id: v.user_id, name: v.author_name, username: v.author_username, picture: v.author_picture } : null,
  };
}

export async function updateVolume(volumeId, userId, { title, description }) {
  const updates = [];
  const values = [];
  if (title !== undefined) {
    updates.push("title = ?");
    values.push(String(title).trim());
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(description === null || description === "" ? null : String(description).trim());
  }
  if (updates.length === 0) return;
  values.push(volumeId, userId);
  await query(
    `UPDATE volumes SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    values,
  );
}

export async function deleteVolume(volumeId, userId) {
  await query("UPDATE stories SET volume_id = NULL, volume_sort_order = 0 WHERE volume_id = ?", [volumeId]);
  await query("DELETE FROM volumes WHERE id = ? AND user_id = ?", [volumeId, userId]);
}

export async function setStoryVolume(storyId, userId, volumeId) {
  const story = await query("SELECT id, user_id FROM stories WHERE id = ?", [storyId]);
  if (story.length === 0) throw new Error("Story not found");
  if (story[0].user_id !== userId) throw new Error("Not authorized to change this story's volume");
  if (volumeId !== null) {
    const vol = await query("SELECT id, user_id FROM volumes WHERE id = ?", [volumeId]);
    if (vol.length === 0) throw new Error("Volume not found");
    if (vol[0].user_id !== userId) throw new Error("Not authorized to add stories to this volume");
  }
  const nextOrder = volumeId
    ? await query("SELECT COALESCE(MAX(volume_sort_order), 0) + 1 as next FROM stories WHERE volume_id = ?", [volumeId])
    : [{ next: 0 }];
  await query("UPDATE stories SET volume_id = ?, volume_sort_order = ? WHERE id = ?", [
    volumeId,
    volumeId ? nextOrder[0].next : 0,
    storyId,
  ]);
}

export async function getStoriesByVolumeId(volumeId, viewerId = null) {
  const vol = await getVolumeById(volumeId, viewerId);
  if (!vol) return null;
  let sql = `
    SELECT s.*,
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count
    FROM stories s
    WHERE s.volume_id = ? AND s.status = 'completed'
  `;
  const params = [volumeId];
  if (viewerId !== vol.userId) {
    sql += " AND s.is_public = TRUE";
  }
  sql += " ORDER BY s.volume_sort_order ASC, s.created_at ASC";
  const stories = await query(sql, params);
  return {
    volume: vol,
    stories: stories.map((s) => ({
      id: s.id,
      filename: `story_${s.id}`,
      title: s.title,
      summary: s.summary,
      characterCount: s.character_count,
      pageCount: s.actual_page_count || s.page_count,
      coverUrl: s.cover_url,
      artStyle: s.art_style_key,
      createdAt: s.created_at,
      volumeSortOrder: s.volume_sort_order,
    })),
  };
}

// ==================== FOLLOWERS ====================

export async function followUser(followerId, followingId) {
  if (followerId === followingId) {
    throw new Error("Cannot follow yourself");
  }

  try {
    await insert(
      "INSERT INTO user_followers (follower_id, following_id) VALUES (?, ?)",
      [followerId, followingId],
    );
    return true;
  } catch (e) {
    // Already following
    return false;
  }
}

export async function unfollowUser(followerId, followingId) {
  await query(
    "DELETE FROM user_followers WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return true;
}

export async function isFollowing(followerId, followingId) {
  const rows = await query(
    "SELECT id FROM user_followers WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return rows.length > 0;
}

export async function getFollowers(userId, limit = 50) {
  const limitInt = parseInt(limit, 10) || 50;
  const sql = `
    SELECT u.id, u.name, u.username, u.picture, u.bio, uf.created_at as followed_at
    FROM users u
    JOIN user_followers uf ON u.id = uf.follower_id
    WHERE uf.following_id = ?
    ORDER BY uf.created_at DESC
    LIMIT ${limitInt}
  `;
  return await query(sql, [userId]);
}

export async function getFollowing(userId, limit = 50) {
  const limitInt = parseInt(limit, 10) || 50;
  const sql = `
    SELECT u.id, u.name, u.username, u.picture, u.bio, uf.created_at as followed_at
    FROM users u
    JOIN user_followers uf ON u.id = uf.following_id
    WHERE uf.follower_id = ?
    ORDER BY uf.created_at DESC
    LIMIT ${limitInt}
  `;
  return await query(sql, [userId]);
}

export async function getFollowingIds(userId) {
  const rows = await query(
    "SELECT following_id FROM user_followers WHERE follower_id = ?",
    [userId],
  );
  return rows.map((r) => r.following_id);
}

// ==================== MESSAGES (P2P) ====================

export async function createMessage(senderId, recipientId, body) {
  const text = String(body).trim();
  if (!text) throw new Error("Message body is required");
  if (senderId === recipientId) throw new Error("Cannot message yourself");
  const id = await insert(
    "INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)",
    [senderId, recipientId, text],
  );
  const rows = await query(
    `SELECT m.*, u.name as sender_name, u.picture as sender_picture
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     WHERE m.id = ?`,
    [id],
  );
  return rows[0] || null;
}

/** List conversations for a user: other user + last message + unread count */
export async function getConversationsForUser(userId) {
  const peerRows = await query(
    `SELECT DISTINCT
        CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END as peer_id
     FROM messages m
     WHERE m.sender_id = ? OR m.recipient_id = ?`,
    [userId, userId, userId],
  );
  if (peerRows.length === 0) return [];

  const conversations = [];
  for (const row of peerRows) {
    const peerId = row.peer_id;
    const lastMsg = await query(
      `SELECT m.id, m.body, m.sender_id, m.created_at, m.read_at
       FROM messages m
       WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [userId, peerId, peerId, userId],
    );
    const unread = await query(
      "SELECT COUNT(*) as c FROM messages WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
      [userId, peerId],
    );
    const userRow = await query(
      "SELECT id, name, username, picture FROM users WHERE id = ?",
      [peerId],
    );
    const u = userRow[0];
    conversations.push({
      other_id: u.id,
      other_name: u.name,
      other_username: u.username,
      other_picture: u.picture,
      last_message_id: lastMsg[0]?.id,
      last_body: lastMsg[0]?.body,
      last_sender_id: lastMsg[0]?.sender_id,
      last_created_at: lastMsg[0]?.created_at,
      last_read_at: lastMsg[0]?.read_at,
      unread_count: parseInt(unread[0]?.c || 0, 10),
    });
  }
  conversations.sort((a, b) => new Date(b.last_created_at || 0) - new Date(a.last_created_at || 0));
  return conversations;
}

export async function getMessagesBetween(userId, otherUserId, limit = 50, beforeId = null) {
  const limitInt = Math.min(parseInt(limit, 10) || 50, 100);
  let sql = `
    SELECT m.*, u.name as sender_name, u.picture as sender_picture
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
  `;
  const params = [userId, otherUserId, otherUserId, userId];
  if (beforeId) {
    sql += " AND m.id < ?";
    params.push(beforeId);
  }
  sql += ` ORDER BY m.created_at DESC LIMIT ${limitInt}`;
  const rows = await query(sql, params);
  return rows.reverse();
}

export async function markMessagesAsRead(recipientUserId, senderUserId) {
  await query(
    "UPDATE messages SET read_at = COALESCE(read_at, NOW()) WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
    [recipientUserId, senderUserId],
  );
}

// ==================== PERSONALIZED FEED ====================

export async function getPersonalizedFeed(userId, limit = 50) {
  // Get IDs of users the current user follows
  const followingIds = await getFollowingIds(userId);

  // Get IDs of stories the user is currently reading (not completed)
  const readingRows = await query(
    "SELECT story_id FROM user_reading_history WHERE user_id = ? AND completed = FALSE",
    [userId],
  );
  const readingStoryIds = readingRows.map((r) => r.story_id);

  if (followingIds.length === 0 && readingStoryIds.length === 0) {
    // No follows and no reading history - return regular story list
    return await listStories();
  }

  // If no follows but has reading stories, we still need to exclude them
  if (followingIds.length === 0) {
    const limitInt = parseInt(limit, 10) || 50;
    const readingExclusion = `AND s.id NOT IN (${readingStoryIds.map(() => "?").join(",")})`;

    const sql = `
      SELECT s.*, 
             u.name as author_name, u.username as author_username, u.picture as author_picture,
             (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
             (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count,
             0 as is_followed,
             GROUP_CONCAT(DISTINCT t.name) as tag_names
      FROM stories s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN story_tags st ON s.id = st.story_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE s.status = 'completed' AND s.is_public = TRUE ${readingExclusion}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ${limitInt}
    `;

    const stories = await query(sql, readingStoryIds);

    return stories.map((s) => ({
      id: s.id,
      filename: `story_${s.id}`,
      title: s.title,
      summary: s.summary,
      characterCount: s.character_count,
      pageCount: s.actual_page_count || s.page_count,
      coverUrl: s.cover_url,
      artStyle: s.art_style_key,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      isPublic: s.is_public,
      userId: s.user_id,
      author: s.author_name
        ? {
            id: s.user_id,
            name: s.author_name,
            username: s.author_username,
            picture: s.author_picture,
          }
        : null,
      isFromFollowed: false,
      tags: s.tag_names ? s.tag_names.split(",") : [],
    }));
  }

  // Query stories with boost for followed users
  // Stories from followed users get priority (ordered first), then others
  // Exclude stories the user is already reading
  const limitInt = parseInt(limit, 10) || 50;

  // Build the exclusion clause for reading stories
  const readingExclusion =
    readingStoryIds.length > 0
      ? `AND s.id NOT IN (${readingStoryIds.map(() => "?").join(",")})`
      : "";

  // Build the is_followed case statement
  const isFollowedCase =
    followingIds.length > 0
      ? `CASE WHEN s.user_id IN (${followingIds.map(() => "?").join(",")}) THEN 1 ELSE 0 END`
      : "0";

  const sql = `
    SELECT s.*, 
           u.name as author_name, u.username as author_username, u.picture as author_picture,
           (SELECT COUNT(*) FROM characters WHERE story_id = s.id) as character_count,
           (SELECT COUNT(*) FROM pages WHERE story_id = s.id) as actual_page_count,
           ${isFollowedCase} as is_followed,
           GROUP_CONCAT(DISTINCT t.name) as tag_names
    FROM stories s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN story_tags st ON s.id = st.story_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.status = 'completed' AND s.is_public = TRUE ${readingExclusion}
    GROUP BY s.id
    ORDER BY is_followed DESC, s.created_at DESC
    LIMIT ${limitInt}
  `;

  const params = [...followingIds, ...readingStoryIds];
  const stories = await query(sql, params);

  return stories.map((s) => ({
    id: s.id,
    filename: `story_${s.id}`,
    title: s.title,
    summary: s.summary,
    characterCount: s.character_count,
    pageCount: s.actual_page_count || s.page_count,
    coverUrl: s.cover_url,
    artStyle: s.art_style_key,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    isPublic: s.is_public,
    userId: s.user_id,
    author: s.author_name
      ? {
          id: s.user_id,
          name: s.author_name,
          username: s.author_username,
          picture: s.author_picture,
        }
      : null,
    isFromFollowed: s.is_followed === 1,
    tags: s.tag_names ? s.tag_names.split(",") : [],
  }));
}

// ==================== USER AVATARS ====================

/**
 * Get all avatars saved by a user
 */
export async function getUserAvatars(userId) {
  const rows = await query(
    `SELECT * FROM user_avatars WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    avatarUrl: a.avatar_url,
    avatarPath: a.avatar_path,
    avatarPrompt: a.avatar_prompt,
    createdAt: a.created_at,
  }));
}

/**
 * Save an avatar to user's library
 */
export async function saveUserAvatar(userId, avatarData) {
  const id = await insert(
    `INSERT INTO user_avatars (user_id, name, description, avatar_url, avatar_path, avatar_prompt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      avatarData.name,
      avatarData.description || null,
      avatarData.avatarUrl,
      avatarData.avatarPath || avatarData.avatarUrl,
      avatarData.avatarPrompt || null,
    ],
  );
  return { id, ...avatarData };
}

/**
 * Get a single user avatar by ID
 */
export async function getUserAvatarById(avatarId) {
  const rows = await query(`SELECT * FROM user_avatars WHERE id = ?`, [
    avatarId,
  ]);
  if (rows.length === 0) return null;
  const a = rows[0];
  return {
    id: a.id,
    userId: a.user_id,
    name: a.name,
    description: a.description,
    avatarUrl: a.avatar_url,
    avatarPath: a.avatar_path,
    avatarPrompt: a.avatar_prompt,
    createdAt: a.created_at,
  };
}

/**
 * Delete a user avatar
 */
export async function deleteUserAvatar(userId, avatarId) {
  await query(`DELETE FROM user_avatars WHERE id = ? AND user_id = ?`, [
    avatarId,
    userId,
  ]);
}

/**
 * Update a user avatar
 */
export async function updateUserAvatar(avatarId, updates) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }

  if (fields.length === 0) return;

  values.push(avatarId);
  await query(
    `UPDATE user_avatars SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
}

// ==================== APP LOGS ====================

/**
 * Get application logs with optional filtering
 */
export async function getAppLogs(filters = {}) {
  const {
    level,
    context,
    jobId,
    userId,
    search,
    limit = 100,
    offset = 0,
  } = filters;

  const limitInt = parseInt(limit, 10) || 100;
  const offsetInt = parseInt(offset, 10) || 0;

  let sql = "SELECT * FROM app_logs WHERE 1=1";
  const params = [];

  if (level) {
    sql += " AND level = ?";
    params.push(level);
  }
  if (context) {
    sql += " AND context LIKE ?";
    params.push(`%${context}%`);
  }
  if (jobId) {
    sql += " AND job_id = ?";
    params.push(jobId);
  }
  if (userId) {
    sql += " AND user_id = ?";
    params.push(parseInt(userId, 10));
  }
  if (search) {
    sql += " AND (message LIKE ? OR details LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

  const logs = await query(sql, params);

  return logs.map((log) => ({
    id: log.id,
    level: log.level,
    context: log.context,
    message: log.message,
    details: log.details ? safeJsonParse(log.details, log.details) : null,
    jobId: log.job_id,
    userId: log.user_id,
    createdAt: log.created_at,
  }));
}

/**
 * Get app log statistics
 */
export async function getAppLogStats(filters = {}) {
  const { startDate, endDate } = filters;

  let sql = `
    SELECT 
      level,
      context,
      COUNT(*) as count
    FROM app_logs
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += " AND created_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    sql += " AND created_at <= ?";
    params.push(endDate);
  }

  sql += " GROUP BY level, context ORDER BY count DESC LIMIT 50";

  return await query(sql, params);
}

/**
 * Clear old app logs (older than specified days)
 */
export async function clearOldAppLogs(daysOld = 7) {
  const result = await query(
    "DELETE FROM app_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [daysOld],
  );
  return result.affectedRows || 0;
}

// ==================== S3 RESOURCES ====================

/**
 * Get all image URLs stored in the database (for S3 orphan detection)
 * Returns URLs from: stories (cover), characters (avatars), pages (illustrations),
 * user_avatars, and drafts
 */
export async function getAllImageUrls() {
  const urls = new Set();

  // Story cover images
  const storyCoverUrls = await query(
    "SELECT cover_url, cover_path FROM stories WHERE cover_url IS NOT NULL OR cover_path IS NOT NULL"
  );
  for (const row of storyCoverUrls) {
    if (row.cover_url) urls.add(row.cover_url);
    if (row.cover_path) urls.add(row.cover_path);
  }

  // Character avatar images
  const characterAvatarUrls = await query(
    "SELECT avatar_url, avatar_path FROM characters WHERE avatar_url IS NOT NULL OR avatar_path IS NOT NULL"
  );
  for (const row of characterAvatarUrls) {
    if (row.avatar_url) urls.add(row.avatar_url);
    if (row.avatar_path) urls.add(row.avatar_path);
  }

  // Page illustration images
  const pageIllustrationUrls = await query(
    "SELECT illustration_url, illustration_path FROM pages WHERE illustration_url IS NOT NULL OR illustration_path IS NOT NULL"
  );
  for (const row of pageIllustrationUrls) {
    if (row.illustration_url) urls.add(row.illustration_url);
    if (row.illustration_path) urls.add(row.illustration_path);
  }

  // User saved avatars
  const userAvatarUrls = await query(
    "SELECT avatar_url FROM user_avatars WHERE avatar_url IS NOT NULL"
  );
  for (const row of userAvatarUrls) {
    if (row.avatar_url) urls.add(row.avatar_url);
  }

  // Draft images (stored in separate JSON columns)
  const drafts = await query("SELECT characters, story_pages, cover FROM drafts");
  for (const row of drafts) {
    try {
      // Draft cover
      const cover = typeof row.cover === "string" ? JSON.parse(row.cover) : row.cover;
      if (cover?.illustrationUrl) urls.add(cover.illustrationUrl);
      if (cover?.illustrationPath) urls.add(cover.illustrationPath);
      
      // Draft characters
      const characters = typeof row.characters === "string" ? JSON.parse(row.characters) : row.characters;
      for (const char of characters || []) {
        if (char.avatarUrl) urls.add(char.avatarUrl);
        if (char.avatarPath) urls.add(char.avatarPath);
      }
      
      // Draft pages
      const storyPages = typeof row.story_pages === "string" ? JSON.parse(row.story_pages) : row.story_pages;
      for (const page of storyPages?.pages || []) {
        if (page.illustrationUrl) urls.add(page.illustrationUrl);
        if (page.illustrationPath) urls.add(page.illustrationPath);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  return Array.from(urls);
}

// ==================== HELPERS ====================

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(str, fallback = null) {
  if (!str || str === "" || str === "null" || str === "undefined") {
    return fallback;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function formatStoryOutput(story, characters, pages) {
  return {
    id: story.id,
    originalStory: story.original_story,
    artStyleDecision: {
      selectedStyle: story.art_style_key,
      stylePrompt: story.art_style_prompt,
      reasoning: story.art_style_reasoning,
    },
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      description: c.description,
      avatarPrompt: c.avatar_prompt,
      avatarUrl: c.avatar_url,
      avatarPath: c.avatar_path,
      customDescription: c.custom_description,
      hasReferenceImage: c.has_reference_image,
    })),
    storyPages: {
      title: story.title,
      summary: story.summary,
      pages: pages.map((p) => ({
        id: p.id,
        pageNumber: p.page_number,
        text: p.text,
        imageDescription: p.image_description,
        charactersInScene: safeJsonParse(p.characters_in_scene, []),
        illustrationUrl: p.illustration_url,
        illustrationPath: p.illustration_path,
        customDescription: p.custom_description,
        regenerated: p.regenerated,
      })),
    },
    cover: story.cover_url
      ? {
          type: "cover",
          title: story.title,
          illustrationUrl: story.cover_url,
          illustrationPath: story.cover_path,
        }
      : null,
    metadata: {
      timestamp: story.created_at,
      pageCount: story.page_count,
      targetAudience: story.target_audience,
      genre: story.genre || null,
      lastEdited: story.updated_at,
    },
    userId: story.user_id,
  };
}

function formatDraftOutput(draft) {
  console.log(draft);
  const currentStep = draft.current_step || 0;
  const phase = draft.phase;

  // Determine step label based on current step and phase
  let stepLabel = "Story Written";
  if (currentStep === 0 || phase === "story_input") {
    stepLabel = "Story Written";
  } else if (currentStep === 1 || phase === "art_style_selection") {
    stepLabel = "Choosing Style";
  } else if (
    currentStep === 2 ||
    phase === "character_extraction" ||
    phase === "awaiting_avatar_input"
  ) {
    stepLabel = "Review Avatars";
  } else if (currentStep === 3 || phase === "awaiting_page_review") {
    stepLabel = "Review Pages";
  }

  // Extract title from story (first line or first 50 chars)
  const storyText = draft.story_text || "";
  const storyPages = draft.story_pages;
  let title = storyPages?.title;
  if (!title && storyText) {
    const firstLine = storyText.split("\n")[0];
    title = firstLine.slice(0, 50) + (firstLine.length > 50 ? "..." : "");
  }
  title = title || "Untitled Draft";

  return {
    jobId: draft.job_id,
    filename: `draft_${draft.job_id}`,
    title,
    story: storyText,
    status: draft.status,
    phase: draft.phase,
    progress: draft.progress,
    message: draft.message,
    artStyleKey: draft.art_style_key,
    artStylePrompt: draft.art_style_prompt,
    artStyleDecision: safeJsonParse(draft.art_style_decision, null),
    characters: draft.characters,
    storyPages,
    cover: draft.cover,
    pageCount: draft.page_count,
    targetAudience: draft.target_audience,
    genre: draft.genre || null,
    currentStep,
    stepLabel,
    savedAt: draft.updated_at,
    createdAt: draft.created_at,
    isDraft: true,
  };
}

export default {
  // Users
  findOrCreateUser,
  getUserById,
  getAllUsers,
  getUserStats,
  updateUserRole,
  hasRole,
  // Stories
  createStory,
  updateStory,
  getStoryById,
  listStories,
  deleteStory,
  saveCompleteStory,
  searchStories,
  // Characters
  createCharacter,
  updateCharacter,
  getCharactersByStoryId,
  // Pages
  createPage,
  updatePage,
  getPagesByStoryId,
  // Drafts
  saveDraft,
  loadDraft,
  listDrafts,
  deleteDraft,
  // Tags
  getAllTags,
  createTag,
  getTagsByStoryId,
  addTagToStory,
  removeTagFromStory,
  setStoryTags,
  // Favorites
  addFavorite,
  removeFavorite,
  getUserFavorites,
  isFavorite,
  getUserFavoriteIds,
  // Reading History
  updateReadingProgress,
  getReadingProgress,
  getCurrentlyReading,
  getReadingHistory,
  // User Profiles
  getUserProfile,
  updateUserProfile,
  getUserStoriesByUserId,
  // Volumes
  createVolume,
  getVolumesByUserId,
  getVolumeById,
  updateVolume,
  deleteVolume,
  setStoryVolume,
  getStoriesByVolumeId,
  // Followers
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  getFollowingIds,
  // Personalized Feed
  getPersonalizedFeed,
  // User Avatars
  getUserAvatars,
  saveUserAvatar,
  getUserAvatarById,
  deleteUserAvatar,
  updateUserAvatar,
  // App Logs
  getAppLogs,
  getAppLogStats,
  clearOldAppLogs,
  // S3 Resources
  getAllImageUrls,
};
