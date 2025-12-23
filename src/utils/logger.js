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

