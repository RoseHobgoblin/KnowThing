-- The Palimpsest Reach
-- A deliberately authored rodder seed for an otherwise empty KnowThing DB.
-- The script is transactional and refuses to collide with an existing sector.

BEGIN;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM rodder_sectors WHERE slug = 'palimpsest-reach') THEN
		RAISE EXCEPTION 'The Palimpsest Reach is already seeded';
	END IF;
END $$;

INSERT INTO rodder_sectors (
	name, slug, description, units, shape,
	extent_x, extent_y, extent_z,
	origin_kind, axes_note, handedness, reference_epoch, provenance
) VALUES (
	'The Palimpsest Reach',
	'palimpsest-reach',
	'A compact stellar neighbourhood repeatedly settled, abandoned, and resettled. Its inhabited worlds preserve incompatible calendars and place-names from cultures that mistook each rediscovery for a first arrival.',
	'ly',
	'cuboid',
	38, 26, 20,
	'frame-centred',
	'+X points from Orison Fold toward Glasswake; +Y follows the old beacon plane toward the Drowned Choir; +Z points toward the pale Lantern Dust above that plane. The frame is static setting canon, not a propagated astrometric solution.',
	'right-handed',
	'Reach Concordance 0 (static authored epoch)',
	'authored'
);

-- Root systems. Distance is the authored straight-line distance from Orison
-- Fold, matching each sector-root vector to useful display precision.
INSERT INTO rodder_bodies (
	kind, name, slug, description, distance_ly, formation_age, designations, extra
) VALUES
(
	'system', 'Orison Fold', 'orison-fold',
	'The reference system of the Reach and the oldest continuously occupied crossing. Nacre’s archivists named the sector after finding three mutually contradictory settlement strata beneath their own launch fields.',
	0, '~7.8 billion years', 'PR-00; The Fold; Lantern Zero',
	'{"setting":{"role":"sector origin","survey":"Concordance frame anchor"}}'::jsonb
),
(
	'system', 'Glasswake', 'glasswake',
	'A bright, metal-rich system whose inner worlds are lacquered with impact glass. Automated heliographs in the outer system still transmit weather reports for colonies that vanished before the current era.',
	9.06, '~3.1 billion years', 'PR+08-03; Wake of Glass',
	'{"setting":{"role":"brightward trade terminus","hazard":"high ultraviolet seasons"}}'::jsonb
),
(
	'system', 'Vey''s Anvil', 'veys-anvil',
	'An aging giant and a remote white-dwarf companion. Every culture in the Reach independently noticed that Vey is changing; they disagree only on whether the change is a clock, a warning, or a promise.',
	12.86, '~2.4 billion years', 'PR-12+05; The Anvil',
	'{"setting":{"role":"chronology standard","hazard":"evolving giant primary"}}'::jsonb
),
(
	'system', 'The Drowned Choir', 'drowned-choir',
	'A close red binary wrapped in cold dust. From Threnody the two suns appear to sing through the ocean haze, producing a slow beat of copper and crimson daylight.',
	11.62, '~5.6 billion years', 'PR+03+11; Choir Binary',
	'{"setting":{"role":"outer water reserve","signal":"persistent low-frequency maser chorus"}}'::jsonb
),
(
	'system', 'Needle''s Rest', 'needles-rest',
	'A white dwarf, a compact debris stream, and two stubborn survivors. The system is quiet enough that navigators use its regular occultations to check clocks across the Reach.',
	13.24, '~8.9 billion years; white-dwarf cooling age ~2.1 billion years', 'PR-07-09; The Rest',
	'{"setting":{"role":"navigation clock","hazard":"dense inclined debris stream"}}'::jsonb
);

