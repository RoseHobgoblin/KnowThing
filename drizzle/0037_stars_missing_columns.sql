-- ============================================================================
-- Backfill stars columns missing from the incremental migration chain.
--
-- These columns exist in schema.ts (and in production, which acquired them
-- out-of-band) but were never added to `stars` by any hand-written migration
-- in the 0001->0036 chain — they only appeared in the stray 0000 drizzle-kit
-- snapshot, which fresh databases skip. Without them, every stars query fails
-- (e.g. GET /Celestial:the-sun -> 500).
--
-- IF NOT EXISTS makes this a no-op on databases that already have the columns.
-- ============================================================================

ALTER TABLE stars ADD COLUMN IF NOT EXISTS luminosity_w        double precision;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS temperature_k       double precision;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS rotation_period_s   double precision;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS axial_tilt          double precision;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS orbital_period_days double precision;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS absolute_magnitude  text;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS metallicity         text;
