import {
  getS3BucketInfo,
  listS3Objects,
  getAllImageUrls,
  deleteFromS3,
} from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("S3Routes");

/**
 * Register S3 resource routes.
 * @param {import('express').Application} app
 */
export function registerS3Routes(app) {
  app.get("/api/s3/info", async (req, res) => {
    try {
      const info = getS3BucketInfo();
      res.json(info);
    } catch (error) {
      logger.error("Error getting S3 info:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/s3/objects", async (req, res) => {
    try {
      const { prefix } = req.query;

      const bucketInfo = getS3BucketInfo();
      if (!bucketInfo.isEnabled) {
        return res.status(400).json({ error: "S3 storage is not enabled" });
      }

      const s3Objects = await listS3Objects(prefix || "", 5000);
      const dbUrls = await getAllImageUrls();
      const dbUrlSet = new Set(dbUrls);

      const objectsWithStatus = s3Objects.map((obj) => {
        const isLinked = dbUrlSet.has(obj.url) || dbUrlSet.has(obj.key);
        return {
          ...obj,
          isLinked,
          isOrphan: !isLinked,
        };
      });

      const totalSize = s3Objects.reduce((sum, obj) => sum + obj.size, 0);
      const orphanCount = objectsWithStatus.filter((obj) => obj.isOrphan).length;
      const orphanSize = objectsWithStatus
        .filter((obj) => obj.isOrphan)
        .reduce((sum, obj) => sum + obj.size, 0);

      res.json({
        bucket: bucketInfo.bucket,
        region: bucketInfo.region,
        cdnUrl: bucketInfo.cdnUrl,
        totalCount: s3Objects.length,
        totalSize,
        orphanCount,
        orphanSize,
        linkedCount: s3Objects.length - orphanCount,
        objects: objectsWithStatus,
      });
    } catch (error) {
      logger.error("Error listing S3 objects:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/s3/objects", async (req, res) => {
    try {
      const { keys } = req.body;

      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ error: "Keys array is required" });
      }

      const results = { deleted: [], failed: [] };

      for (const key of keys) {
        try {
          const success = await deleteFromS3(key);
          if (success) {
            results.deleted.push(key);
          } else {
            results.failed.push({ key, error: "Delete failed" });
          }
        } catch (err) {
          results.failed.push({ key, error: err.message });
        }
      }

      logger.info(
        `S3 cleanup: deleted ${results.deleted.length}, failed ${results.failed.length}`,
      );

      res.json({
        success: true,
        deletedCount: results.deleted.length,
        failedCount: results.failed.length,
        deleted: results.deleted,
        failed: results.failed,
      });
    } catch (error) {
      logger.error("Error deleting S3 objects:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/s3/orphans", async (req, res) => {
    try {
      const { prefix } = req.query;

      const bucketInfo = getS3BucketInfo();
      if (!bucketInfo.isEnabled) {
        return res.status(400).json({ error: "S3 storage is not enabled" });
      }

      const s3Objects = await listS3Objects(prefix || "", 5000);
      const dbUrls = await getAllImageUrls();
      const dbUrlSet = new Set(dbUrls);

      const orphanKeys = s3Objects
        .filter((obj) => !dbUrlSet.has(obj.url) && !dbUrlSet.has(obj.key))
        .map((obj) => obj.key);

      if (orphanKeys.length === 0) {
        return res.json({
          success: true,
          message: "No orphan objects found",
          deletedCount: 0,
        });
      }

      const results = { deleted: [], failed: [] };

      for (const key of orphanKeys) {
        try {
          const success = await deleteFromS3(key);
          if (success) {
            results.deleted.push(key);
          } else {
            results.failed.push({ key, error: "Delete failed" });
          }
        } catch (err) {
          results.failed.push({ key, error: err.message });
        }
      }

      logger.info(
        `S3 orphan cleanup: deleted ${results.deleted.length}, failed ${results.failed.length}`,
      );

      res.json({
        success: true,
        deletedCount: results.deleted.length,
        failedCount: results.failed.length,
        deleted: results.deleted,
        failed: results.failed,
      });
    } catch (error) {
      logger.error("Error deleting orphan S3 objects:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