-- Stars. Primary stars orbit their system barycentre; stellar companions orbit
-- the primary using the unified parent edge.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, description,
	mass_kg, radius_m, spectral_type, luminosity_w, temperature_k, color,
	age, metallicity, rotation_period_s,
	orbital_period_days, semi_major_axis_au, eccentricity, epoch_phase, inclination,
	extra
) VALUES
(
	'star', 'Orison', 'orison', (SELECT id FROM rodder_bodies WHERE slug = 'orison-fold'),
	'A steady amber K dwarf. Its long main-sequence lifetime made it the Reach’s natural archive lamp.',
	1.5500e30, 5.1480e8, 'K2V', 1.2250e26, 4970, 'amber-gold',
	'~7.8 billion years', '+0.09 dex', 3024000,
	NULL, NULL, NULL, 0.12, 2.1,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":11001,"activity":0.18,"maps":{}}}'::jsonb
),
(
	'star', 'Palinode', 'palinode', (SELECT id FROM rodder_bodies WHERE slug = 'orison'),
	'A flare-prone red companion on a long eccentric orbit. Old ephemerides repeatedly “rediscovered” it after losing track near apoapsis, giving the star its name: a statement made again.',
	3.5792e29, 1.5305e8, 'M5V', 2.2968e24, 3150, 'deep ember-red',
	'~7.8 billion years', '+0.07 dex', 950400,
	87660, 38, 0.41, 0.68, 27.0,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":11002,"activity":0.82,"maps":{}}}'::jsonb
),
(
	'star', 'Aster Vale', 'aster-vale', (SELECT id FROM rodder_bodies WHERE slug = 'glasswake'),
	'A metal-rich F dwarf with a brilliant white photosphere and a broad ultraviolet flare cycle.',
	2.3070e30, 8.0701e8, 'F8V', 6.5080e26, 6200, 'white-gold',
	'~3.1 billion years', '+0.21 dex', 691200,
	NULL, NULL, NULL, 0.31, 4.0,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":22001,"activity":0.46,"maps":{}}}'::jsonb
),
(
	'star', 'Vey', 'vey', (SELECT id FROM rodder_bodies WHERE slug = 'veys-anvil'),
	'An orange giant crossing the early red-giant branch. Its slow brightening is the longest common clock shared by the Reach’s surviving observatories.',
	3.1816e30, 5.9135e9, 'K1III', 1.2250e28, 4600, 'burnished orange',
	'~2.4 billion years', '-0.04 dex', 7257600,
	NULL, NULL, NULL, 0.44, 7.2,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"giant","seed":33001,"activity":0.34,"maps":{}}}'::jsonb
),
(
	'star', 'Clinker', 'clinker', (SELECT id FROM rodder_bodies WHERE slug = 'vey'),
	'A carbon-streaked white dwarf far beyond Vey’s inner worlds. Spectra imply it once transferred material to Vey, complicating every simple age estimate for the system.',
	1.2329e30, 8.6267e6, 'DA3', 1.1484e24, 15500, 'hard blue-white',
	'cooling age ~620 million years', NULL, 172800,
	758555, 120, 0.55, 0.77, 51.0,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"white_dwarf","seed":33002,"activity":0.03,"maps":{}}}'::jsonb
),
(
	'star', 'Cantor', 'cantor', (SELECT id FROM rodder_bodies WHERE slug = 'drowned-choir'),
	'The larger voice of the Drowned Choir, a quiet M0 dwarf rich in long-lived starspots.',
	1.0738e30, 3.8264e8, 'M0V', 2.6796e25, 3850, 'copper-red',
	'~5.6 billion years', '+0.02 dex', 2764800,
	NULL, NULL, NULL, 0.09, 1.4,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":44001,"activity":0.39,"maps":{}}}'::jsonb
),
(
	'star', 'Undertone', 'undertone', (SELECT id FROM rodder_bodies WHERE slug = 'cantor'),
	'A close M2 companion. Its orbit shifts the combined daylight cycle on Threnody by several hours over each 47-day stellar revolution.',
	7.3573e29, 2.9915e8, 'M2V', 9.5700e24, 3520, 'dark crimson',
	'~5.6 billion years', '+0.01 dex', 1900800,
	47.2, 0.32, 0.08, 0.53, 88.4,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":44002,"activity":0.55,"maps":{}}}'::jsonb
),
(
	'star', 'Needle', 'needle', (SELECT id FROM rodder_bodies WHERE slug = 'needles-rest'),
	'A cool white dwarf whose sharp, stable transit profile is visible throughout the Reach.',
	1.2329e30, 8.6267e6, 'DA4', 7.6560e23, 11000, 'pale blue-white',
	'cooling age ~2.1 billion years', NULL, 129600,
	NULL, NULL, NULL, 0.01, 0.0,
	'{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"white_dwarf","seed":55001,"activity":0.01,"maps":{}}}'::jsonb
);

