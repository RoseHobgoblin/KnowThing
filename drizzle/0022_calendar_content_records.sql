-- ============================================================================
-- Calendar Reform: slug + content record linkage
-- ============================================================================

-- Add slug column (nullable first for migration)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS content_record_id INT REFERENCES content_records(id) ON DELETE SET NULL;

-- Generate slugs from names
UPDATE calendars SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
-- Trim leading/trailing hyphens
UPDATE calendars SET slug = TRIM(BOTH '-' FROM slug) WHERE slug LIKE '-%' OR slug LIKE '%-';

-- Make NOT NULL after population
ALTER TABLE calendars ALTER COLUMN slug SET NOT NULL;

-- Create content records for existing calendars
INSERT INTO content_records (domain, slug, parent_path, title, content, plain_text, size_bytes)
SELECT 'calendar', c.slug, NULL, c.name, '', '', 0
FROM calendars c
WHERE c.content_record_id IS NULL
ON CONFLICT DO NOTHING;

-- Link them
UPDATE calendars c SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'calendar' AND cr.slug = c.slug AND c.content_record_id IS NULL;
