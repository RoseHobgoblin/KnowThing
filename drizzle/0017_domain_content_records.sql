-- ============================================================================
-- Phase 4: Link domain tables to content_records
-- ============================================================================

-- Add content_record_id to domain tables
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS content_record_id INT REFERENCES content_records(id) ON DELETE SET NULL;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS content_record_id INT REFERENCES content_records(id) ON DELETE SET NULL;
ALTER TABLE planetary_bodies ADD COLUMN IF NOT EXISTS content_record_id INT REFERENCES content_records(id) ON DELETE SET NULL;

-- Migrate celestial wiki pages: change domain from 'know' to 'celestial'
-- Star systems
UPDATE content_records
SET domain = 'celestial', parent_path = NULL
WHERE domain = 'know' AND slug IN (
    SELECT page_slug FROM star_systems WHERE page_slug IS NOT NULL
);

-- Stars: set parent_path to their system's slug
UPDATE content_records cr
SET domain = 'celestial',
    parent_path = (
        SELECT ss.slug FROM stars s
        JOIN star_systems ss ON ss.id = s.system_id
        WHERE s.page_slug = cr.slug
        LIMIT 1
    )
WHERE domain = 'know' AND slug IN (
    SELECT page_slug FROM stars WHERE page_slug IS NOT NULL
);

-- Planetary bodies: set parent_path to their star's system slug
UPDATE content_records cr
SET domain = 'celestial',
    parent_path = (
        SELECT ss.slug FROM planetary_bodies pb
        JOIN stars s ON s.id = pb.star_id
        JOIN star_systems ss ON ss.id = s.system_id
        WHERE pb.page_slug = cr.slug
        LIMIT 1
    )
WHERE domain = 'know' AND slug IN (
    SELECT page_slug FROM planetary_bodies WHERE page_slug IS NOT NULL
);

-- Link domain table rows to their content records
UPDATE star_systems ss
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = ss.page_slug;

UPDATE stars s
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = s.page_slug;

UPDATE planetary_bodies pb
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = pb.page_slug;

-- Create content records for celestial entities that don't have wiki pages yet
-- Star systems without content
INSERT INTO content_records (domain, slug, parent_path, title, content, plain_text, size_bytes)
SELECT 'celestial', ss.slug, NULL, ss.name, ss.description, ss.description, LENGTH(COALESCE(ss.description, ''))
FROM star_systems ss
WHERE ss.content_record_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE star_systems ss
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = ss.slug AND cr.parent_path IS NULL AND ss.content_record_id IS NULL;

-- Stars without content
INSERT INTO content_records (domain, slug, parent_path, title, content, plain_text, size_bytes)
SELECT 'celestial', s.slug,
    (SELECT ss.slug FROM star_systems ss WHERE ss.id = s.system_id),
    s.name, '', '', 0
FROM stars s
WHERE s.content_record_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE stars s
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = s.slug AND s.content_record_id IS NULL;

-- Planetary bodies without content
INSERT INTO content_records (domain, slug, parent_path, title, content, plain_text, size_bytes)
SELECT 'celestial', pb.slug,
    (SELECT ss.slug FROM stars st JOIN star_systems ss ON ss.id = st.system_id WHERE st.id = pb.star_id),
    pb.name, '', '', 0
FROM planetary_bodies pb
WHERE pb.content_record_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE planetary_bodies pb
SET content_record_id = cr.id
FROM content_records cr
WHERE cr.domain = 'celestial' AND cr.slug = pb.slug AND pb.content_record_id IS NULL;

-- Verify
SELECT domain, COUNT(*) FROM content_records GROUP BY domain ORDER BY domain;
