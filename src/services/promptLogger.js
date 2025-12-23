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
  } = logData;

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
        toNull(currentContext.jobId),
        toNull(currentContext.storyId),
        toNull(currentContext.userId),
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
  if (storyId) {
    sql += " AND story_id = ?";
    params.push(storyId);
  }
  if (userId) {
    sql += " AND user_id = ?";
    params.push(userId);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const logs = await query(sql, params);

  return logs.map((log) => ({
    id: log.id,
    provider: log.provider,
    model: log.model,
    requestType: log.request_type,
    promptMessages: log.prompt_messages
      ? JSON.parse(log.prompt_messages)
      : null,
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
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    createdAt: log.created_at,
  }));
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
      COUNT(*) as count,
      SUM(tokens_total) as total_tokens,
      AVG(duration_ms) as avg_duration,
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
