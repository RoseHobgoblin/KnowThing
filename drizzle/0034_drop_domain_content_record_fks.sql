-- ============================================================================
-- Drop the redundant content_record_id FK columns from domain tables.
--
-- (domain, slug) on content_records is now globally unique (see 0033) and is
-- the canonical lookup key. Articles for a domain row are loaded by
-- (domain, slug) and lazily created on first read.
--
-- Domain tables affected: star_systems, stars, planetary_bodies, calendars,
-- world_maps, countries.
-- ============================================================================

ALTER TABLE star_systems DROP COLUMN IF EXISTS content_record_id;
ALTER TABLE stars DROP COLUMN IF EXISTS content_record_id;
ALTER TABLE planetary_bodies DROP COLUMN IF EXISTS content_record_id;
ALTER TABLE calendars DROP COLUMN IF EXISTS content_record_id;
ALTER TABLE world_maps DROP COLUMN IF EXISTS content_record_id;
ALTER TABLE countries DROP COLUMN IF EXISTS content_record_id;
