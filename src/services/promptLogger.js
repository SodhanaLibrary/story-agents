/**
 * Prompt Logger Service - Logs all AI prompts to the database for tracing
 */
import { query } from "./database.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("PromptLogger");

// Context for associating prompts with jobs/stories (usageType: 'free' | 'included' for billing)
let currentContext = {
  jobId: null,
  storyId: null,
  userId: null,
  usageType: null,
};

/**
 * Sets the current context for prompt logging
 * @param {object} context - Context object with jobId, storyId, userId
 */
export function setContext(context) {
  currentContext = { ...currentContext, ...context };
}

/**
 * Clears the current context
 */
export function clearContext() {
  currentContext = { jobId: null, storyId: null, userId: null, usageType: null };
}

/**
 * Gets the current context
 * @returns {object} Current context
 */
export function getContext() {
  return { ...currentContext };
}

/**
 * Converts undefined to null for SQL compatibility
 */
function toNull(value) {
  return value === undefined ? null : value;
}

/** Approximate cost per 1M tokens for billing display (USD) */
const COST_PER_1M_TOKENS = 2.5;

/**
 * Estimate cost from token count for billing display
 * @param {number} tokensTotal
 * @param {string} usageType - 'free' | 'included'
 * @returns {number|null}
 */
function estimateCost(tokensTotal, usageType) {
  if (usageType === "free" || !tokensTotal) return 0;
  return Math.round((tokensTotal / 1_000_000) * COST_PER_1M_TOKENS * 100) / 100;
}

/**
 * Logs a prompt to the database
 * @param {object} logData - Log data
 * @returns {Promise<number>} - Log ID
 */
