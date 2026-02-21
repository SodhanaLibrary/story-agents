import path from "path";
import fs from "fs/promises";
import {
  getOpenStoryImageById,
  getStoryById,
  getPageById,
  getCharacterById,
  getUserAvatarById,
  loadDraft,
} from "../../src/services/storyRepository.js";
import config from "../../src/config.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("ImagesRoute");

/**
 * Resolve imageId to a URL or absolute file path.
 * imageId can be:
 * - numeric: open_story_images.id
 * - "story_cover-<storyId>": story cover
 * - "page_illus-<pageId>": page illustration
 * - "character_avatar-<characterId>": character avatar
 * - "user_avatar-<avatarId>": user_avatars avatar
 * @returns {Promise<{ urlOrPath: string, contentType?: string } | null>}
 */
async function resolveImageId(imageId) {
  if (imageId == null || String(imageId).trim() === "") return null;
  const id = String(imageId).trim();

  // Numeric: open_story_images.id
  const numericId = parseInt(id, 10);
  if (!isNaN(numericId) && String(numericId) === id) {
    const row = await getOpenStoryImageById(numericId);
    if (!row || !row.image_url) return null;
    return { urlOrPath: row.image_url };
  }

  // story_cover-<storyId>
  if (id.startsWith("story_cover-")) {
    const storyId = id.slice("story_cover-".length);
    const story = await getStoryById(parseInt(storyId, 10));
    if (!story || !story.cover) return null;
    const urlOrPath = story.cover.illustrationUrl || story.cover.illustrationPath;
    if (!urlOrPath) return null;
    return { urlOrPath };
  }

  // page_illus-<pageId>
  if (id.startsWith("page_illus-")) {
    const pageId = id.slice("page_illus-".length);
    const page = await getPageById(parseInt(pageId, 10));
    if (!page) return null;
    const urlOrPath = page.illustration_url || page.illustration_path;
    if (!urlOrPath) return null;
    return { urlOrPath };
  }

  // character_avatar-<characterId>
  if (id.startsWith("character_avatar-")) {
    const characterId = id.slice("character_avatar-".length);
    const char = await getCharacterById(parseInt(characterId, 10));
    if (!char) return null;
    const urlOrPath = char.avatar_url || char.avatar_path;
    if (!urlOrPath) return null;
    return { urlOrPath };
  }

  // user_avatar-<avatarId>
  if (id.startsWith("user_avatar-")) {
    const avatarId = id.slice("user_avatar-".length);
    const avatar = await getUserAvatarById(parseInt(avatarId, 10));
    if (!avatar) return null;
    const urlOrPath = avatar.avatarUrl || avatar.avatarPath;
    if (!urlOrPath) return null;
    return { urlOrPath };
  }

  // job_cover-<jobId>: draft cover image
  if (id.startsWith("job_cover-")) {
    const jobId = id.slice("job_cover-".length);
    try {
      const draft = await loadDraft(jobId);
      const cover = typeof draft.cover === "string" ? JSON.parse(draft.cover) : draft.cover;
      if (!cover) return null;
      const urlOrPath = cover.illustrationUrl || cover.illustrationPath;
      if (!urlOrPath) return null;
      return { urlOrPath };
    } catch {
      return null;
    }
  }

  // job_page-<jobId>-<pageNumber>: draft page illustration
  if (id.startsWith("job_page-")) {
    const rest = id.slice("job_page-".length);
    const dash = rest.lastIndexOf("-");
    if (dash <= 0) return null;
    const jobId = rest.slice(0, dash);
    const pageNumber = parseInt(rest.slice(dash + 1), 10);
    if (isNaN(pageNumber)) return null;
    try {
      const draft = await loadDraft(jobId);
      const storyPages = typeof draft.storyPages === "string" ? JSON.parse(draft.storyPages) : draft.storyPages;
      const pages = storyPages?.pages;
      if (!Array.isArray(pages)) return null;
      const page = pages.find((p) => p.pageNumber === pageNumber) || pages[pageNumber];
      if (!page) return null;
      const urlOrPath = page.illustrationUrl || page.illustrationPath;
      if (!urlOrPath) return null;
      return { urlOrPath };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get absolute path for a local file (path may be relative to storage or absolute)
 */
function toAbsolutePath(urlOrPath) {
  if (!urlOrPath) return null;
  if (path.isAbsolute(urlOrPath)) return urlOrPath;
  const base = config.storage?.basePath || path.join(process.cwd(), "storage");
  return path.join(base, urlOrPath);
}

export function registerImagesRoutes(app) {
  app.get("/api/v1/images", async (req, res) => {
    try {
      const imageId = req.query.imageId;
      const resolved = await resolveImageId(imageId);
      if (!resolved) {
        return res.status(404).json({ error: "Image not found" });
      }
      const { urlOrPath } = resolved;

      // HTTP(S) URL: redirect so the client loads the image from that URL
      if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
        return res.redirect(302, urlOrPath);
      }

      // Local file path
      const absolutePath = toAbsolutePath(urlOrPath);
      if (!absolutePath) return res.status(404).json({ error: "Image not found" });
      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({ error: "Image not found" });
      }
      const contentType = "image/png";
      res.setHeader("Content-Type", contentType);
      res.sendFile(absolutePath, (err) => {
        if (err && !res.headersSent) {
          logger.warn("Send image file failed:", err.message);
          res.status(500).json({ error: "Failed to serve image" });
        }
      });
    } catch (error) {
      logger.error("Error serving image:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
