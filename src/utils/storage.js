import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import config from "../config.js";
import * as storyRepo from "../services/storyRepository.js";

// Re-export repository functions for backward compatibility
export const {
  findOrCreateUser,
  getUserById,
  createStory,
  updateStory,
  getStoryById,
  deleteStory: deleteStoryFromDb,
  saveCompleteStory,
  searchStories,
  createCharacter,
  updateCharacter,
  getCharactersByStoryId,
  createPage,
  updatePage,
  getPagesByStoryId,
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
} = storyRepo;

/**
 * Ensures storage directories exist (for images only)
 */
export async function ensureStorageDirectories() {
  await fs.mkdir(config.storage.avatarsPath, { recursive: true });
  await fs.mkdir(config.storage.pagesPath, { recursive: true });
}

/**
 * Gets the storage path for a given type
 * @param {string} type - Type of storage ('avatar' or 'page')
 * @returns {string} - Storage directory path
 */
export function getStoragePath(type) {
  return type === "avatar"
    ? config.storage.avatarsPath
    : config.storage.pagesPath;
}

/**
 * Saves an image from base64 data to storage
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} type - Type of image ('avatar' or 'page')
 * @param {string} name - Name for the file (will be sanitized)
 * @returns {Promise<string>} - Path to saved file
 */
export async function saveImage(base64Data, type, name) {
  await ensureStorageDirectories();

  const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${sanitizedName}_${uuidv4().slice(0, 8)}.png`;

  const storagePath =
    type === "avatar" ? config.storage.avatarsPath : config.storage.pagesPath;
  const filePath = path.join(storagePath, filename);

  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Clean, "base64");

  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Saves image from URL to storage
 * @param {string} url - Image URL
 * @param {string} type - Type of image ('avatar' or 'page')
 * @param {string} name - Name for the file
 * @returns {Promise<string>} - Path to saved file
 */
export async function saveImageFromUrl(url, type, name) {
  await ensureStorageDirectories();
  console.log("Saving image from URL:", url, type, name);
  if (url?.base64) {
    return saveImage(url.base64, type, name);
  }
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${sanitizedName}_${uuidv4().slice(0, 8)}.png`;

  const storagePath =
    type === "avatar" ? config.storage.avatarsPath : config.storage.pagesPath;
  const filePath = path.join(storagePath, filename);

  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Deletes an image file
 * @param {string} filePath - Path to the image file
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteImage(filePath) {
  try {
    if (filePath) {
      await fs.unlink(filePath);
      return true;
    }
  } catch (err) {
    // Ignore if file doesn't exist
  }
  return false;
}

/**
 * Lists all saved stories from MySQL
 * @param {number} userId - Optional user ID to filter stories
 * @returns {Promise<Array>} - Array of story metadata
 */
export async function listSavedStories(userId = null) {
  return await storyRepo.listStories(userId);
}

/**
 * Loads a story by ID from MySQL
 * @param {number|string} storyIdOrFilename - Story ID or legacy filename
 * @returns {Promise<object>} - Story data
 */
export async function loadJson(storyIdOrFilename) {
  // Handle legacy filename format "story_output_xxx.json" or "story_123"
  let storyId;
  if (typeof storyIdOrFilename === "string") {
    if (storyIdOrFilename.startsWith("story_output_")) {
      // Legacy JSON filename - try to extract an ID or return null
      throw new Error("Legacy JSON files no longer supported. Use story ID.");
    } else if (storyIdOrFilename.startsWith("story_")) {
      storyId = parseInt(storyIdOrFilename.replace("story_", ""), 10);
    } else {
      storyId = parseInt(storyIdOrFilename, 10);
    }
  } else {
    storyId = storyIdOrFilename;
  }

  const story = await storyRepo.getStoryById(storyId);
  if (!story) {
    const error = new Error("Story not found");
    error.code = "ENOENT";
    throw error;
  }
  return story;
}

/**
 * Saves a complete story result to MySQL
 * @param {object} data - Story data
 * @param {string} filename - Ignored (for backward compatibility)
 * @param {number} userId - Optional user ID
 * @returns {Promise<number>} - Story ID
 */
export async function saveJson(data, filename, userId = null) {
  const storyId = await storyRepo.saveCompleteStory(data, userId);
  return storyId;
}

/**
 * Deletes a story from MySQL
 * @param {number|string} storyIdOrFilename - Story ID or filename
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteStory(storyIdOrFilename) {
  let storyId;
  if (typeof storyIdOrFilename === "string") {
    if (storyIdOrFilename.startsWith("story_")) {
      storyId = parseInt(storyIdOrFilename.replace("story_", ""), 10);
    } else {
      storyId = parseInt(storyIdOrFilename, 10);
    }
  } else {
    storyId = storyIdOrFilename;
  }

  return await storyRepo.deleteStory(storyId);
}

export default {
  ensureStorageDirectories,
  getStoragePath,
  saveImage,
  saveImageFromUrl,
  deleteImage,
  listSavedStories,
  loadJson,
  saveJson,
  deleteStory,
  saveDraft,
  loadDraft,
  listDrafts,
  deleteDraft,
};
