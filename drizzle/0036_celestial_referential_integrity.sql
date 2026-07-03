-- ============================================================================
-- Celestial referential integrity.
--
-- planetary_bodies.parent_id (moon → planet) and stars.parent_star_id
-- (companion → primary) were plain integers with no foreign key, so deleting a
-- parent left dangling references that silently vanished from the system map and
-- broke merged validation on the orphaned rows.
--
-- This adds ON DELETE SET NULL foreign keys. Deleting a parent now demotes its
-- children (a moon becomes a direct planet, a companion becomes unparented)
-- rather than leaving them pointing at a row that no longer exists.
-- ============================================================================

-- 1. Null out any already-orphaned references so the constraints can be added.
UPDATE planetary_bodies
SET parent_id = NULL
WHERE parent_id IS NOT NULL
	AND parent_id NOT IN (SELECT id FROM planetary_bodies);

UPDATE stars
SET parent_star_id = NULL
WHERE parent_star_id IS NOT NULL
	AND parent_star_id NOT IN (SELECT id FROM stars);

-- 2. Add the foreign keys (idempotent — guarded on pg_constraint).
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planetary_bodies_parent_id_fk') THEN
		ALTER TABLE planetary_bodies
			ADD CONSTRAINT planetary_bodies_parent_id_fk
			FOREIGN KEY (parent_id) REFERENCES planetary_bodies(id) ON DELETE SET NULL;
	END IF;
END $$;

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stars_parent_star_id_fk') THEN
		ALTER TABLE stars
			ADD CONSTRAINT stars_parent_star_id_fk
			FOREIGN KEY (parent_star_id) REFERENCES stars(id) ON DELETE SET NULL;
	END IF;
END $$;

-- 3. Index the companion FK column (the moon FK column is already indexed).
CREATE INDEX IF NOT EXISTS idx_stars_parent_star ON stars(parent_star_id);
