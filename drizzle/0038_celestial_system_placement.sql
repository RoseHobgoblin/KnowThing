-- ============================================================================
-- Star-system placement & metadata.
--
-- A star system is more than the sum of its stars: it sits somewhere in the
-- setting, formed at some epoch, and carries alternate designations. None of
-- these are derivable from the child stars/bodies, so they become first-class
-- columns (unlike system_type, which is just a name for the star count and is
-- now derived at read time).
--
-- Coordinates are nullable/future-facing (data entry ahead of a galaxy map);
-- distance / age / designations have immediate display value.
-- ============================================================================

ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS distance_ly   double precision;
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS galactic_x    double precision;
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS galactic_y    double precision;
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS galactic_z    double precision;
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS formation_age text;
ALTER TABLE star_systems ADD COLUMN IF NOT EXISTS designations  text;
