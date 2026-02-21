import mysql from "mysql2/promise";
import config from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Database");

let pool = null;

/**
 * Get or create MySQL connection pool
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    logger.info(
      `MySQL pool created for ${config.database.host}:${config.database.port}`
    );
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Execute a query and return inserted ID
 */
export async function insert(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

/**
 * Initialize database schema
 */
export async function initializeDatabase() {
  const pool = getPool();
  logger.info("Initializing database schema...");

  // Users table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      google_id VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      picture TEXT,
      role ENUM('user', 'premium-user', 'admin', 'super-admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_role (role)
    )
  `);

  // Migration: Add role column to existing users table
  try {
    await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role ENUM('user', 'premium-user', 'admin', 'super-admin') DEFAULT 'user'
    `);
  } catch (err) {
    // Column might already exist or syntax not supported, try alternative
    if (!err.message.includes('Duplicate column')) {
      try {
        // Check if column exists
        const [columns] = await pool.execute(`SHOW COLUMNS FROM users LIKE 'role'`);
        if (columns.length === 0) {
          await pool.execute(`
            ALTER TABLE users 
            ADD COLUMN role ENUM('user', 'premium-user', 'admin', 'super-admin') DEFAULT 'user'
          `);
        }
      } catch (innerErr) {
        console.log("Role column migration:", innerErr.message);
      }
    }
  }

  // Stories table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS stories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      title VARCHAR(500) NOT NULL,
      summary TEXT,
      original_story LONGTEXT,
      art_style_key VARCHAR(100),
      art_style_prompt TEXT,
      art_style_reasoning TEXT,
      cover_url VARCHAR(500),
      cover_path VARCHAR(500),
      page_count INT DEFAULT 0,
      target_audience VARCHAR(100) DEFAULT 'children',
      genre VARCHAR(100) NULL,
      status ENUM('draft', 'completed') DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    )
  `);
  try {
    await pool.execute("ALTER TABLE stories ADD COLUMN genre VARCHAR(100) NULL AFTER target_audience");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  // Characters table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      story_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      role ENUM('main', 'supporting', 'minor') DEFAULT 'supporting',
      description TEXT,
      avatar_prompt TEXT,
      avatar_url VARCHAR(500),
      avatar_path VARCHAR(500),
      custom_description TEXT,
      has_reference_image BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      INDEX idx_story_id (story_id)
    )
  `);

  // Pages table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      story_id INT NOT NULL,
      page_number INT NOT NULL,
      text LONGTEXT,
      image_description TEXT,
      characters_in_scene JSON,
      illustration_url VARCHAR(500),
      illustration_path VARCHAR(500),
      custom_description TEXT,
      regenerated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      INDEX idx_story_id (story_id),
      UNIQUE KEY unique_story_page (story_id, page_number)
    )
  `);

  // Drafts table (for in-progress stories)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id VARCHAR(100) UNIQUE NOT NULL,
      user_id INT,
      story_text LONGTEXT,
      status VARCHAR(100),
      phase VARCHAR(100),
      progress INT DEFAULT 0,
      message TEXT,
      art_style_key VARCHAR(100),
      art_style_prompt TEXT,
      art_style_decision JSON,
      characters JSON,
      story_pages JSON,
      cover JSON,
      page_count INT DEFAULT 6,
      target_audience VARCHAR(100) DEFAULT 'children',
      genre VARCHAR(100) NULL,
      current_step INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_job_id (job_id)
    )
  `);
  try {
    await pool.execute("ALTER TABLE drafts ADD COLUMN genre VARCHAR(100) NULL AFTER target_audience");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  // Volumes table (collections of stories by author)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS volumes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id)
    )
  `);
  try {
    await pool.execute("ALTER TABLE stories ADD COLUMN volume_id INT NULL");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
  try {
    await pool.execute("ALTER TABLE stories ADD COLUMN volume_sort_order INT DEFAULT 0");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
  try {
    await pool.execute("ALTER TABLE stories ADD INDEX idx_volume_id (volume_id)");
  } catch (e) {
    if (e.code !== "ER_DUP_KEYNAME" && e.code !== "ER_DUP_INDEX") throw e;
  }
  try {
    await pool.execute("ALTER TABLE stories ADD CONSTRAINT fk_stories_volume FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL");
  } catch (e) {
    if (e.code !== "ER_DUP_KEYNAME" && e.code !== "ER_FK_DUP_NAME") throw e;
  }

  // Tags table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      color VARCHAR(20) DEFAULT '#6366f1',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    )
  `);

  // Story-Tags junction table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS story_tags (
      story_id INT NOT NULL,
      tag_id INT NOT NULL,
      PRIMARY KEY (story_id, tag_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // User favorites table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      story_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_story_favorite (user_id, story_id),
      INDEX idx_user_id (user_id),
      INDEX idx_story_id (story_id)
    )
  `);

  // User reading history table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_reading_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      story_id INT NOT NULL,
      current_page INT DEFAULT 1,
      total_pages INT DEFAULT 1,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_story_reading (user_id, story_id),
      INDEX idx_user_id (user_id),
      INDEX idx_last_read (last_read_at)
    )
  `);

  // Add is_public column to stories if not exists
  try {
    await pool.execute(
      `ALTER TABLE stories ADD COLUMN is_public BOOLEAN DEFAULT TRUE`
    );
  } catch (e) {
    // Column may already exist
  }

  // User followers table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_followers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      follower_id INT NOT NULL,
      following_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_follow (follower_id, following_id),
      INDEX idx_follower_id (follower_id),
      INDEX idx_following_id (following_id)
    )
  `);

  // Add profile fields to users if not exist
  try {
    await pool.execute(`ALTER TABLE users ADD COLUMN bio TEXT`);
  } catch (e) {
    /* Column may already exist */
  }
  try {
    await pool.execute(
      `ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT TRUE`
    );
  } catch (e) {
    /* Column may already exist */
  }
  try {
    await pool.execute(
      `ALTER TABLE users ADD COLUMN username VARCHAR(100) UNIQUE`
    );
  } catch (e) {
    /* Column may already exist */
  }

  // Prompt logs table for AI tracing
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS prompt_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider ENUM('openai', 'gemini') NOT NULL,
      model VARCHAR(100) NOT NULL,
      request_type ENUM('completion', 'json', 'vision', 'image', 'image_edit', 'image_generate_ref', 'image_generate_ref_pre') NOT NULL,
      prompt_messages LONGTEXT,
      prompt_text TEXT,
      response_text LONGTEXT,
      tokens_input INT,
      tokens_output INT,
      tokens_total INT,
      duration_ms INT,
      status ENUM('success', 'error', 'initiated') DEFAULT 'success',
      error_message TEXT,
      job_id VARCHAR(100),
      story_id INT,
      user_id INT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_provider (provider),
      INDEX idx_model (model),
      INDEX idx_request_type (request_type),
      INDEX idx_job_id (job_id),
      INDEX idx_created_at (created_at),
      INDEX idx_status (status)
    )
  `);

  // Migrate existing prompt_logs table to support new request_type and status values
  try {
    await pool.execute(`
      ALTER TABLE prompt_logs 
      MODIFY COLUMN request_type ENUM('completion', 'json', 'vision', 'image', 'image_edit', 'image_generate_ref', 'image_generate_ref_pre') NOT NULL
    `);
    logger.debug("prompt_logs request_type column updated");
  } catch (err) {
    // Ignore if column is already correct
    if (!err.message.includes("Duplicate")) {
      logger.debug("prompt_logs request_type migration skipped: " + err.message);
    }
  }
  
  try {
    await pool.execute(`
      ALTER TABLE prompt_logs 
      MODIFY COLUMN status ENUM('success', 'error', 'initiated') DEFAULT 'success'
    `);
    logger.debug("prompt_logs status column updated");
  } catch (err) {
    if (!err.message.includes("Duplicate")) {
      logger.debug("prompt_logs status migration skipped: " + err.message);
    }
  }

  // Billing: usage_type and cost on prompt_logs
  try {
    await pool.execute(`
      ALTER TABLE prompt_logs
      ADD COLUMN usage_type ENUM('free', 'included') DEFAULT 'free',
      ADD COLUMN cost DECIMAL(10, 4) NULL
    `);
    logger.debug("prompt_logs usage_type and cost columns added");
  } catch (err) {
    if (!err.message.includes("Duplicate column")) {
      logger.debug("prompt_logs billing migration: " + err.message);
    }
  }
  try {
    await pool.execute(`CREATE INDEX idx_user_id ON prompt_logs (user_id)`);
    logger.debug("prompt_logs idx_user_id added");
  } catch (err) {
    if (!err.message.includes("Duplicate")) {
      logger.debug("prompt_logs idx_user_id: " + err.message);
    }
  }

  // User plan: free (1M tokens once) | pro ($19/month)
  try {
    await pool.execute(`
      ALTER TABLE users ADD COLUMN plan ENUM('free', 'pro') DEFAULT 'free'
    `);
    logger.debug("users.plan column added");
  } catch (err) {
    if (!err.message.includes("Duplicate column")) {
      logger.debug("users.plan migration: " + err.message);
    }
  }

  // Email/password auth columns
  const emailAuthColumns = [
    { name: "password_hash", sql: "ADD COLUMN password_hash VARCHAR(255) NULL" },
    { name: "email_verified", sql: "ADD COLUMN email_verified TINYINT(1) DEFAULT 0" },
    { name: "email_verification_token", sql: "ADD COLUMN email_verification_token VARCHAR(255) NULL" },
    { name: "email_verification_expires", sql: "ADD COLUMN email_verification_expires DATETIME NULL" },
    { name: "password_reset_token", sql: "ADD COLUMN password_reset_token VARCHAR(255) NULL" },
    { name: "password_reset_expires", sql: "ADD COLUMN password_reset_expires DATETIME NULL" },
  ];
  for (const col of emailAuthColumns) {
    try {
      const [cols] = await pool.execute(`SHOW COLUMNS FROM users LIKE '${col.name}'`);
      if (cols.length === 0) {
        await pool.execute(`ALTER TABLE users ${col.sql}`);
        logger.debug("users." + col.name + " added");
      }
    } catch (err) {
      if (!err.message.includes("Duplicate")) logger.debug("users." + col.name + " migration: " + err.message);
    }
  }

  // Razorpay payments (for audit; payouts go to bank linked in Razorpay dashboard)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      razorpay_order_id VARCHAR(100) NOT NULL,
      razorpay_payment_id VARCHAR(100),
      amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status ENUM('created', 'captured', 'failed') DEFAULT 'created',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_razorpay_order (razorpay_order_id)
    )
  `);

  // Organizations (for team plan): user creates org and adds members
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      owner_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_owner_id (owner_id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_org_user (org_id, user_id),
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_org_id (org_id),
      INDEX idx_user_id (user_id)
    )
  `);

  // Open story submissions: any user can submit; all can vote; premium can generate illustrations
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS open_story_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      story_text LONGTEXT NOT NULL,
      genre VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    )
  `);
  // Add genre column for existing databases
  try {
    await pool.execute(
      "ALTER TABLE open_story_submissions ADD COLUMN genre VARCHAR(100) NULL AFTER story_text"
    );
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS open_story_votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submission_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_submission_user (submission_id, user_id),
      FOREIGN KEY (submission_id) REFERENCES open_story_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_submission_id (submission_id),
      INDEX idx_user_id (user_id)
    )
  `);

  // P2P messages between users
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      recipient_id INT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_sender (sender_id),
      INDEX idx_recipient (recipient_id),
      INDEX idx_created_at (created_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS open_story_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submission_id INT NOT NULL,
      user_id INT NOT NULL,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES open_story_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_submission_id (submission_id),
      INDEX idx_created_at (created_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS open_story_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submission_id INT NOT NULL,
      image_url VARCHAR(1000) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES open_story_submissions(id) ON DELETE CASCADE,
      INDEX idx_submission_id (submission_id)
    )
  `);

  // Billing config: premium included allowance and cycle
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS billing_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      included_limit_usd DECIMAL(10, 2) NOT NULL DEFAULT 20.00,
      cycle_day_of_month INT NOT NULL DEFAULT 15,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  try {
    const [rows] = await pool.execute("SELECT 1 FROM billing_config LIMIT 1");
    if (rows.length === 0) {
      await pool.execute(
        "INSERT INTO billing_config (included_limit_usd, cycle_day_of_month) VALUES (20.00, 15)"
      );
    }
  } catch (e) {
    /* ignore */
  }

  // Batch requests table for illustration generation
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS batch_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      job_id VARCHAR(100) NOT NULL,
      story_title VARCHAR(500),
      total_pages INT DEFAULT 0,
      completed_pages INT DEFAULT 0,
      status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      error_message TEXT,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_job_id (job_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    )
  `);

  // User avatars table for reusable character avatars
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_avatars (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      avatar_url VARCHAR(500),
      avatar_path VARCHAR(500),
      avatar_prompt TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_name (name)
    )
  `);

  // Application logs table for server logs
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS app_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      level ENUM('debug', 'info', 'warn', 'error', 'success') NOT NULL,
      context VARCHAR(100),
      message TEXT NOT NULL,
      details LONGTEXT,
      job_id VARCHAR(100),
      user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_level (level),
      INDEX idx_context (context),
      INDEX idx_created_at (created_at),
      INDEX idx_job_id (job_id)
    )
  `);

  logger.success("Database schema initialized");
}

/**
 * Close the pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("MySQL pool closed");
  }
}

export default {
  getPool,
  query,
  insert,
  initializeDatabase,
  closePool,
};