export async function logPrompt(logData) {
  const {
    provider,
    model,
    requestType,
    promptMessages,
    promptText,
    responseText,
    tokensInput,
    tokensOutput,
    tokensTotal,
    durationMs,
    status = "success",
    errorMessage,
    metadata,
    usageType = "free",
    cost,
    // Allow direct passing of context values (overrides global context)
    jobId,
    storyId,
    userId,
  } = logData;

  // Use passed values if provided, otherwise fall back to global context
  const effectiveJobId = jobId !== undefined ? jobId : currentContext.jobId;
  const effectiveStoryId =
    storyId !== undefined ? storyId : currentContext.storyId;
  const effectiveUserId = userId !== undefined ? userId : currentContext.userId;

  const effectiveUsageType =
    usageType === "included"
      ? "included"
      : currentContext.usageType === "included"
        ? "included"
        : "free";
  const effectiveCost =
    cost !== undefined && cost !== null
      ? cost
      : estimateCost(tokensTotal || 0, effectiveUsageType);

  try {
    const result = await query(
      `INSERT INTO prompt_logs 
       (provider, model, request_type, prompt_messages, prompt_text, response_text,
        tokens_input, tokens_output, tokens_total, duration_ms, status, error_message,
        job_id, story_id, user_id, metadata, usage_type, cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        provider,
        model,
        requestType,
        promptMessages ? JSON.stringify(promptMessages) : null,
        toNull(promptText),
        toNull(responseText),
        toNull(tokensInput),
        toNull(tokensOutput),
        toNull(tokensTotal),
        toNull(durationMs),
        status,
        toNull(errorMessage),
        toNull(effectiveJobId),
        toNull(effectiveStoryId),
        toNull(effectiveUserId),
        metadata ? JSON.stringify(metadata) : null,
        effectiveUsageType,
        effectiveCost,
      ],
    );

    logger.debug(`Prompt logged: ${provider}/${model} (${requestType})`);
    return result.insertId;
  } catch (error) {
    // Don't let logging failures break the main flow
    logger.warn(`Failed to log prompt: ${error.message}`);
    return null;
  }
}

/**
 * Gets prompt logs with optional filtering
 * @param {object} filters - Filter options
 * @returns {Promise<Array>} - Array of prompt logs
 */
export async function getPromptLogs(filters = {}) {
  const {
    provider,
    model,
    requestType,
    jobId,
    storyId,
    userId,
    status,
    limit = 100,
    offset = 0,
  } = filters;

  // Ensure limit and offset are integers for MySQL prepared statements
  const limitInt = parseInt(limit, 10) || 100;
  const offsetInt = parseInt(offset, 10) || 0;

  let sql = "SELECT * FROM prompt_logs WHERE 1=1";
  const params = [];

  if (provider) {
    sql += " AND provider = ?";
    params.push(provider);
  }
  if (model) {
    sql += " AND model = ?";
    params.push(model);
  }
  if (requestType) {
    sql += " AND request_type = ?";
    params.push(requestType);
  }
  if (jobId) {
    sql += " AND job_id = ?";
    params.push(jobId);
  }
  if (storyId && !isNaN(parseInt(storyId, 10))) {
    sql += " AND story_id = ?";
    params.push(parseInt(storyId, 10));
  }
  if (userId && !isNaN(parseInt(userId, 10))) {
    sql += " AND user_id = ?";
    params.push(parseInt(userId, 10));
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT " + limitInt + " OFFSET " + offsetInt;

  logger.debug(`Executing query: ${sql}`);
  logger.debug(`With params: ${JSON.stringify(params)}`);

  const logs = await query(sql, params);

  return logs.map((log) => {
    // Handle JSON fields - MySQL2 may auto-parse JSON columns
    let promptMessages = null;
    if (log.prompt_messages) {
      promptMessages =
        typeof log.prompt_messages === "string"
          ? JSON.parse(log.prompt_messages)
          : log.prompt_messages;
    }

    let metadata = null;
    if (log.metadata) {
      metadata =
        typeof log.metadata === "string"
          ? JSON.parse(log.metadata)
          : log.metadata;
    }

    return {
      id: log.id,
      provider: log.provider,
      model: log.model,
      requestType: log.request_type,
      promptMessages,
      promptText: log.prompt_text,
      responseText: log.response_text,
      tokensInput: log.tokens_input,
      tokensOutput: log.tokens_output,
      tokensTotal: log.tokens_total,
      durationMs: log.duration_ms,
      status: log.status,
      errorMessage: log.error_message,
      jobId: log.job_id,
      storyId: log.story_id,
      userId: log.user_id,
      metadata,
      createdAt: log.created_at,
    };
  });
}

/**
 * Gets prompt statistics
 * @param {object} filters - Filter options
 * @returns {Promise<object>} - Statistics object
 */
export async function getPromptStats(filters = {}) {
  const { startDate, endDate, provider } = filters;

  let sql = `
    SELECT 
      provider,
      model,
      request_type,
      COUNT(*) as total_requests,
      SUM(COALESCE(tokens_total, 0)) as total_tokens_total,
      AVG(COALESCE(duration_ms, 0)) as avg_duration_ms,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
    FROM prompt_logs
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
  if (provider) {
    sql += " AND provider = ?";
    params.push(provider);
  }

  sql += " GROUP BY provider, model, request_type";

  const stats = await query(sql, params);
  return stats;
}

/**
 * Get billing config (included limit, cycle day)
 * @returns {Promise<{ includedLimitUsd: number, cycleDayOfMonth: number }>}
 */
export async function getBillingConfig() {
  const rows = await query(
    "SELECT included_limit_usd, cycle_day_of_month FROM billing_config LIMIT 1"
  );
  if (!rows.length) {
    return { includedLimitUsd: 20, cycleDayOfMonth: 15 };
  }
  return {
    includedLimitUsd: parseFloat(rows[0].included_limit_usd) || 20,
    cycleDayOfMonth: parseInt(rows[0].cycle_day_of_month, 10) || 15,
  };
}

/**
 * Get start/end of current billing cycle (UTC date strings YYYY-MM-DD)
 * @param {number} cycleDayOfMonth - day of month (1-28)
 * @returns {{ start: string, end: string, resetDate: string }}
 */
export function getCurrentCycleBounds(cycleDayOfMonth = 15) {
  const now = new Date();
  const day = now.getUTCDate();
  let start = new Date(now);
  let end = new Date(now);

  if (day >= cycleDayOfMonth) {
    start.setUTCDate(cycleDayOfMonth);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(cycleDayOfMonth);
    end.setUTCHours(0, 0, 0, 0);
    end.setTime(end.getTime() - 1);
  } else {
    start.setUTCMonth(start.getUTCMonth() - 1);
    start.setUTCDate(cycleDayOfMonth);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(cycleDayOfMonth);
    end.setUTCHours(0, 0, 0, 0);
    end.setTime(end.getTime() - 1);
  }

  const resetDate = new Date(end);
  resetDate.setTime(resetDate.getTime() + 1);
  resetDate.setUTCDate(cycleDayOfMonth);

  const toYmd = (d) => d.toISOString().slice(0, 10);
  return {
    start: toYmd(start),
    end: toYmd(end),
    resetDate: toYmd(resetDate),
  };
}

/**
 * Get usage entries for billing dashboard (with user email)
 * @param {object} opts - { startDate, endDate, userId (optional; null = all for team) }
 * @returns {Promise<Array<{ date: string, userEmail: string, type: string, model: string, tokens: number, cost: number }>>}
 */
export async function getUsageForBilling(opts = {}) {
  const { startDate, endDate, userId } = opts;
  let sql = `
    SELECT pl.created_at, pl.usage_type, pl.model, pl.tokens_total, pl.cost, u.email
    FROM prompt_logs pl
    LEFT JOIN users u ON pl.user_id = u.id
    WHERE pl.status = 'success'
  `;
  const params = [];
  if (startDate) {
    sql += " AND pl.created_at >= ?";
    params.push(startDate + " 00:00:00");
  }
  if (endDate) {
    sql += " AND pl.created_at <= ?";
    params.push(endDate + " 23:59:59");
  }
  if (userId != null && !isNaN(parseInt(userId, 10))) {
    sql += " AND pl.user_id = ?";
    params.push(parseInt(userId, 10));
  }
  sql += " ORDER BY pl.created_at DESC LIMIT 5000";

  const rows = await query(sql, params);
  return rows.map((r) => ({
    date: r.created_at,
    userEmail: r.email || "—",
    type: r.usage_type === "included" ? "Included" : "Free",
    model: r.model || "—",
    tokens: r.tokens_total || 0,
    cost: parseFloat(r.cost) || 0,
  }));
}

/**
 * Get summed included usage (USD) for a user in a date range
 * @param {number} userId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<number>}
 */
export async function getIncludedUsageSum(userId, startDate, endDate) {
  let sql = `
    SELECT COALESCE(SUM(cost), 0) as total
    FROM prompt_logs
    WHERE user_id = ? AND usage_type = 'included' AND status = 'success'
  `;
  const params = [userId];
  if (startDate) {
    sql += " AND created_at >= ?";
    params.push(startDate + " 00:00:00");
  }
  if (endDate) {
    sql += " AND created_at <= ?";
    params.push(endDate + " 23:59:59");
  }
  const rows = await query(sql, params);
  return parseFloat(rows[0]?.total) || 0;
}

/**
 * Total tokens used by a user (lifetime). Used for free plan limit (1M once).
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getTotalTokensUsedByUser(userId) {
  const rows = await query(
    "SELECT COALESCE(SUM(tokens_total), 0) as total FROM prompt_logs WHERE user_id = ? AND status = 'success'",
    [userId]
  );
  return parseInt(rows[0]?.total, 10) || 0;
}

export default {
  setContext,
  clearContext,
  getContext,
  logPrompt,
  getPromptLogs,
  getPromptStats,
  getBillingConfig,
  getCurrentCycleBounds,
  getUsageForBilling,
  getIncludedUsageSum,
  getTotalTokensUsedByUser,
};