-- Worlds, moons, belts, and one first-class ring system. Surface and weather
-- recipes are explicit authoring inputs; their procedural output remains
-- illustrative, never asserted geography.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, body_type, description,
	mass_kg, radius_m, temperature_k, composition, atmosphere, surface_pressure,
	orbital_period_days, semi_major_axis_au, eccentricity, epoch_phase, inclination,
	longitude_ascending_node, argument_of_periapsis, rotation_period_s, axial_tilt,
	satellites, extra
) VALUES
(
	'body', 'Nacre', 'nacre', (SELECT id FROM rodder_bodies WHERE slug = 'orison'), 'planet',
	'An old ocean world whose pale island arcs are built from the mineralized shells of successive biospheres. Its cities prize annotated ruins more than untouched ground.',
	6.5694e24, 6.1800e6, 286, 'silicate mantle, iron core, carbonate-rich oceanic crust', 'N2 76%, O2 19%, H2O and Ar 5%', '0.94 bar',
	231.4, 0.68, 0.034, 0.17, 1.8, 44.0, 112.0, 79200, 19.6,
	2,
	'{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":11011,"coverage":{"surfaceWater":0.82,"vegetation":0.34,"permanentSnowIce":0.08},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.64,"seed":11012}}}'::jsonb
),
(
	'body', 'Bellweather', 'bellweather', (SELECT id FROM rodder_bodies WHERE slug = 'nacre'), 'planet',
	'Nacre’s larger moon. Long-lived storms arrive when its bright limb crosses Palinode’s seasonal path, so coastal almanacs treat moonrise as a weather verb.',
	1.0153e23, 1.5200e6, 206, 'silicates, hydrated salts, iron-poor crust', 'trace argon and sodium', '<0.001 bar',
	15.8, 0.00162, 0.021, 0.42, 6.2, 91.0, 8.0, 1365120, 3.1,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":11013,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"none","meanCover":null,"seed":null}}}'::jsonb
),
(
	'body', 'Ash of Noon', 'ash-of-noon', (SELECT id FROM rodder_bodies WHERE slug = 'nacre'), 'asteroid',
	'A dark captured moon in a steep retrograde orbit. Noon eclipses cast an ash-grey moving spot across Nacre’s equatorial seas.',
	8.1000e20, 2.9500e5, 174, 'carbonaceous chondrite and water ice', NULL, NULL,
	41.3, 0.00335, 0.19, 0.81, 143.0, 17.0, 204.0, 3568320, 11.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":11014,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.12},"maps":{}}}'::jsonb
),
(
	'body', 'The Redaction', 'the-redaction', (SELECT id FROM rodder_bodies WHERE slug = 'orison'), 'asteroid',
	'A broad resonant belt rather than a single object. Its carbon-black members erase background stars in dense, sharply bounded occultation bands.',
	3.9000e21, 4.8000e5, 168, 'carbonaceous and metallic asteroids', NULL, NULL,
	821.0, 1.58, 0.12, 0.63, 4.7, 155.0, 73.0, 35280, 8.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":11015,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'::jsonb
),
(
	'body', 'Serein', 'serein', (SELECT id FROM rodder_bodies WHERE slug = 'orison'), 'planet',
	'A muted blue gas giant. Fine ice falls through its upper haze in a continuous “dry rain” that gave the planet its name.',
	1.3666e27, 6.4200e7, 132, 'hydrogen, helium, methane and deep water-ammonia layers', 'H2 84%, He 14%, CH4 2%', 'not applicable (gas giant)',
	2580, 3.40, 0.047, 0.28, 2.6, 11.0, 301.0, 38880, 26.0,
	1,
	'{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":11016,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.92,"seed":11017}}}'::jsonb
),
(
	'body', 'Hush', 'hush', (SELECT id FROM rodder_bodies WHERE slug = 'serein'), 'planet',
	'A smooth ice moon with a deep conductive ocean. Its nearly featureless hemisphere was once used as a projection screen by orbital monasteries.',
	4.8000e22, 1.3900e6, 96, 'water ice, ammonia brine, silicate core', 'trace water vapour', 'negligible',
	6.4, 0.00073, 0.006, 0.12, 0.4, 61.0, 9.0, 552960, 0.7,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":11018,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'::jsonb
),
(
	'body', 'The Marginalia', 'the-marginalia', (SELECT id FROM rodder_bodies WHERE slug = 'serein'), 'ring_system',
	'Serein’s broad, charcoal-and-ice ring system. Shepherd fragments carve temporary script-like gaps that observers name and catalogue before they disappear.',
	NULL, NULL, 88, 'water ice, carbonaceous dust, shepherd fragments', NULL, NULL,
	0.61, 0.00016, 0.012, 0.36, 0.2, 12.0, 77.0, NULL, NULL,
	0,
	'{}'::jsonb
),
(
	'body', 'Vitria', 'vitria', (SELECT id FROM rodder_bodies WHERE slug = 'aster-vale'), 'planet',
	'A high-gravity desert world tiled with amber impact glass. Dawn winds make the youngest glass fields resonate like distant bells.',
	1.0750e25, 7.5200e6, 318, 'iron-rich silicates and extensive fused-glass plains', 'N2 62%, CO2 31%, Ar 7%', '1.8 bar',
	524.0, 1.34, 0.061, 0.71, 3.2, 202.0, 144.0, 112320, 7.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":22011,"coverage":{"surfaceWater":0.01,"vegetation":0,"permanentSnowIce":0},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.13,"seed":22012}}}'::jsonb
),
(
	'body', 'Heliograph', 'heliograph', (SELECT id FROM rodder_bodies WHERE slug = 'aster-vale'), 'planet',
	'A cream-and-cobalt gas giant surrounded by derelict solar-weather stations. Several still broadcast precise but obsolete storm warnings.',
	2.2207e27, 7.3400e7, 149, 'hydrogen and helium with water-ammonia cloud decks', 'H2 88%, He 11%, trace NH3 and H2O', 'not applicable (gas giant)',
	3560, 4.82, 0.083, 0.08, 1.1, 32.0, 219.0, 34200, 14.0,
	1,
	'{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":22013,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.98,"seed":22014}}}'::jsonb
),
(
	'body', 'Proof', 'proof', (SELECT id FROM rodder_bodies WHERE slug = 'heliograph'), 'planet',
	'A volcanic moon where abandoned calibration mirrors flash in sequence as they cross the terminator—the last working proof that the heliograph network once agreed on anything.',
	8.7000e22, 1.8600e6, 238, 'silicate rock, sulfur compounds, small iron core', 'SO2 and sodium traces', '0.003 bar',
	4.9, 0.00059, 0.009, 0.57, 0.8, 118.0, 43.0, 423360, 0.2,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":22015,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'::jsonb
),
(
	'body', 'Ferrule', 'ferrule', (SELECT id FROM rodder_bodies WHERE slug = 'vey'), 'planet',
	'A stripped iron-rich world already enduring Vey’s expansion. Its surviving settlements migrate through old polar boreholes to stay behind the thermal terminator.',
	2.8700e24, 4.1200e6, 812, 'iron-nickel core with a thin refractory mantle', 'Na, O2 and vaporized silicates', '<0.01 bar',
	52.7, 0.32, 0.093, 0.22, 5.4, 241.0, 17.0, 4553280, 0.4,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":33011,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'::jsonb
),
(
	'body', 'Anvilwake', 'anvilwake', (SELECT id FROM rodder_bodies WHERE slug = 'vey'), 'planet',
	'A massive ringed giant far enough from Vey to have survived its brightening so far. Its magnetotail forges a visible auroral wake across the orbit of Temper.',
	3.0368e27, 7.8500e7, 214, 'hydrogen, helium and a heavy-element enriched core', 'H2 82%, He 16%, trace metal hydrides', 'not applicable (gas giant)',
	4730, 6.70, 0.071, 0.49, 8.8, 63.0, 188.0, 36720, 31.0,
	1,
	'{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":33012,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.87,"seed":33013}}}'::jsonb
),
(
	'body', 'Temper', 'temper', (SELECT id FROM rodder_bodies WHERE slug = 'anvilwake'), 'planet',
	'A dense basaltic moon threaded with conductive ore. Anvilwake’s magnetosphere heats its fault network and lights violet aurorae even on the dayside.',
	6.2000e23, 2.8800e6, 284, 'basalt, iron sulfides and a partially molten mantle', 'SO2, CO2 and sulfur aerosols', '0.18 bar',
	9.7, 0.00108, 0.018, 0.69, 1.9, 277.0, 95.0, 838080, 1.2,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":33014,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.22,"seed":33015}}}'::jsonb
),
(
	'body', 'Threnody', 'threnody', (SELECT id FROM rodder_bodies WHERE slug = 'drowned-choir'), 'planet',
	'A circumbinary ocean world under two red suns. Black photosynthetic rafts gather along pressure ridges and sink for months when the suns eclipse one another.',
	7.2861e24, 6.9100e6, 274, 'silicate core, deep global ocean, high-pressure ice mantle', 'N2 71%, CO2 18%, CH4 6%, H2O 5%', '2.7 bar',
	304.0, 0.91, 0.026, 0.34, 0.7, 13.0, 251.0, 104400, 23.0,
	1,
	'{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":44011,"coverage":{"surfaceWater":0.96,"vegetation":0.41,"permanentSnowIce":0.19},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.79,"seed":44012}}}'::jsonb
),
(
	'body', 'Dirge', 'dirge', (SELECT id FROM rodder_bodies WHERE slug = 'threnody'), 'planet',
	'A large grey moon whose tides organize Threnody’s floating ecologies into planet-spanning migration bands.',
	2.9000e23, 2.4100e6, 167, 'silicate rock and water ice', 'trace nitrogen', 'negligible',
	23.6, 0.00214, 0.014, 0.91, 4.3, 82.0, 11.0, 2039040, 5.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":44013,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'::jsonb
),
(
	'body', 'Wakeglass', 'wakeglass', (SELECT id FROM rodder_bodies WHERE slug = 'drowned-choir'), 'asteroid',
	'A dusty circumbinary belt beyond Threnody. Its ice-rich fragments briefly brighten when the binary’s combined wind turns their tails toward the inner system.',
	8.0000e21, 6.2000e5, 58, 'water ice, silicates and complex organics', NULL, NULL,
	2280, 3.48, 0.17, 0.14, 12.0, 333.0, 67.0, 64800, 16.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":44014,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'::jsonb
),
(
	'body', 'Cautery', 'cautery', (SELECT id FROM rodder_bodies WHERE slug = 'needle'), 'asteroid',
	'A disintegrating metallic remnant grazing the white dwarf. Its debris makes the thin, inclined line that gave Needle’s Rest its name.',
	6.4000e20, 2.1000e5, 1040, 'iron, nickel and refractory ceramics', 'metal vapour tail', 'negligible',
	0.61, 0.012, 0.11, 0.66, 71.0, 49.0, 208.0, 52704, 2.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":55011,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'::jsonb
),
(
	'body', 'Spindle', 'spindle', (SELECT id FROM rodder_bodies WHERE slug = 'needle'), 'planet',
	'A cold, iron-heavy survivor on a surprisingly circular orbit. Deep radar shows kilometer-scale voids arranged too regularly to be confidently geological.',
	4.6000e24, 5.2800e6, 121, 'iron-rich mantle, silicate crust and subsurface volatiles', 'trace neon and argon', '<0.001 bar',
	126.0, 0.42, 0.008, 0.05, 22.0, 167.0, 309.0, 92880, 74.0,
	0,
	'{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":55012,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.31},"maps":{}}}'::jsonb
);

