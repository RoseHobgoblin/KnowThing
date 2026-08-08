-- "Albedo" is not one interchangeable scalar: Bond, geometric, spherical,
-- spectral, and mapped reflectance products have different meanings. The old
-- text column encoded none of those distinctions, so discard it rather than
-- pretending arbitrary prose is a physical measurement.
ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS albedo;
