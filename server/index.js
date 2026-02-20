import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  getUserById,
  userBelongsToAnyOrg,
  isUsingS3,
  saveDraft,
} from "../src/utils/storage.js";
import { initializeDatabase, getPool } from "../src/services/database.js";
import config from "../src/config.js";
import {
  createLogger,
  requestLogger,
  enableDbLogging,
} from "../src/utils/logger.js";
import {
  setContext as setPromptContext,
  getTotalTokensUsedByUser,
} from "../src/services/promptLogger.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerOpenStoriesRoutes } from "./routes/openStories.js";
import { registerOrgsRoutes } from "./routes/orgs.js";
import { registerPromptsRoutes } from "./routes/prompts.js";
import { registerAppLogsRoutes } from "./routes/appLogs.js";
import { registerS3Routes } from "./routes/s3.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerBatchRoutes } from "./routes/batch.js";
import { registerDraftsRoutes } from "./routes/drafts.js";
import { registerUsersRoutes } from "./routes/users.js";
import { registerStoriesRoutes } from "./routes/stories.js";
import { registerGenerationRoutes } from "./routes/generation.js";
import { registerMessagesRoutes } from "./routes/messages.js";
import { registerAuthorsRoutes } from "./routes/authors.js";
import { registerVolumesRoutes } from "./routes/volumes.js";

const logger = createLogger("Server");

initializeDatabase()
  .then(() => {
    const pool = getPool();
    if (pool) {
      enableDbLogging(pool);
      logger.info("Database logging enabled");
    }
  })
  .catch((err) => {
    logger.error("Failed to initialize database:", err.message);
    logger.warn("Server will continue but database features may not work.");
  });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// Auth middleware - extract user ID from request and set in prompt context (incl. usageType for billing)
app.use(async (req, res, next) => {
  const userId =
    req.headers["x-user-id"] || req.body?.userId || req.query?.userId || null;

  if (userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!isNaN(parsedUserId)) {
      req.userId = parsedUserId;
      let usageType = "free";
      try {
        const user = await getUserById(parsedUserId);
        const inTeam = await userBelongsToAnyOrg(parsedUserId);
        if (
          user &&
          (user.plan === "pro" ||
            inTeam ||
            ["premium-user", "admin", "super-admin"].includes(user.role))
        ) {
          usageType = "included";
        }
      } catch (e) {
        /* ignore */
      }
      setPromptContext({ userId: parsedUserId, usageType });
    }
  }
  next();
});

// Serve static files from storage
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

// Store active generation jobs
const activeJobs = new Map();
const activeBatchJobs = new Map();

/** Free plan: 2M tokens once. Pro: unlimited. */
const FREE_TOKEN_LIMIT = config.plans?.freeTokenLimit ?? 2_000_000;

/**
 * Convert image path to URL
 */
function getImageUrl(imagePath, type = "page") {
  if (!imagePath) return null;

  if (
    isUsingS3() ||
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://")
  ) {
    return imagePath;
  }

  const folder =
    type === "avatar" ? "avatars" : type === "open_story" ? "open-stories" : "pages";
  return `/storage/${folder}/${path.basename(imagePath)}`;
}

async function checkFreePlanTokenLimit(userId) {
  const user = await getUserById(userId);
  if (!user)
    return {
      allowed: false,
      used: 0,
      limit: FREE_TOKEN_LIMIT,
      upgradeRequired: true,
    };
  if (
    user.plan === "pro" ||
    ["admin", "super-admin"].includes(user.role || "")
  ) {
    return {
      allowed: true,
      used: 0,
      limit: FREE_TOKEN_LIMIT,
      upgradeRequired: false,
    };
  }
  if (await userBelongsToAnyOrg(userId)) {
    return {
      allowed: true,
      used: 0,
      limit: FREE_TOKEN_LIMIT,
      upgradeRequired: false,
    };
  }
  const used = await getTotalTokensUsedByUser(userId);
  const upgradeRequired = used >= FREE_TOKEN_LIMIT;
  return {
    allowed: !upgradeRequired,
    used,
    limit: FREE_TOKEN_LIMIT,
    upgradeRequired,
  };
}

async function updateJobWithDraft(jobId, updates) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const updatedJob = { ...job, ...updates };
  activeJobs.set(jobId, updatedJob);

  if (updatedJob.status !== "completed" && updatedJob.status !== "error") {
    try {
      await saveDraft(jobId, updatedJob);
    } catch (err) {
      logger.error("Failed to auto-save draft:", err.message);
    }
  }

  return updatedJob;
}

const deps = {
  activeJobs,
  activeBatchJobs,
  getImageUrl,
  checkFreePlanTokenLimit,
  updateJobWithDraft,
};

registerHealthRoutes(app);
registerAuthRoutes(app);
registerMeRoutes(app);
registerBillingRoutes(app);
registerOpenStoriesRoutes(app);
registerOrgsRoutes(app);
registerPromptsRoutes(app);
registerAppLogsRoutes(app);
registerS3Routes(app);
registerAdminRoutes(app);
registerBatchRoutes(app, deps);
registerDraftsRoutes(app, deps);
registerUsersRoutes(app);
registerStoriesRoutes(app, deps);
registerGenerationRoutes(app, deps);
registerMessagesRoutes(app);
registerAuthorsRoutes(app);
registerVolumesRoutes(app);

// Start server
app.listen(PORT, () => {
  logger.section("Story Agents API Server");
  logger.success(`Server running on http://localhost:${PORT}`);
  logger.info(`API Key configured: ${config.openai.apiKey ? "Yes" : "No"}`);
  logger.info(`AI Provider: ${config.aiProvider || "openai"}`);
  logger.info(`Log level: ${process.env.LOG_LEVEL || "info"}`);
});

export default app;
