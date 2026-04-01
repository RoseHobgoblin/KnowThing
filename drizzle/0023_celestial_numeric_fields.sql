-- Add numeric mass (kg) and radius (m) columns to stars and planetary_bodies
-- to enable auto-computation of derived physical properties.

ALTER TABLE stars
  ADD COLUMN IF NOT EXISTS mass_kg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_m DOUBLE PRECISION;

ALTER TABLE planetary_bodies
  ADD COLUMN IF NOT EXISTS mass_kg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_m DOUBLE PRECISION;
