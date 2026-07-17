-- ============================================================================
-- Drop celestial_bodies.companion.
--
-- The field was a hand-typed display name for a star's binary partner — a
-- denormalized copy of a fact the orbital graph already carries. Companions
-- are now derived at read time (child stars orbiting this one, barycenter
-- co-components, and the companionOf parent edge) and render as real links.
-- Lore-only companions with no catalogued record belong in the `extra`
-- overflow (key: companion), which still overrides the derived value.
-- ============================================================================

ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS companion;
