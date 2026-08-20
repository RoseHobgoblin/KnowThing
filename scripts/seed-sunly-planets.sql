-- Seed a planetary system for the Sun: 7 planets + 5 moons.
-- Run with: docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-sunly-planets.sql
--
-- Orbits are Kepler-consistent (P_days ≈ a_AU^1.5 * 365.25 for the ~1 M☉ Sun).
-- Moons are ordinary planetary_bodies rows with body_type 'planet' and a
-- parent_id — satellites are distinguished by parentage, not a separate type
-- (see src/lib/rodder/schema.ts). Idempotent: ON CONFLICT (slug) DO NOTHING.

-- --- Planets -----------------------------------------------------------------
INSERT INTO planetary_bodies (
	name, slug, body_type, star_id,
	mass_kg, radius_m, temperature_k, composition, atmosphere, surface_pressure,
	orbital_period_days, semi_major_axis_au, eccentricity, inclination,
	rotation_period_s, axial_tilt, satellites, epoch_phase,
	description
)
VALUES
	('Cinder', 'cinder', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 2.4e23, 2.6e6, 440, 'Iron-nickel core, silicate crust', 'None (trace sodium exosphere)', '≈0 bar',
	 89.0, 0.39, 0.21, 6.3, 5.07e6, 0.5, 0, 0.12,
	 'A scorched, airless cinder of a world, tidally battered and locked in a slow resonance with the Sun.'),

	('Marrow', 'marrow', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 4.6e24, 6.0e6, 735.15, 'Basaltic plains, sulfur highlands', 'Dense CO₂ with sulfuric-acid clouds', '88 bar',
	 204.8, 0.68, 0.01, 3.4, 2.10e7, 2.6, 0, 0.44,
	 'A furnace beneath perpetual gold cloud. Its day outlasts its year, and it turns backward beneath the Sun.'),

	('Cael', 'cael', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 6.4e24, 6.4e6, 287.15, 'Silicate mantle, iron core, liquid-water oceans', 'N₂ / O₂', '1.0 bar',
	 393.0, 1.05, 0.03, 0.0, 8.64e4, 23.4, 1, 0.78,
	 'The temperate jewel of the Sunly system — blue oceans, a breathable sky, and a single pale moon.'),

	('Rustmere', 'rustmere', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 6.9e23, 3.5e6, 218.15, 'Iron-oxide regolith, polar water ice', 'Thin CO₂', '0.008 bar',
	 753.0, 1.62, 0.09, 1.9, 8.86e4, 25.2, 2, 0.29,
	 'A cold rust-red desert of dust storms and dry canyons, flanked by two captured potato-shaped moons.'),

	('Gorm', 'gorm', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 1.6e27, 6.8e7, 128.15, 'Hydrogen / helium over a metallic-hydrogen core', 'H₂ / He with ammonia bands', '— (no solid surface)',
	 4456.0, 5.30, 0.048, 1.3, 3.6e4, 3.1, 34, 0.61,
	 'A banded amber giant that rules the outer system, wrapped in faint dust rings and a swarm of moons.'),

	('Halvane', 'halvane', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 9.2e25, 2.4e7, 73.15, 'Water / ammonia / methane ices over a rocky core', 'H₂ / He / CH₄ (cyan tint)', '— (no solid surface)',
	 11378.0, 9.90, 0.011, 0.8, 6.2e4, 28.3, 12, 0.05,
	 'A serene cyan ice giant tilted into its orbit, ringed and cold, at the edge of the Sun''s warmth.'),

	('Vesper', 'vesper', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'),
	 1.4e22, 1.2e6, 43.15, 'Nitrogen-methane ice over rock', 'Tenuous N₂ (seasonal)', '10 µbar',
	 42945.0, 24.0, 0.25, 17.1, 5.5e5, 12.0, 1, 0.90,
	 'A tiny, tilted iceworld on a long eccentric path — the Sunly system''s frozen outer sentinel.')
ON CONFLICT (slug) DO NOTHING;

-- --- Moons (parent_id → planet slug) -----------------------------------------
INSERT INTO planetary_bodies (
	name, slug, body_type, star_id, parent_id,
	mass_kg, radius_m, temperature_k, composition,
	orbital_period_days, semi_major_axis_au, eccentricity, inclination,
	rotation_period_s, axial_tilt, epoch_phase, description
)
VALUES
	('Mirl', 'mirl', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'), (SELECT id FROM planetary_bodies WHERE slug = 'cael'),
	 7.3e22, 1.7e6, 253.15, 'Anorthosite highland crust',
	 27.3, 0.00257, 0.05, 5.1, 2.36e6, 6.7, 0.30,
	 'Cael''s pale, cratered companion; tidally locked, it shows one face forever.'),

	('Dask', 'dask', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'), (SELECT id FROM planetary_bodies WHERE slug = 'rustmere'),
	 1.0e16, 11000, 213.15, 'Carbonaceous rock',
	 0.32, 0.00006, 0.015, 1.1, 2.76e4, 0.0, 0.60,
	 'A tiny inner moonlet racing around Rustmere three times a day.'),

	('Pel', 'pel', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'), (SELECT id FROM planetary_bodies WHERE slug = 'rustmere'),
	 1.5e15, 6200, 210.15, 'Dark captured rock',
	 1.26, 0.00016, 0.0003, 0.9, NULL, NULL, 0.15,
	 'Rustmere''s outer moonlet, a dark splinter of stone on a slow loop.'),

	('Tamber', 'tamber', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'), (SELECT id FROM planetary_bodies WHERE slug = 'gorm'),
	 8.9e22, 1.8e6, 123.15, 'Sulfur-coated silicate',
	 1.77, 0.0028, 0.004, 0.0, NULL, NULL, 0.40,
	 'A volcanic moon of Gorm, painted yellow-orange by relentless eruptions.'),

	('Senn', 'senn', 'planet', (SELECT id FROM stars WHERE slug = 'the-sun'), (SELECT id FROM planetary_bodies WHERE slug = 'gorm'),
	 1.5e23, 2.6e6, 113.15, 'Water-ice shell over a subsurface ocean',
	 7.15, 0.0071, 0.009, 0.2, NULL, NULL, 0.85,
	 'An ice-shelled moon of Gorm, its cracked white crust hiding a deep ocean.')
ON CONFLICT (slug) DO NOTHING;
