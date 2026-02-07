-- Story Agents MySQL Database Schema
-- Run this file to set up the database structure

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS story_agents
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE story_agents;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stories table
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
  status ENUM('draft', 'completed') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Characters table
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
);

-- Pages table
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
);

-- Drafts table (for in-progress stories)
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
  current_step INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_job_id (job_id)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Story-Tags junction table
CREATE TABLE IF NOT EXISTS story_tags (
  story_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (story_id, tag_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- User favorites table
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
);

-- User reading history table
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
);

-- Add is_public flag to stories (default public for guest access)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE stories ADD INDEX IF NOT EXISTS idx_is_public (is_public);

-- User followers table
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
);

-- Add bio and public profile fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- Prompt logs table for AI tracing
CREATE TABLE IF NOT EXISTS prompt_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider ENUM('openai', 'gemini') NOT NULL,
  model VARCHAR(100) NOT NULL,
  request_type ENUM('completion', 'json', 'vision', 'image') NOT NULL,
  prompt_messages LONGTEXT,
  prompt_text TEXT,
  response_text LONGTEXT,
  tokens_input INT,
  tokens_output INT,
  tokens_total INT,
  duration_ms INT,
  status ENUM('success', 'error') DEFAULT 'success',
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
  INDEX idx_story_id (story_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Batch requests table for illustration generation
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
);

