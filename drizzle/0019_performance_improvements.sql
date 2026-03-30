-- Functional index for backlinks query (filters on LOWER(target_slug))
CREATE INDEX IF NOT EXISTS idx_clinks_target_slug_lower ON content_links (LOWER(target_slug));

-- Index for media usage count lookups (content_media_usage PK is (content_record_id, filename),
-- so filename-only lookups can't use it)
CREATE INDEX IF NOT EXISTS idx_cmu_filename ON content_media_usage (filename);

-- Drop deprecated column (calendar date is now computed from epoch_offset)
ALTER TABLE calendars DROP COLUMN IF EXISTS calendar_date;
