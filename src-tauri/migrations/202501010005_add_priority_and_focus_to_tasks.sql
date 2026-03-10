-- Add priority and is_focus columns to tasks table
-- Note: priority already exists but may have different default, ensure it's 'normal'
-- is_focus is new

-- First, ensure priority column exists and has correct default
-- If it doesn't exist, add it; if it exists, update default if needed
-- SQLite doesn't support ALTER COLUMN, so we handle this carefully

-- Add is_focus column if it doesn't exist
ALTER TABLE tasks ADD COLUMN is_focus BOOLEAN NOT NULL DEFAULT 0;

-- Update existing priority values: 'medium' -> 'normal' for consistency
UPDATE tasks SET priority = 'normal' WHERE priority = 'medium' OR priority IS NULL;

-- Ensure priority has default 'normal' (SQLite limitation: can't change default of existing column)
-- New inserts will use the default from application code

