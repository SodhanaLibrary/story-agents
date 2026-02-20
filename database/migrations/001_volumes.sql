-- Volumes: collections of stories by an author
-- Run once: mysql -u user -p story_agents < database/migrations/001_volumes.sql
USE story_agents;

CREATE TABLE IF NOT EXISTS volumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- Add volume reference to stories (optional: story can belong to one volume)
ALTER TABLE stories ADD COLUMN volume_id INT NULL;
ALTER TABLE stories ADD COLUMN volume_sort_order INT DEFAULT 0;
ALTER TABLE stories ADD INDEX idx_volume_id (volume_id);
ALTER TABLE stories ADD CONSTRAINT fk_stories_volume FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL;
