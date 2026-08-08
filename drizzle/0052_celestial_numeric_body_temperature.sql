-- Body and star temperatures now share temperature_k. The application is not
-- live, so ambiguous legacy prose is intentionally discarded rather than parsed.
ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS temperature;

ALTER TABLE celestial_bodies DROP CONSTRAINT IF EXISTS celestial_temperature_k_positive;
ALTER TABLE celestial_bodies
	ADD CONSTRAINT celestial_temperature_k_positive
	CHECK (temperature_k IS NULL OR temperature_k > 0);
