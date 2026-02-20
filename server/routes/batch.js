import { query, insert } from "../../src/services/database.js";
import { setContext as setPromptContext } from "../../src/services/promptLogger.js";
import { ArtStyleAgent, IllustrationAgent } from "../../src/agents/index.js";
import { saveDraft } from "../../src/utils/storage.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("BatchRoutes");

/**
 * Register batch request routes.
 * @param {import('express').Application} app
 * @param {{ activeJobs: Map, activeBatchJobs: Map, getImageUrl: (path: string, type?: string) => string|null }} deps
 */
export function registerBatchRoutes(app, deps) {
  const { activeJobs, activeBatchJobs, getImageUrl } = deps;

  async function processBatchRequest(batchId, jobId, userId) {
    try {
      await query(
        `UPDATE batch_requests SET status = 'processing', started_at = NOW() WHERE id = ?`,
        [batchId],
      );

      activeBatchJobs.set(batchId, { jobId, status: "processing" });

      const job = activeJobs.get(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      setPromptContext({ jobId, userId });

      const artStyleAgent = new ArtStyleAgent();
      const illustrationAgent = new IllustrationAgent();
      illustrationAgent.setCharacterReference(job.characters);

      const artStylePrompt =
        job.artStylePrompt || artStyleAgent.getStylePrompt("illustration");

      const pages = job.storyPages?.pages || [];
      let completedCount = 0;

      for (let i = 0; i < pages.length; i++) {
        if (!activeBatchJobs.has(batchId)) {
          logger.info(`Batch ${batchId} was cancelled, stopping processing`);
          return;
        }

        const page = pages[i];

        if (page.illustrationGenerated || page.illustrationUrl) {
          completedCount++;
          continue;
        }

        try {
          logger.info(
            `Batch ${batchId}: Generating illustration for page ${page.pageNumber}`,
          );

          const illustratedPage =
            await illustrationAgent.generatePageIllustration(page, {
              artStyle: artStylePrompt,
            });

          illustratedPage.illustrationUrl = getImageUrl(
            illustratedPage.illustrationPath,
            "page",
          );
          illustratedPage.illustrationGenerated = true;

          job.storyPages.pages[i] = illustratedPage;
          activeJobs.set(jobId, job);

          completedCount++;

          await query(
            `UPDATE batch_requests SET completed_pages = ? WHERE id = ?`,
            [completedCount, batchId],
          );

          await saveDraft(jobId, job);
        } catch (pageError) {
          logger.error(
            `Batch ${batchId}: Error generating page ${page.pageNumber}:`,
            pageError.message,
          );
        }
      }

      if (job.generateCover !== false && !job.cover?.illustrationUrl) {
        if (!activeBatchJobs.has(batchId)) {
          logger.info(`Batch ${batchId} was cancelled, stopping processing`);
          return;
        }

        try {
          logger.info(`Batch ${batchId}: Generating cover illustration`);
          const cover = await illustrationAgent.generateCoverIllustration(
            job.storyPages,
            job.characters,
            { artStyle: artStylePrompt },
          );

          cover.illustrationUrl = getImageUrl(cover.illustrationPath, "page");

          job.cover = cover;
          activeJobs.set(jobId, job);
          await saveDraft(jobId, job);

          completedCount++;
          await query(
            `UPDATE batch_requests SET completed_pages = ? WHERE id = ?`,
            [completedCount, batchId],
          );
        } catch (coverError) {
          logger.error(
            `Batch ${batchId}: Error generating cover:`,
            coverError.message,
          );
        }
      }

      job.status = "pages_ready";
      job.phase = "awaiting_page_review";
      job.progress = 95;
      job.message = "All illustrations generated. Ready for review.";
      activeJobs.set(jobId, job);
      await saveDraft(jobId, job);

      await query(
        `UPDATE batch_requests SET status = 'completed', completed_pages = ?, completed_at = NOW() WHERE id = ?`,
        [completedCount, batchId],
      );

      activeBatchJobs.delete(batchId);
      logger.success(
        `Batch ${batchId} completed: ${completedCount} pages generated`,
      );
    } catch (error) {
      logger.error(`Batch ${batchId} failed:`, error.message);

      await query(
        `UPDATE batch_requests SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
        [error.message, batchId],
      );

      activeBatchJobs.delete(batchId);
    }
  }

  app.post("/api/batch/create", async (req, res) => {
    try {
      const { jobId } = req.body;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const pageCount = job.storyPages?.pages?.length || 0;
      const storyTitle = job.storyPages?.title || "Untitled Story";
      const needsCover =
        job.generateCover !== false && !job.cover?.illustrationUrl;
      const totalPages = pageCount + (needsCover ? 1 : 0);

      const batchId = await insert(
        `INSERT INTO batch_requests (user_id, job_id, story_title, total_pages, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [userId, jobId, storyTitle, totalPages],
      );

      processBatchRequest(batchId, jobId, userId);

      res.json({
        success: true,
        batchId,
        message: "Batch request created",
        totalPages,
      });
    } catch (error) {
      logger.error("Error creating batch request:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/batch/list", async (req, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const batches = await query(
        `SELECT * FROM batch_requests 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId],
      );

      res.json({ batches });
    } catch (error) {
      logger.error("Error listing batch requests:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/batch/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const userId = req.userId;

      const batches = await query(`SELECT * FROM batch_requests WHERE id = ?`, [
        parseInt(batchId),
      ]);

      if (batches.length === 0) {
        return res.status(404).json({ error: "Batch request not found" });
      }

      const batch = batches[0];

      if (batch.user_id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({ batch });
    } catch (error) {
      logger.error("Error fetching batch request:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/batch/:batchId/cancel", async (req, res) => {
    try {
      const { batchId } = req.params;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const batches = await query(`SELECT * FROM batch_requests WHERE id = ?`, [
        parseInt(batchId),
      ]);

      if (batches.length === 0) {
        return res.status(404).json({ error: "Batch request not found" });
      }

      const batch = batches[0];

      if (batch.user_id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (batch.status === "completed" || batch.status === "cancelled") {
        return res
          .status(400)
          .json({ error: "Batch already " + batch.status });
      }

      await query(
        `UPDATE batch_requests SET status = 'cancelled', completed_at = NOW() WHERE id = ?`,
        [parseInt(batchId)],
      );

      activeBatchJobs.delete(parseInt(batchId));

      res.json({ success: true, message: "Batch request cancelled" });
    } catch (error) {
      logger.error("Error cancelling batch request:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
