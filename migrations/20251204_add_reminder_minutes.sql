-- Add reminder_minutes to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER;
