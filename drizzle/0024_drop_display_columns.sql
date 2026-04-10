-- Drop display-string columns that are always derived from numeric values.
-- These are now computed at read time in structured-data.ts.

ALTER TABLE stars
  DROP COLUMN IF EXISTS mass,
  DROP COLUMN IF EXISTS radius,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS luminosity,
  DROP COLUMN IF EXISTS density,
  DROP COLUMN IF EXISTS surface_gravity,
  DROP COLUMN IF EXISTS escape_velocity,
  DROP COLUMN IF EXISTS orbital_period,
  DROP COLUMN IF EXISTS semi_major_axis,
  DROP COLUMN IF EXISTS rotation_period,
  DROP COLUMN IF EXISTS periastron,
  DROP COLUMN IF EXISTS apastron;

ALTER TABLE planetary_bodies
  DROP COLUMN IF EXISTS mass,
  DROP COLUMN IF EXISTS radius,
  DROP COLUMN IF EXISTS density,
  DROP COLUMN IF EXISTS surface_gravity,
  DROP COLUMN IF EXISTS escape_velocity,
  DROP COLUMN IF EXISTS orbital_period,
  DROP COLUMN IF EXISTS semi_major_axis,
  DROP COLUMN IF EXISTS rotation_period;
