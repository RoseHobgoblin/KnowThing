-- ============================================================================
-- Celestial-Calendar Integration
-- ============================================================================

-- Calendar links to a planet for derived physics
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS planet_id INT REFERENCES planetary_bodies(id) ON DELETE SET NULL;

-- Bodies have a position at epoch for orbital simulation
ALTER TABLE planetary_bodies ADD COLUMN IF NOT EXISTS epoch_phase DOUBLE PRECISION DEFAULT 0;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS epoch_phase DOUBLE PRECISION DEFAULT 0;
