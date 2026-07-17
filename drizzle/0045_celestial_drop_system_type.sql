-- ============================================================================
-- Drop celestial_bodies.system_type.
--
-- The system type (single/binary/trinary/multiple) is a name for the star
-- count, derived at read time by deriveSystemType — a stored copy was a second
-- source of truth that could drift (e.g. "trinary" on a two-star system).
-- Nothing reads the column any more; zero-star systems read as 'single'.
-- ============================================================================

ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS system_type;
