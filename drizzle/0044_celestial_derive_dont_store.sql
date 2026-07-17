-- ============================================================================
-- Derive-don't-store cleanup for celestial_bodies.
--
-- The service no longer persists derivable values (Kepler orbital periods,
-- Stefan-Boltzmann luminosity, auto-counted satellites) — the model layer
-- derives them at read time from the stored primaries. This migration nulls
-- out stored values that match their own derivation, so legacy rows go
-- live-derived too (a later mass edit now updates their periods).
--
-- Values that DON'T match the derivation are kept: they are user assertions
-- (or real-world preset data) and must survive as explicit overrides.
--
-- The whole file runs as one sql.unsafe() call => one implicit transaction.
-- Constants match src/lib/celestial/compute.ts:
--   G = 6.67430e-11, AU = 1.495978707e11 m, sigma = 5.670374419e-8
-- ============================================================================

-- 1. Body orbital periods within 0.5% of the Kepler period from the parent's
--    mass (parent star for planets, parent body for moons).
UPDATE celestial_bodies cb
SET orbital_period_days = NULL
FROM celestial_bodies p
WHERE p.id = cb.parent_id
	AND cb.kind = 'body'
	AND cb.orbital_period_days IS NOT NULL AND cb.orbital_period_days > 0
	AND cb.semi_major_axis_au IS NOT NULL AND cb.semi_major_axis_au > 0
	AND p.mass_kg IS NOT NULL AND p.mass_kg > 0
	AND abs(cb.orbital_period_days
		- (2 * pi() * sqrt(power(cb.semi_major_axis_au * 1.495978707e11, 3) / (6.67430e-11 * p.mass_kg)) / 86400))
		<= 0.005 * cb.orbital_period_days;

-- 2. Companion-star orbital periods within 0.5% of Kepler from the pair's
--    combined mass.
UPDATE celestial_bodies cb
SET orbital_period_days = NULL
FROM celestial_bodies p
WHERE p.id = cb.parent_id
	AND cb.kind = 'star' AND p.kind = 'star'
	AND cb.orbital_period_days IS NOT NULL AND cb.orbital_period_days > 0
	AND cb.semi_major_axis_au IS NOT NULL AND cb.semi_major_axis_au > 0
	AND p.mass_kg IS NOT NULL AND p.mass_kg > 0
	AND abs(cb.orbital_period_days
		- (2 * pi() * sqrt(power(cb.semi_major_axis_au * 1.495978707e11, 3) / (6.67430e-11 * (p.mass_kg + COALESCE(cb.mass_kg, 0)))) / 86400))
		<= 0.005 * cb.orbital_period_days;

-- 3. Star luminosities within 1% of Stefan-Boltzmann (L = 4 pi R^2 sigma T^4)
--    from the stored radius + temperature.
UPDATE celestial_bodies
SET luminosity_w = NULL
WHERE kind = 'star'
	AND luminosity_w IS NOT NULL AND luminosity_w > 0
	AND radius_m IS NOT NULL AND radius_m > 0
	AND temperature_k IS NOT NULL AND temperature_k > 0
	AND abs(luminosity_w - (4 * pi() * power(radius_m, 2) * 5.670374419e-8 * power(temperature_k, 4)))
		<= 0.01 * luminosity_w;

-- 4. Satellite counts equal to the actual number of direct child bodies
--    (the auto-maintained value; a differing count is a deliberate override,
--    e.g. "known satellites" lore exceeding catalogued moons).
UPDATE celestial_bodies cb
SET satellites = NULL
WHERE cb.kind = 'body'
	AND cb.satellites IS NOT NULL
	AND cb.satellites = (
		SELECT COUNT(*) FROM celestial_bodies m
		WHERE m.parent_id = cb.id AND m.kind = 'body'
	);
