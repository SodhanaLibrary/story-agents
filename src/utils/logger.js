import chalk from "chalk";

/**
 * Log levels with priorities
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// Database logging configuration
let dbLoggingEnabled = false;
let dbPool = null;
let logContext = { jobId: null, userId: null };

/**
 * Enable database logging
 * @param {object} pool - MySQL connection pool
 */
export function enableDbLogging(pool) {
  dbPool = pool;
  dbLoggingEnabled = true;
}

/**
 * Disable database logging
 */
export function disableDbLogging() {
  dbLoggingEnabled = false;
}

/**
 * Set logging context (jobId, userId)
 */
export function setLogContext(context) {
  logContext = { ...logContext, ...context };
}

/**
 * Clear logging context
 */
export function clearLogContext() {
  logContext = { jobId: null, userId: null };
}

/**
 * Save log to database (async, non-blocking)
 */
async function saveLogToDb(level, context, message, details = null) {
  if (!dbLoggingEnabled || !dbPool) return;
  
  // Skip debug logs in database to avoid noise (configurable)
  const dbLogLevel = process.env.DB_LOG_LEVEL?.toLowerCase() || "info";
  if (LOG_LEVELS[level] < LOG_LEVELS[dbLogLevel]) return;
  
  try {
    const detailsStr = details ? 
      (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    
    await dbPool.execute(
      `INSERT INTO app_logs (level, context, message, details, job_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        level,
        context || null,
        String(message).substring(0, 65535), // Limit message length
        detailsStr ? detailsStr.substring(0, 16777215) : null, // LONGTEXT limit
        logContext.jobId || null,
        logContext.userId || null,
      ]
    );
  } catch (err) {
    // Don't let DB errors break logging
    console.error("Failed to save log to DB:", err.message);
  }
}

/**
 * Get current log level from environment
 */
function getCurrentLevel() {
  const level = process.env.LOG_LEVEL?.toLowerCase() || "info";
  return LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

/**
 * Format timestamp for logs
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with optional context
 */
function formatMessage(level, context, message, ...args) {
  const timestamp = chalk.gray(formatTimestamp());
  const contextStr = context ? chalk.cyan(`[${context}]`) : "";

  let levelStr;
  switch (level) {
    case "debug":
      levelStr = chalk.magenta("DEBUG");
      break;
    case "info":
      levelStr = chalk.blue("INFO ");
      break;
    case "warn":
      levelStr = chalk.yellow("WARN ");
      break;
    case "error":
      levelStr = chalk.red("ERROR");
      break;
    default:
      levelStr = chalk.white(level.toUpperCase().padEnd(5));
  }

  return { timestamp, levelStr, contextStr, message, args };
}

/**
 * Core log function
 */
function log(level, context, message, ...args) {
  const currentLevel = getCurrentLevel();
  if (LOG_LEVELS[level] < currentLevel) return;

  const { timestamp, levelStr, contextStr, message: msg, args: extraArgs } = 
    formatMessage(level, context, message, ...args);

  const prefix = `${timestamp} ${levelStr}${contextStr ? ` ${contextStr}` : ""}`;

  if (level === "error") {
    console.error(prefix, msg, ...extraArgs);
  } else if (level === "warn") {
    console.warn(prefix, msg, ...extraArgs);
  } else {
    console.log(prefix, msg, ...extraArgs);
  }
  
  // Save to database (async, non-blocking)
  const details = extraArgs.length > 0 ? extraArgs : null;
  saveLogToDb(level, context, msg, details);
}

/**
 * Create a logger instance with optional context
 * @param {string} context - Module/component name for log prefix
 * @returns {Object} Logger instance with debug, info, warn, error methods
 */
export function createLogger(context = "") {
  return {
    debug: (message, ...args) => log("debug", context, message, ...args),
    info: (message, ...args) => log("info", context, message, ...args),
    warn: (message, ...args) => log("warn", context, message, ...args),
    error: (message, ...args) => log("error", context, message, ...args),

    /**
     * Log with custom styling for important events
     */
    success: (message, ...args) => {
      const currentLevel = getCurrentLevel();
      if (LOG_LEVELS.info < currentLevel) return;

      const timestamp = chalk.gray(formatTimestamp());
      const levelStr = chalk.green("✓ OK ");
      const contextStr = context ? chalk.cyan(`[${context}]`) : "";
      console.log(`${timestamp} ${levelStr}${contextStr ? ` ${contextStr}` : ""}`, message, ...args);
      
      // Save to database
      const details = args.length > 0 ? args : null;
      saveLogToDb("success", context, message, details);
    },

    /**
     * Log step progress
     */
    step: (stepNumber, total, message) => {
      const currentLevel = getCurrentLevel();
      if (LOG_LEVELS.info < currentLevel) return;

      const timestamp = chalk.gray(formatTimestamp());
      const progress = chalk.yellow(`[${stepNumber}/${total}]`);
      const contextStr = context ? chalk.cyan(`[${context}]`) : "";
      console.log(`${timestamp} ${progress}${contextStr ? ` ${contextStr}` : ""}`, message);
    },

    /**
     * Log a section header
     */
    section: (title) => {
      const currentLevel = getCurrentLevel();
      if (LOG_LEVELS.info < currentLevel) return;

      console.log("");
      console.log(chalk.bold.cyan(`═══ ${title} ═══`));
    },

    /**
     * Log object as formatted JSON
     */
    json: (label, obj) => {
      const currentLevel = getCurrentLevel();
      if (LOG_LEVELS.debug < currentLevel) return;

      const timestamp = chalk.gray(formatTimestamp());
      const contextStr = context ? chalk.cyan(`[${context}]`) : "";
      console.log(`${timestamp} ${chalk.magenta("DEBUG")}${contextStr ? ` ${contextStr}` : ""}`, label);
      console.log(chalk.gray(JSON.stringify(obj, null, 2)));
    },

    /**
     * Create a child logger with additional context
     */
    child: (childContext) => {
      const fullContext = context ? `${context}:${childContext}` : childContext;
      return createLogger(fullContext);
    },

    /**
     * Log AI prompts for debugging
     */
    prompt: (label, prompt, options = {}) => {
      const currentLevel = getCurrentLevel();
      if (LOG_LEVELS.debug < currentLevel) return;

      const timestamp = chalk.gray(formatTimestamp());
      const levelStr = chalk.magentaBright("PROMPT");
      const contextStr = context ? chalk.cyan(`[${context}]`) : "";
      const labelStr = chalk.yellow(label);

      console.log(`${timestamp} ${levelStr}${contextStr ? ` ${contextStr}` : ""} ${labelStr}`);
      console.log(chalk.gray("─".repeat(60)));

      // Handle different prompt formats
      if (typeof prompt === "string") {
        // Single string prompt
        console.log(chalk.white(prompt));
      } else if (Array.isArray(prompt)) {
        // Array of messages (chat format)
        prompt.forEach((msg, idx) => {
          const role = msg.role?.toUpperCase() || "MESSAGE";
          const roleColor = role === "SYSTEM" ? chalk.blue : role === "USER" ? chalk.green : chalk.yellow;
          console.log(roleColor(`[${role}]`));
          
          if (typeof msg.content === "string") {
            console.log(chalk.white(msg.content));
          } else if (Array.isArray(msg.content)) {
            // Multimodal content (text + images)
            msg.content.forEach((part) => {
              if (part.type === "text") {
                console.log(chalk.white(part.text));
              } else if (part.type === "image_url") {
                console.log(chalk.gray("[Image attached]"));
              }
            });
          }
          if (idx < prompt.length - 1) console.log("");
        });
      } else if (typeof prompt === "object") {
        // Object prompt
        console.log(chalk.white(JSON.stringify(prompt, null, 2)));
      }

      console.log(chalk.gray("─".repeat(60)));

      // Log additional options if provided
      if (options && Object.keys(options).length > 0) {
        console.log(chalk.gray(`Options: ${JSON.stringify(options)}`));
      }
    },
  };
}

/**
 * Default logger without context
 */
export const logger = createLogger();

/**
 * Request logger middleware for Express
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const reqLogger = createLogger("HTTP");

  // Log request
  reqLogger.info(`${chalk.bold(req.method)} ${req.path}`);

  // Log response on finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 500 ? chalk.red : status >= 400 ? chalk.yellow : chalk.green;
    
    reqLogger.info(
      `${chalk.bold(req.method)} ${req.path} ${statusColor(status)} ${chalk.gray(`${duration}ms`)}`
    );
  });

  next();
}

export default logger;

