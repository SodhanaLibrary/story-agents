import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("S3");

let s3Client = null;

/**
 * Initialize S3 client
 */
function getS3Client() {
  if (!s3Client && config.storage.type === "s3") {
    const s3Config = config.storage.s3;

    if (!s3Config.bucket) {
      throw new Error("S3_BUCKET environment variable is required for S3 storage");
    }

    s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });

    logger.info(`S3 client initialized for bucket: ${s3Config.bucket}`);
  }

  return s3Client;
}

/**
 * Upload a buffer to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (path)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 URL or CDN URL
 */
export async function uploadToS3(buffer, key, contentType = "image/png") {
  const client = getS3Client();
  const s3Config = config.storage.s3;

  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  logger.debug(`Uploaded to S3: ${key}`);

  // Return CDN URL if configured, otherwise S3 URL
  if (s3Config.cdnUrl) {
    return `${s3Config.cdnUrl}/${key}`;
  }

  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
}

/**
 * Delete an object from S3
 * @param {string} key - S3 object key (path)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteFromS3(key) {
  try {
    const client = getS3Client();
    const s3Config = config.storage.s3;

    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    await client.send(command);
    logger.debug(`Deleted from S3: ${key}`);
    return true;
  } catch (err) {
    logger.warn(`Failed to delete from S3: ${key} - ${err.message}`);
    return false;
  }
}

/**
 * Get a readable stream for an S3 object (e.g. for piping to HTTP response)
 * @param {string} key - S3 object key
 * @returns {Promise<{ Body: import('stream').Readable, ContentType?: string }|null>} - Stream and optional content type, or null if not found
 */
export async function getS3ObjectStream(key) {
  try {
    const client = getS3Client();
    if (!client) return null;
    const s3Config = config.storage.s3;
    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });
    const response = await client.send(command);
    return {
      Body: response.Body,
      ContentType: response.ContentType || "image/png",
    };
  } catch (err) {
    logger.warn(`Failed to get S3 object stream ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Get a pre-signed URL for an S3 object
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<string>} - Pre-signed URL
 */
export async function getSignedS3Url(key, expiresIn = 3600) {
  const client = getS3Client();
  const s3Config = config.storage.s3;

  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Extract S3 key from a full S3 URL
 * @param {string} url - S3 URL or CDN URL
 * @returns {string|null} - S3 key or null if not an S3 URL
 */
export function extractS3Key(url) {
  if (!url) return null;

  const s3Config = config.storage.s3;

  // Handle CDN URL
  if (s3Config.cdnUrl && url.startsWith(s3Config.cdnUrl)) {
    return url.replace(`${s3Config.cdnUrl}/`, "");
  }

  // Handle S3 URL format: https://bucket.s3.region.amazonaws.com/key
  const s3Pattern = new RegExp(
    `https://${s3Config.bucket}\\.s3\\.${s3Config.region}\\.amazonaws\\.com/(.+)`
  );
  const match = url.match(s3Pattern);

  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Check if S3 storage is enabled
 * @returns {boolean}
 */
export function isS3Enabled() {
  return config.storage.type === "s3" && !!config.storage.s3.bucket;
}

/**
 * List all objects in the S3 bucket
 * @param {string} prefix - Optional prefix to filter objects
 * @param {number} maxKeys - Maximum number of keys to return (default 1000)
 * @returns {Promise<Array>} - Array of S3 objects with key, size, lastModified
 */
export async function listS3Objects(prefix = "", maxKeys = 1000) {
  const client = getS3Client();
  const s3Config = config.storage.s3;

  const objects = [];
  let continuationToken = null;

  do {
    const command = new ListObjectsV2Command({
      Bucket: s3Config.bucket,
      Prefix: prefix,
      MaxKeys: Math.min(maxKeys - objects.length, 1000),
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        // Build the full URL for each object
        let url;
        if (s3Config.cdnUrl) {
          url = `${s3Config.cdnUrl}/${obj.Key}`;
        } else {
          url = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${obj.Key}`;
        }

        objects.push({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          url: url,
        });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken && objects.length < maxKeys);

  logger.info(`Listed ${objects.length} objects from S3 with prefix: ${prefix || "(none)"}`);
  return objects;
}

/**
 * Get S3 bucket info (configuration details)
 * @returns {Object} - Bucket configuration
 */
export function getS3BucketInfo() {
  const s3Config = config.storage.s3;
  return {
    bucket: s3Config.bucket,
    region: s3Config.region,
    cdnUrl: s3Config.cdnUrl || null,
    isEnabled: isS3Enabled(),
  };
}

export default {
  uploadToS3,
  deleteFromS3,
  getSignedS3Url,
  extractS3Key,
  isS3Enabled,
  listS3Objects,
  getS3BucketInfo,
};
