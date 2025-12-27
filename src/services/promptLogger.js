/**
 * Prompt Logger Service - Logs all AI prompts to the database for tracing
 */
import { query } from "./database.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("PromptLogger");

// Context for associating prompts with jobs/stories
let currentContext = {
  jobId: null,
  storyId: null,
  userId: null,
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
  currentContext = { jobId: null, storyId: null, userId: null };
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

  try {
    const result = await query(
      `INSERT INTO prompt_logs 
       (provider, model, request_type, prompt_messages, prompt_text, response_text,
        tokens_input, tokens_output, tokens_total, duration_ms, status, error_message,
        job_id, story_id, user_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
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

export default {
  setContext,
  clearContext,
  getContext,
  logPrompt,
  getPromptLogs,
  getPromptStats,
};
