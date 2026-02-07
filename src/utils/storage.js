import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import config from "../config.js";
import * as storyRepo from "../services/storyRepository.js";
import { uploadToS3, deleteFromS3, extractS3Key, isS3Enabled } from "../services/s3.js";

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
 * Ensures storage directories exist (for local images only)
 */
export async function ensureStorageDirectories() {
  if (!isS3Enabled()) {
    await fs.mkdir(config.storage.avatarsPath, { recursive: true });
    await fs.mkdir(config.storage.pagesPath, { recursive: true });
  }
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
 * Gets the S3 prefix for a given type
 * @param {string} type - Type of storage ('avatar' or 'page')
 * @returns {string} - S3 key prefix
 */
function getS3Prefix(type) {
  return type === "avatar"
    ? config.storage.s3.avatarsPrefix
    : config.storage.s3.pagesPrefix;
}

/**
 * Saves an image from base64 data to storage (local or S3)
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} type - Type of image ('avatar' or 'page')
 * @param {string} name - Name for the file (will be sanitized)
 * @returns {Promise<string>} - Path/URL to saved file
 */
export async function saveImage(base64Data, type, name) {
  const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${sanitizedName}_${uuidv4().slice(0, 8)}.png`;

  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Clean, "base64");

  // Use S3 if enabled
  if (isS3Enabled()) {
    const s3Key = `${getS3Prefix(type)}/${filename}`;
    const s3Url = await uploadToS3(buffer, s3Key, "image/png");
    return s3Url;
  }

  // Otherwise use local storage
  await ensureStorageDirectories();
  const storagePath =
    type === "avatar" ? config.storage.avatarsPath : config.storage.pagesPath;
  const filePath = path.join(storagePath, filename);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Saves image from URL to storage (local or S3)
 * @param {string} url - Image URL
 * @param {string} type - Type of image ('avatar' or 'page')
 * @param {string} name - Name for the file
 * @returns {Promise<string>} - Path/URL to saved file
 */
export async function saveImageFromUrl(url, type, name) {
  console.log("Saving image from URL:", url, type, name);
  
  if (url?.base64) {
    return saveImage(url.base64, type, name);
  }
  
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const sanitizedName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${sanitizedName}_${uuidv4().slice(0, 8)}.png`;

  // Use S3 if enabled
  if (isS3Enabled()) {
    const s3Key = `${getS3Prefix(type)}/${filename}`;
    const s3Url = await uploadToS3(buffer, s3Key, "image/png");
    return s3Url;
  }

  // Otherwise use local storage
  await ensureStorageDirectories();
  const storagePath =
    type === "avatar" ? config.storage.avatarsPath : config.storage.pagesPath;
  const filePath = path.join(storagePath, filename);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Deletes an image file (local or S3)
 * @param {string} filePathOrUrl - Path to the image file or S3 URL
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteImage(filePathOrUrl) {
  try {
    if (!filePathOrUrl) return false;

    // Check if it's an S3 URL
    if (isS3Enabled()) {
      const s3Key = extractS3Key(filePathOrUrl);
      if (s3Key) {
        return await deleteFromS3(s3Key);
      }
    }

    // Try to delete as local file
    await fs.unlink(filePathOrUrl);
    return true;
  } catch (err) {
    // Ignore if file doesn't exist
  }
  return false;
}

/**
 * Check if S3 storage is being used
 * @returns {boolean}
 */
export function isUsingS3() {
  return isS3Enabled();
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
export async function saveJson(data, userId = null) {
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
  isUsingS3,
};