-- Subqueries in one multi-row INSERT cannot see sibling rows from that same
-- statement. Resolve the ten within-batch hierarchy edges explicitly after
-- every named row exists.
UPDATE rodder_bodies AS child
SET parent_id = parent.id,
	updated_at = NOW()
FROM (
	VALUES
		('palinode', 'orison'),
		('clinker', 'vey'),
		('undertone', 'cantor'),
		('bellweather', 'nacre'),
		('ash-of-noon', 'nacre'),
		('hush', 'serein'),
		('the-marginalia', 'serein'),
		('proof', 'heliograph'),
		('temper', 'anvilwake'),
		('dirge', 'threnody')
) AS link(child_slug, parent_slug)
JOIN rodder_bodies AS parent ON parent.slug = link.parent_slug
WHERE child.slug = link.child_slug;

-- Sector positions. The origin system is also made the declared frame origin
-- only after its body row exists, preserving the sector FK contract.
INSERT INTO rodder_sector_roots (
	sector_id, body_id, x, y, z, position_provenance, position_uncertainty, notes
) VALUES
((SELECT id FROM rodder_sectors WHERE slug = 'palimpsest-reach'), (SELECT id FROM rodder_bodies WHERE slug = 'orison-fold'), 0, 0, 0, 'authored', 0, 'Definition of the object-centred origin.'),
((SELECT id FROM rodder_sectors WHERE slug = 'palimpsest-reach'), (SELECT id FROM rodder_bodies WHERE slug = 'glasswake'), 8.4, -3.2, 1.1, 'authored', 0.03, 'Concordance-era triangulation.'),
((SELECT id FROM rodder_sectors WHERE slug = 'palimpsest-reach'), (SELECT id FROM rodder_bodies WHERE slug = 'veys-anvil'), -11.6, 4.7, -2.9, 'authored', 0.05, 'Corrected for the giant primary''s photocentre.'),
((SELECT id FROM rodder_sectors WHERE slug = 'palimpsest-reach'), (SELECT id FROM rodder_bodies WHERE slug = 'drowned-choir'), 3.1, 10.8, 4.2, 'authored', 0.04, 'Binary barycentre, not Cantor''s instantaneous position.'),
((SELECT id FROM rodder_sectors WHERE slug = 'palimpsest-reach'), (SELECT id FROM rodder_bodies WHERE slug = 'needles-rest'), -6.8, -9.4, 6.3, 'authored', 0.02, 'White-dwarf photocentre; debris stream excluded.');

