import { query, insert } from "./database.js";
import { createLogger } from "../utils/logger.js";

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
    [googleId, email]
  );

  if (existing.length > 0) {
    // Update user info
    await query(
      "UPDATE users SET name = ?, picture = ?, google_id = ? WHERE id = ?",
      [name, picture, googleId, existing[0].id]
    );
    return existing[0];
  }

  // Create new user
  const userId = await insert(
    "INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)",
    [googleId, email, name, picture]
  );

  return { id: userId, google_id: googleId, email, name, picture };
}

export async function getUserById(userId) {
  const rows = await query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0] || null;
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
  } = storyData;

  const storyId = await insert(
    `INSERT INTO stories 
     (user_id, title, summary, original_story, art_style_key, art_style_prompt, 
      art_style_reasoning, cover_url, cover_path, page_count, target_audience, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
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
    ]
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
    [storyId]
  );

  // Get pages
  const pages = await query(
    "SELECT * FROM pages WHERE story_id = ? ORDER BY page_number",
    [storyId]
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

export async function deleteStory(storyId) {
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
    ]
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
    values
  );
}

export async function getCharactersByStoryId(storyId) {
  return await query("SELECT * FROM characters WHERE story_id = ?", [storyId]);
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
    ]
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
    [storyId]
  );
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
       target_audience = ?, current_step = ?, user_id = COALESCE(?, user_id)
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
        currentStep,
        userId,
        jobId,
      ]
    );
  } else {
    await insert(
      `INSERT INTO drafts 
       (job_id, user_id, story_text, status, phase, progress, message,
        art_style_key, art_style_prompt, art_style_decision,
        characters, story_pages, cover, page_count, target_audience, current_step)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        currentStep,
      ]
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

export async function deleteDraft(jobId) {
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
    },
    userId
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
    [storyId]
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
      [userId, storyId]
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
    [userId, storyId]
  );
  return rows.length > 0;
}

export async function getUserFavoriteIds(userId) {
  const rows = await query(
    "SELECT story_id FROM user_favorites WHERE user_id = ?",
    [userId]
  );
  return rows.map((r) => r.story_id);
}

// ==================== READING HISTORY ====================

export async function updateReadingProgress(
  userId,
  storyId,
  currentPage,
  totalPages
) {
  const completed = currentPage >= totalPages;

  const existing = await query(
    "SELECT id FROM user_reading_history WHERE user_id = ? AND story_id = ?",
    [userId, storyId]
  );

  if (existing.length > 0) {
    await query(
      `UPDATE user_reading_history 
       SET current_page = ?, total_pages = ?, completed = ?, last_read_at = NOW()
       WHERE user_id = ? AND story_id = ?`,
      [currentPage, totalPages, completed, userId, storyId]
    );
  } else {
    await insert(
      `INSERT INTO user_reading_history 
       (user_id, story_id, current_page, total_pages, completed)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, storyId, currentPage, totalPages, completed]
    );
  }

  return { currentPage, totalPages, completed };
}

export async function getReadingProgress(userId, storyId) {
  const rows = await query(
    "SELECT * FROM user_reading_history WHERE user_id = ? AND story_id = ?",
    [userId, storyId]
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
    [userId]
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
  }));
}

// ==================== FOLLOWERS ====================

export async function followUser(followerId, followingId) {
  if (followerId === followingId) {
    throw new Error("Cannot follow yourself");
  }

  try {
    await insert(
      "INSERT INTO user_followers (follower_id, following_id) VALUES (?, ?)",
      [followerId, followingId]
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
    [followerId, followingId]
  );
  return true;
}

export async function isFollowing(followerId, followingId) {
  const rows = await query(
    "SELECT id FROM user_followers WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId]
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
    [userId]
  );
  return rows.map((r) => r.following_id);
}

// ==================== PERSONALIZED FEED ====================

export async function getPersonalizedFeed(userId, limit = 50) {
  // Get IDs of users the current user follows
  const followingIds = await getFollowingIds(userId);

  // Get IDs of stories the user is currently reading (not completed)
  const readingRows = await query(
    "SELECT story_id FROM user_reading_history WHERE user_id = ? AND completed = FALSE",
    [userId]
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
  // Followers
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  getFollowingIds,
  // Personalized Feed
  getPersonalizedFeed,
};