UPDATE rodder_sectors
SET origin_kind = 'object-centred',
	origin_body_id = (SELECT id FROM rodder_bodies WHERE slug = 'orison-fold'),
	updated_at = NOW()
WHERE slug = 'palimpsest-reach';

-- A local civil calendar gives the Orrery a meaningful time scrubber without
-- claiming that every culture in the Reach shares it.
INSERT INTO calendars (name, slug, description, is_primary, planet_id, static_data)
VALUES (
	'Nacre Archive Reckoning',
	'nacre-archive-reckoning',
	'The civil calendar used by the modern archive cities of Nacre.',
	true,
	(SELECT id FROM rodder_bodies WHERE slug = 'nacre'),
	'{
		"first_week_day": 0,
		"weekdays": [
			{"name":"Leaf","abbreviation":"Lf"},
			{"name":"Ink","abbreviation":"In"},
			{"name":"Thread","abbreviation":"Th"},
			{"name":"Glass","abbreviation":"Gl"},
			{"name":"Tide","abbreviation":"Ti"},
			{"name":"Ember","abbreviation":"Em"},
			{"name":"Rest","abbreviation":"Rs"}
		],
		"months": [
			{"name":"First Reading","short_name":"First","length":33,"month_type":"regular"},
			{"name":"Annotations","short_name":"Notes","length":33,"month_type":"regular"},
			{"name":"High Water","short_name":"High","length":33,"month_type":"regular"},
			{"name":"Palinode","short_name":"Pali","length":33,"month_type":"regular"},
			{"name":"Long Margin","short_name":"Margin","length":33,"month_type":"regular"},
			{"name":"Shellfall","short_name":"Shell","length":33,"month_type":"regular"},
			{"name":"Concordance","short_name":"Concord","length":33,"month_type":"regular"}
		],
		"leap_days": [],
		"moons": [
			{"name":"Bellweather","cycle":15.8,"offset":2.6,"face_color":"#d9d2bd","shadow_color":"#34354a"},
			{"name":"Ash of Noon","cycle":47.1,"offset":19.0,"face_color":"#706b69","shadow_color":"#1d1c24"}
		],
		"eras": [{"name":"Concordance","start_year":0,"format":"CR","reverse_numbering":false}],
		"seasons": [
			{"name":"High Ink","kind":"winter","color":"#58708f","timing":{"type":"dated","month":0,"day":1}},
			{"name":"Glasswake","kind":"spring","color":"#80a8a2","timing":{"type":"dated","month":2,"day":12}},
			{"name":"Palinode Bloom","kind":"summer","color":"#c8a264","timing":{"type":"dated","month":3,"day":23}},
			{"name":"Shellfall","kind":"autumn","color":"#956858","timing":{"type":"dated","month":5,"day":1}}
		],
		"display_moons": true,
		"year_offset": 0,
		"epoch_offset": 0,
		"day_length_seconds": 79200
	}'::jsonb
);

DO $$
DECLARE
	sector_count integer;
	root_count integer;
	system_count integer;
	star_count integer;
	body_count integer;
	orphan_count integer;
BEGIN
	SELECT COUNT(*) INTO sector_count FROM rodder_sectors WHERE slug = 'palimpsest-reach';
	SELECT COUNT(*) INTO root_count FROM rodder_sector_roots;
	SELECT COUNT(*) INTO system_count FROM rodder_bodies WHERE kind = 'system';
	SELECT COUNT(*) INTO star_count FROM rodder_bodies WHERE kind = 'star';
	SELECT COUNT(*) INTO body_count FROM rodder_bodies WHERE kind = 'body';
	SELECT COUNT(*) INTO orphan_count FROM rodder_bodies WHERE kind <> 'system' AND parent_id IS NULL;
	IF sector_count <> 1 OR root_count <> 5 OR system_count <> 5 OR star_count <> 8 OR body_count <> 18 OR orphan_count <> 0 THEN
		RAISE EXCEPTION 'Unexpected seed counts: sectors %, roots %, systems %, stars %, bodies %, orphans %',
			sector_count, root_count, system_count, star_count, body_count, orphan_count;
	END IF;
END $$;

COMMIT;
