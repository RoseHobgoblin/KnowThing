-- The Vesperine Expanse
--
-- Destructive development fixture for the Rodder sector/Orrery feature set.
-- The reset and seed are one transaction: any failed assertion rolls the wipe
-- back. Login-capable auth state (users, accounts, sessions) and migration
-- history are deliberately preserved; every other public table is emptied.

BEGIN;

DO $wipe$
DECLARE
	targets text;
BEGIN
	SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
	INTO targets
	FROM pg_tables
	WHERE schemaname = 'public'
		AND tablename <> ALL (ARRAY['users', 'accounts', 'sessions', '_migrations']);

	IF targets IS NOT NULL THEN
		EXECUTE 'TRUNCATE TABLE ' || targets || ' RESTART IDENTITY CASCADE';
	END IF;
END
$wipe$;

CREATE FUNCTION pg_temp.rid(wanted_slug text) RETURNS integer
LANGUAGE sql STABLE AS $fn$
	SELECT id FROM rodder_bodies WHERE slug = wanted_slug
$fn$;

INSERT INTO rodder_sectors (
	name, slug, description, units, shape, extent_x, extent_y, extent_z,
	origin_kind, axes_note, handedness, reference_epoch, provenance
) VALUES (
	'The Vesperine Expanse',
	'vesperine-expanse',
	'Twelve stellar cantons and one inhabited rogue world held together by the Vesperine Mandate: an empire that treats the delay of light as a constitutional fact. Its law, ritual, trade, and grudges all travel at finite speed, so every decree carries both a date and a declared horizon of authority.',
	'ly', 'cuboid', 60, 52, 32, 'frame-centred',
	'+X is Dawnward, from the Aureate Court toward Tithe; +Y is Chimeward, toward the Ash Choir; +Z is Crownward, normal to the old convoy plane. Coordinates are static setting canon at Mandate Synchrony 742.000, not propagated astrometry.',
	'right-handed', 'Mandate Synchrony 742.000', 'authored'
);

-- Twelve stellar roots. Each canton has a distinct constitutional duty inside
-- the Mandate, reflected in its settlement history and economy.
INSERT INTO rodder_bodies (
	kind, name, slug, description, distance_ly, formation_age, designations,
	extra, body, body_plain_text, body_size_bytes, body_updated_at
)
SELECT 'system', name, slug, description, distance_ly, formation_age, designations,
	extra::jsonb, article, article, octet_length(article), now()
FROM (VALUES
	('The Aureate Court', 'aureate-court',
	 'The political and chronological origin of the Mandate. Aureole and its distant red companion Censer illuminate Vespera, where laws are sealed with an authority radius measured in light-years.',
	 0.0, '~5.2 billion years', 'VE-00; Crown Origin; First Canton',
	 '{"setting":{"canton":"First Canton","duty":"law, diplomacy, synchrony","population":"18.4 billion"}}',
	 $wiki$== The court of delayed law ==
The Aureate Court is a capital in the plural. Vespera hosts the Chamber of Horizons, while embassies, archives, and duplicate regalia occupy hundreds of habitats around Blue Treasury. No imperial order becomes binding merely because it was spoken: it becomes binding when its dated authority cone reaches a canton and that canton returns a countersigned receipt.

The arrangement was written after the War of Premature Obedience, when three admirals acted on mutually incompatible copies of the same command. Modern court ritual is therefore obsessed with clocks, provenance, and the graceful admission that distant people still inhabit yesterday.$wiki$),
	('Bellfoundry', 'bellfoundry',
	 'A compact K-dwarf system famous for pressure-grown alloys and resonant navigation beacons. Its parliament convenes inside an evacuated bell whose hour-long note can be felt through the station hull.',
	 8.10, '~7.1 billion years', 'VE+07-04; Second Canton; The Foundry',
	 '{"setting":{"canton":"Second Canton","duty":"heavy industry and beacon standards","population":"6.9 billion"}}',
	 $wiki$== A constitution in metal ==
Bellfoundry supplies the tuned mass rings used by every recognized Mandate beacon. Foundry law requires an engineer to stamp each critical part with the name of the person willing to hear it fail. The custom began as liability practice and became a civic sacrament.$wiki$),
	('Myrrhglass', 'myrrhglass',
	 'A brilliant F dwarf and remote white dwarf companion. The system exports optical ceramics, perfumes cultured in ultraviolet orchards, and the Mandate''s most exacting forensic astronomers.',
	 10.20, '~3.4 billion years; companion cooling age ~1.6 billion years', 'VE-09+04; Third Canton; Glass Sepulchre',
	 '{"setting":{"canton":"Third Canton","duty":"forensics, optics, evidence courts","population":"4.1 billion"}}',
	 $wiki$== The evidentiary sky ==
Myrrhglass courts admit starlight as testimony. Their astronomers reconstruct old explosions, drive plumes, and battles from photons that reach different observatories at different times. The white dwarf Glassling is treated as both a star and a mausoleum: citizens leave mirrored memorial sails in its long orbit.$wiki$),
	('The Three Witnesses', 'three-witnesses',
	 'A nested red-orange triple whose stable outer worlds host the Mandate''s supreme appellate monasteries. Every judgment is argued three ways: intent, consequence, and what the evidence can actually support.',
	 15.34, '~8.0 billion years', 'VE+12+08; Fourth Canton; Triple Bench',
	 '{"setting":{"canton":"Fourth Canton","duty":"appeals and treaty interpretation","population":"2.7 billion"}}',
	 $wiki$== The triple bench ==
The system''s three suns never rise in quite the same order twice within a human lifetime. Jurists made that instability their emblem: a true account may change its silhouette without changing its substance. The moon Dissent houses the sealed minority opinions that later generations are encouraged to reopen.$wiki$),
	('Lantern''s Debt', 'lanterns-debt',
	 'A young, fierce A star illuminating a sparse family of scorched planets. Its prodigious energy is harvested by sail-swarms whose output is contractually owed to colder frontier cantons.',
	 17.86, '~780 million years', 'VE-15-06; Fifth Canton; The Debt',
	 '{"setting":{"canton":"Fifth Canton","duty":"energy and beam infrastructure","population":"1.3 billion"}}',
	 $wiki$== Light on account ==
Lantern''s Debt was settled with loans denominated in future photons. The original creditors are gone, but the repayment machinery remains and has become the basis of local identity. Citizens say that light is only free before someone learns how to meter it.$wiki$),
	('The Sable Quiet', 'sable-quiet',
	 'A solitary white dwarf with surviving inner ruins and a cold reliquary world. It is the Mandate''s radio-quiet preserve, burial ground, and most sensitive gravitational observatory.',
	 16.22, '~9.6 billion years; cooling age ~3.8 billion years', 'VE+04+15; Sixth Canton; Quietus',
	 '{"setting":{"canton":"Sixth Canton","duty":"memorial custody and deep observation","population":"0.34 billion"}}',
	 $wiki$== The right to silence ==
Transmitters in the inner Quiet operate only during two scheduled minutes each local day. The rest belongs to the dead and to instruments listening for the universe beneath civilization. Visitors receive a mechanical watch because network time is intentionally unavailable.$wiki$),
	('Red Mercy', 'red-mercy',
	 'A close pair of red dwarfs sheltering the ocean world Kindness. The canton pioneered famine relief during the Long Noon and now maintains the empire''s strategic seed, microbe, and ocean-genome reserves.',
	 14.46, '~6.4 billion years', 'VE-04-14; Seventh Canton; Mercy Pair',
	 '{"setting":{"canton":"Seventh Canton","duty":"biosphere reserves and disaster relief","population":"5.8 billion"}}',
	 $wiki$== Mercy with teeth ==
Red Mercy''s relief fleets are welcomed almost everywhere and trusted nowhere completely. Their compact permits them to ignore local borders during a verified extinction emergency. In return, every intervention is reviewed for a century by juries drawn from the people who received it.$wiki$),
	('Tithe', 'tithe',
	 'A dim K dwarf surrounded by mineral-rich worlds and meticulous orbital infrastructure. Tithe settles inter-canton accounts in mass, energy, labor-hours, and ecological repair rather than a single currency.',
	 20.49, '~8.6 billion years', 'VE+17-09; Eighth Canton; Ledger Star',
	 '{"setting":{"canton":"Eighth Canton","duty":"clearinghouse, weights, public audit","population":"8.2 billion"}}',
	 $wiki$== Nothing rounds away ==
Tithe''s accountants are trained as historians. A balance may remain open for centuries if closing it would conceal who paid the cost. The tiny moon Halfpenny is the ceremonial home of fractions, remainders, and obligations too small for powerful institutions to notice.$wiki$),
	('Green Psalm', 'green-psalm',
	 'A quiet G dwarf and the exuberantly living world Virid. The system is the Mandate''s largest source of novel ecologies and its loudest critic of treating living things as imperial inventory.',
	 22.63, '~6.0 billion years', 'VE-19+11; Ninth Canton; Verdant See',
	 '{"setting":{"canton":"Ninth Canton","duty":"ecology, medicine, living archives","population":"11.6 billion"}}',
	 $wiki$== A world that votes ==
Green Psalm grants legal standing to watersheds, migratory swarms, and several fungal continents. Human delegates speak for them but do not own their seats. Offworlders mock the proceedings until a river''s advocate freezes a trade agreement on impeccably documented grounds.$wiki$),
	('The Ash Choir', 'ash-choir',
	 'An orange giant with a far white dwarf companion, encircled by habitats preparing for a slow stellar brightening. Its singers encode evacuation plans in works designed to survive institutional collapse.',
	 22.68, '~2.9 billion years', 'VE+09+19; Tenth Canton; Choir of Cinders',
	 '{"setting":{"canton":"Tenth Canton","duty":"long-horizon planning and civil continuity","population":"3.5 billion"}}',
	 $wiki$== Rehearsal for an ending ==
The Ash Choir treats disaster planning as a performing art. Every habitat knows a different verse of the Great Departure, and no single archive contains the whole plan. The design is deliberate: survival should not depend on one capital, one format, or one generation behaving wisely.$wiki$),
	('Far Loom', 'far-loom',
	 'A hierarchical triple near the Dawnward frontier. It is a system of patient shipyards, migratory fabricators, and families whose homes are dismantled and rewoven around each new hull.',
	 28.75, '~5.7 billion years', 'VE-24-13; Eleventh Canton; Loom March',
	 '{"setting":{"canton":"Eleventh Canton","duty":"shipbuilding, exploration, frontier rescue","population":"1.9 billion"}}',
	 $wiki$== Woven rather than built ==
Far Loom does not launch ships; it graduates them. A vessel begins as a neighborhood distributed through the shipyards and slowly gathers schools, gardens, engines, and obligations until it can survive departure. Returning ships are unpicked for parts, stories, and citizens.$wiki$),
	('The Unwritten Gate', 'unwritten-gate',
	 'A red dwarf at the surveyed edge of the Expanse. Ancient synchronized ruins on Palimpsest imply a civilization that knew the other cantons before any accepted human arrival.',
	 27.94, '~9.1 billion years', 'VE+25+04; Twelfth Canton; Blank Gate',
	 '{"setting":{"canton":"Twelfth Canton","duty":"xenoarchaeology and boundary survey","population":"0.8 billion"}}',
	 $wiki$== The missing inscription ==
Every major ruin on Palimpsest contains a clean rectangular absence where an inscription should be. The voids are not erasures: crystal growth proves the surfaces formed blank. The canton''s scholars call this the Unwritten Problem and politely reject anyone who calls it prophecy.$wiki$)
) AS systems(name, slug, description, distance_ly, formation_age, designations, extra, article);

-- One primary per stellar root.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, description, mass_kg, radius_m, spectral_type,
	luminosity_w, temperature_k, color, age, metallicity, rotation_period_s,
	epoch_phase, inclination, extra, body, body_plain_text, body_size_bytes, body_updated_at
)
SELECT 'star', name, slug, pg_temp.rid(parent_slug), description, mass_kg, radius_m,
	spectral_type, luminosity_w, temperature_k, color, age, metallicity, rotation_period_s,
	epoch_phase, inclination, extra::jsonb, description, description, octet_length(description), now()
FROM (VALUES
	('Aureole', 'aureole', 'aureate-court', 'A calm G1 dwarf whose helioseismic pulse defines Mandate Synchrony.', 2.03e30, 7.10e8, 'G1V', 4.25e26, 5900.0, 'warm ivory', '~5.2 billion years', '+0.06 dex', 2160000.0, 0.10, 1.4, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70101,"activity":0.22,"maps":{}}}'),
	('Toll', 'toll', 'bellfoundry', 'A metal-rich K2 dwarf with a stable eleven-year activity cycle used to certify beacon alloys.', 1.55e30, 5.36e8, 'K2V', 1.34e26, 5010.0, 'amber', '~7.1 billion years', '+0.19 dex', 2937600.0, 0.36, 3.2, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70201,"activity":0.31,"maps":{}}}'),
	('Myrrh', 'myrrh', 'myrrhglass', 'A brilliant F6 dwarf whose ultraviolet cycle drives the system''s orbital perfume orchards.', 2.51e30, 9.05e8, 'F6V', 9.10e26, 6410.0, 'white-gold', '~3.4 billion years', '+0.11 dex', 777600.0, 0.62, 7.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"auto","seed":70301,"activity":0.47,"maps":{}}}'),
	('First Witness', 'first-witness', 'three-witnesses', 'The orange primary of the triple bench, slow-spotted and exceptionally old.', 1.43e30, 4.95e8, 'K4V', 6.12e25, 4590.0, 'burnished orange', '~8.0 billion years', '-0.08 dex', 3456000.0, 0.08, 2.1, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70401,"activity":0.19,"maps":{}}}'),
	('Argent Debt', 'argent-debt', 'lanterns-debt', 'A young A3 dwarf, intensely bright and wrapped in industrial sail constellations.', 4.02e30, 1.25e9, 'A3V', 8.30e27, 8720.0, 'blue-white', '~780 million years', '+0.03 dex', 126000.0, 0.44, 5.7, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70501,"activity":0.38,"maps":{}}}'),
	('Sable', 'sable', 'sable-quiet', 'A cool DA6 white dwarf with a restrained, nearly featureless photosphere.', 1.09e30, 9.30e6, 'DA6', 3.80e23, 8200.0, 'chalk blue-white', 'cooling age ~3.8 billion years', NULL, 208800.0, 0.01, 0.0, '{"stellarSurface":{"version":2,"fallback":"flat","morphology":"white_dwarf","seed":70601,"activity":0.0,"maps":{}}}'),
	('Mercy', 'mercy', 'red-mercy', 'The larger, quieter voice of the close Mercy binary.', 9.15e29, 3.27e8, 'M2V', 1.42e25, 3520.0, 'copper red', '~6.4 billion years', '+0.04 dex', 2505600.0, 0.27, 88.2, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70701,"activity":0.36,"maps":{}}}'),
	('Tally', 'tally', 'tithe', 'A dim, long-lived K7 dwarf used as the photometric standard for low-light industry.', 1.31e30, 4.45e8, 'K7V', 5.36e25, 4120.0, 'deep amber', '~8.6 billion years', '-0.02 dex', 3801600.0, 0.19, 0.8, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70801,"activity":0.24,"maps":{}}}'),
	('Psalm', 'psalm', 'green-psalm', 'A quiet G8 dwarf whose unusually low flare rate favored Virid''s complex biosphere.', 1.79e30, 6.39e8, 'G8V', 2.76e26, 5480.0, 'soft gold', '~6.0 billion years', '+0.14 dex', 2592000.0, 0.72, 1.9, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70901,"activity":0.12,"maps":{}}}'),
	('Ash Regent', 'ash-regent', 'ash-choir', 'An orange K0 giant whose measured brightening gives the canton centuries of warning.', 3.08e30, 7.24e9, 'K0III', 1.84e28, 4740.0, 'orange-gold', '~2.9 billion years', '-0.05 dex', 8208000.0, 0.31, 9.4, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"giant","seed":71001,"activity":0.41,"maps":{}}}'),
	('Loom-Mother', 'loom-mother', 'far-loom', 'A steady G5 dwarf anchoring Far Loom''s nested stellar hierarchy.', 1.91e30, 6.63e8, 'G5V', 3.33e26, 5660.0, 'yellow-white', '~5.7 billion years', '+0.01 dex', 2332800.0, 0.05, 3.8, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":71101,"activity":0.27,"maps":{}}}'),
	('Unwritten', 'unwritten', 'unwritten-gate', 'A magnetically quiet M0 dwarf, older than the ruins on its cold inner world.', 9.55e29, 3.62e8, 'M0V', 2.68e25, 3820.0, 'dark copper', '~9.1 billion years', '-0.17 dex', 4060800.0, 0.58, 4.4, '{"stellarSurface":{"version":2,"fallback":"flat","morphology":"main_sequence","seed":71201,"activity":0.05,"maps":{}}}')
) AS stars(name, slug, parent_slug, description, mass_kg, radius_m, spectral_type, luminosity_w, temperature_k, color, age, metallicity, rotation_period_s, epoch_phase, inclination, extra);

-- Eight companions produce wide binaries, close binaries, and nested triples.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, description, mass_kg, radius_m, spectral_type,
	luminosity_w, temperature_k, color, age, metallicity, rotation_period_s,
	orbital_period_days, semi_major_axis_au, eccentricity, epoch_phase, inclination,
	longitude_ascending_node, argument_of_periapsis, extra,
	body, body_plain_text, body_size_bytes, body_updated_at
)
SELECT 'star', name, slug, pg_temp.rid(parent_slug), description, mass_kg, radius_m,
	spectral_type, luminosity_w, temperature_k, color, age, metallicity, rotation_period_s,
	period_days, axis_au, eccentricity, phase, inclination, node, periapsis, extra::jsonb,
	description, description, octet_length(description), now()
FROM (VALUES
	('Censer', 'censer', 'aureole', 'A distant M3 companion, flare-prone at periastron and culturally associated with revision rather than omen.', 4.58e29, 1.81e8, 'M3V', 2.10e24, 3330.0, 'ember red', '~5.2 billion years', '+0.04 dex', 1036800.0, 17520.0, 14.6, 0.31, 0.73, 28.0, 41.0, 214.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70102,"activity":0.79,"maps":{}}}'),
	('Glassling', 'glassling', 'myrrh', 'A remote DA4 remnant surrounded by mirrored memorial sails and a thin metal-polluted debris disk.', 1.18e30, 8.80e6, 'DA4', 8.20e23, 10800.0, 'hard blue-white', 'cooling age ~1.6 billion years', NULL, 151200.0, 30300.0, 41.0, 0.42, 0.21, 51.0, 198.0, 33.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"white_dwarf","seed":70302,"activity":0.02,"maps":{}}}'),
	('Second Witness', 'second-witness', 'first-witness', 'An M1 companion whose orbit supplies the second cadence of the triple bench.', 8.16e29, 2.85e8, 'M1V', 8.04e24, 3650.0, 'red-orange', '~8.0 billion years', '-0.09 dex', 1987200.0, 96.2, 0.44, 0.09, 0.49, 13.0, 119.0, 270.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70402,"activity":0.43,"maps":{}}}'),
	('Third Witness', 'third-witness', 'second-witness', 'A small M5 star orbiting Second Witness; its brief red eclipses mark the opening of appellate sessions.', 2.79e29, 1.18e8, 'M5V', 7.66e23, 3050.0, 'deep crimson', '~8.0 billion years', '-0.10 dex', 691200.0, 17.4, 0.112, 0.04, 0.84, 67.0, 7.0, 88.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70403,"activity":0.71,"maps":{}}}'),
	('Absolution', 'absolution', 'mercy', 'The smaller star of the Mercy pair, crossing its companion''s spotted face every 28.4 days.', 7.36e29, 2.54e8, 'M3V', 4.98e24, 3370.0, 'crimson', '~6.4 billion years', '+0.03 dex', 1641600.0, 28.4, 0.219, 0.03, 0.61, 89.1, 232.0, 15.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":70702,"activity":0.52,"maps":{}}}'),
	('Pale Auditor', 'pale-auditor', 'ash-regent', 'A helium-atmosphere white dwarf whose ancient mass transfer complicates the Regent''s future.', 1.24e30, 8.42e6, 'DB3', 1.34e24, 14200.0, 'pale blue', 'cooling age ~540 million years', NULL, 93600.0, 89800.0, 97.0, 0.56, 0.39, 43.0, 164.0, 301.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"white_dwarf","seed":71002,"activity":0.01,"maps":{}}}'),
	('Shuttle', 'shuttle', 'loom-mother', 'A K6 companion carrying the innermost mobile yards around its broad orbit.', 1.19e30, 4.18e8, 'K6V', 3.83e25, 4210.0, 'orange', '~5.7 billion years', '+0.00 dex', 3283200.0, 1906.0, 3.05, 0.18, 0.66, 17.0, 83.0, 149.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":71102,"activity":0.33,"maps":{}}}'),
	('Bobbin', 'bobbin', 'shuttle', 'A tiny M4 companion tightly bound to Shuttle, famous for the shipyard shadows that race across it.', 3.98e29, 1.46e8, 'M4V', 1.15e24, 3180.0, 'deep red', '~5.7 billion years', '-0.02 dex', 864000.0, 9.1, 0.074, 0.02, 0.13, 74.0, 251.0, 62.0, '{"stellarSurface":{"version":2,"fallback":"procedural","morphology":"main_sequence","seed":71103,"activity":0.67,"maps":{}}}')
) AS companions(name, slug, parent_slug, description, mass_kg, radius_m, spectral_type, luminosity_w, temperature_k, color, age, metallicity, rotation_period_s, period_days, axis_au, eccentricity, phase, inclination, node, periapsis, extra);

-- A multi-row INSERT cannot see siblings from the same statement. Resolve the
-- two nested companion edges after all eight companion rows exist.
UPDATE rodder_bodies AS child
SET parent_id = parent.id, updated_at = now()
FROM (VALUES
	('third-witness', 'second-witness'),
	('bobbin', 'shuttle')
) AS edge(child_slug, parent_slug)
JOIN rodder_bodies AS parent ON parent.slug = edge.parent_slug
WHERE child.slug = edge.child_slug;

-- Major worlds and small-body populations. System-parented rows are
-- circumbinary/circumtriple; star-parented rows use a specific host.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, body_type, description, mass_kg, radius_m,
	temperature_k, composition, atmosphere, surface_pressure, orbital_period_days,
	semi_major_axis_au, eccentricity, epoch_phase, inclination,
	longitude_ascending_node, argument_of_periapsis, rotation_period_s, axial_tilt,
	satellites, extra, body, body_plain_text, body_size_bytes, body_updated_at
)
SELECT 'body', name, slug, pg_temp.rid(parent_slug), body_type, description, mass_kg,
	radius_m, temperature_k, composition, atmosphere, surface_pressure, period_days,
	axis_au, eccentricity, phase, inclination, node, periapsis, rotation_s, axial_tilt,
	satellites, extra::jsonb, description, description, octet_length(description), now()
FROM (VALUES
	('Vespera', 'vespera', 'aureole', 'planet', 'The temperate capital world: indigo seas, copper-leaved uplands, and cities built around public receipt halls. Two moons make its legal calendar deliberately awkward.', 6.22e24, 6.48e6, 289.0, 'silicate mantle, iron core, carbonate shelves', 'N2 74%, O2 22%, Ar and H2O 4%', '1.08 bar', 338.0, 0.948, 0.021, 0.14, 2.3, 47.0, 118.0, 92160.0, 21.4, 2, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72101,"coverage":{"surfaceWater":0.67,"vegetation":0.52,"permanentSnowIce":0.07},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.58,"seed":72102}},"setting":{"population":"12.8 billion","status":"Mandate capital"}}'),
	('Blue Treasury', 'blue-treasury', 'aureole', 'planet', 'A cobalt gas giant whose Trojan habitats contain the court''s redundant archives, seed vaults, and emergency regalia.', 2.07e27, 7.21e7, 127.0, 'hydrogen, helium, methane, water-ammonia interior', 'H2 86%, He 12%, CH4 2%', 'not applicable (gas giant)', 4310.0, 5.18, 0.048, 0.37, 1.1, 18.0, 276.0, 37800.0, 17.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":72103,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.93,"seed":72104}}}'),
	('The Testament', 'the-testament', 'aureole', 'asteroid', 'A resonant belt of carbonaceous bodies where the founding compact was hidden in many physically independent copies.', 4.20e21, 5.10e5, 171.0, 'carbonaceous chondrites, hydrated minerals, nickel-iron fragments', NULL, NULL, 1540.0, 2.61, 0.14, 0.77, 5.8, 201.0, 73.0, 43800.0, 8.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72105,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.02},"maps":{}}}'),
	('Calder', 'calder', 'toll', 'planet', 'A tidally locked iron world settled along a copper-green twilight river. Foundries bury their waste heat on the nightside to keep the habitable belt narrow.', 4.01e24, 5.31e6, 301.0, 'iron-rich mantle, silicate crust, sulfide basins', 'N2 61%, CO2 27%, SO2 and Ar 12%', '1.7 bar', 155.0, 0.521, 0.033, 0.48, 0.7, 31.0, 207.0, 13392000.0, 1.2, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72201,"coverage":{"surfaceWater":0.18,"vegetation":0.09,"permanentSnowIce":0.21},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.38,"seed":72202}},"setting":{"population":"5.4 billion"}}'),
	('Resonance', 'resonance', 'toll', 'planet', 'A cream gas giant whose magnetosphere is used as a full-scale proving ground for beacon harmonics.', 1.14e27, 6.20e7, 104.0, 'hydrogen, helium, ammonia and a rocky core', 'H2 89%, He 10%, NH3 traces', 'not applicable (gas giant)', 2270.0, 3.15, 0.067, 0.16, 4.2, 140.0, 19.0, 42120.0, 29.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":72203,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.88,"seed":72204}}}'),
	('Foundry Slag', 'foundry-slag', 'toll', 'asteroid', 'A family of metal-rich sunskimmers, partly natural and partly discarded test masses from the earliest foundries.', 8.30e19, 1.45e5, 612.0, 'nickel-iron, refractory ceramics, cobalt inclusions', 'sodium and iron exosphere', 'negligible', 15.1, 0.112, 0.31, 0.83, 23.0, 77.0, 312.0, 21960.0, 31.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72205,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Mirrormere', 'mirrormere', 'myrrh', 'planet', 'A high-gravity world of shallow violet seas and reflective grass analogues. Its inhabitants navigate by polarized glare and consider shadows private.', 9.42e24, 7.18e6, 294.0, 'dense silicate mantle, iron core, borate-rich seas', 'N2 69%, O2 18%, CO2 7%, noble gases 6%', '2.3 bar', 785.0, 1.80, 0.052, 0.25, 3.4, 216.0, 102.0, 106560.0, 14.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72301,"coverage":{"surfaceWater":0.43,"vegetation":0.61,"permanentSnowIce":0.03},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.31,"seed":72302}},"setting":{"population":"3.2 billion"}}'),
	('Oathbreaker', 'oathbreaker', 'myrrhglass', 'planet', 'A remote ice giant orbiting both stellar remnants of the system''s past. Its discovery disproved the founding survey''s supposedly final boundary.', 7.10e25, 2.61e7, 42.0, 'water, ammonia, methane ices around a rocky core', 'H2 77%, He 15%, CH4 8%', 'not applicable (ice giant)', 175000.0, 78.0, 0.28, 0.69, 38.0, 12.0, 244.0, 61200.0, 97.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":72303,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.76,"seed":72304}}}'),
	('Myrrh Shards', 'myrrh-shards', 'myrrh', 'asteroid', 'Silicate shards on aligned orbits, used as natural spectrograph slits by evidence observatories.', 2.30e21, 4.20e5, 136.0, 'silicates, fused glass, carbon-poor metals', NULL, NULL, 3250.0, 4.65, 0.09, 0.41, 6.0, 303.0, 66.0, 56880.0, 12.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72305,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Jury', 'jury', 'three-witnesses', 'planet', 'A cool circummultiple super-Earth under braided sunsets. Its steppe monasteries host rotating panels of appellate citizens.', 8.15e24, 6.91e6, 281.0, 'silicate mantle, large iron core, continental crust', 'N2 79%, O2 17%, CO2 and Ar 4%', '1.22 bar', 492.0, 1.46, 0.024, 0.54, 1.8, 88.0, 173.0, 88200.0, 28.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72401,"coverage":{"surfaceWater":0.36,"vegetation":0.48,"permanentSnowIce":0.11},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.46,"seed":72402}},"setting":{"population":"2.1 billion"}}'),
	('Tribunal', 'tribunal', 'three-witnesses', 'planet', 'A broad ochre gas giant surrounded by three visually distinct ring bands used as the canton''s heraldic device.', 2.62e27, 7.62e7, 118.0, 'hydrogen, helium, ammonia, silicate-metal core', 'H2 85%, He 14%, NH3 1%', 'not applicable (gas giant)', 3900.0, 5.82, 0.11, 0.09, 7.7, 35.0, 290.0, 34920.0, 8.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":72403,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.97,"seed":72404}}}'),
	('Albedo', 'albedo', 'argent-debt', 'planet', 'A white refractory world whose engineered ceramic plains return a measurable fraction of Argent Debt''s light to the sail-swarms.', 2.82e24, 4.43e6, 972.0, 'alumina ceramics, calcium silicates, iron-poor mantle', 'calcium, oxygen and vaporized silicates', '<0.01 bar', 151.0, 0.70, 0.08, 0.32, 12.0, 260.0, 11.0, 13046400.0, 4.0, 0, '{"surface":{"version":5,"fallback":"flat","class":"rocky","seed":72501,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Heliostat', 'heliostat', 'argent-debt', 'planet', 'A swollen blue-grey gas giant surrounded by power-routing stations and a moon permanently striped by their beam shadows.', 2.48e27, 7.48e7, 244.0, 'hydrogen, helium, metal hydrides and a massive core', 'H2 81%, He 16%, metal hydrides 3%', 'not applicable (gas giant)', 4180.0, 6.40, 0.12, 0.58, 9.1, 191.0, 250.0, 28800.0, 34.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":72502,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.84,"seed":72503}}}'),
	('Burnt Bond', 'burnt-bond', 'argent-debt', 'asteroid', 'A sparse belt of black refractory fragments, collateral left when the first photon-credit swarm failed catastrophically.', 9.80e20, 2.80e5, 538.0, 'carbon, tungsten-rich metal, refractory silicates', NULL, NULL, 788.0, 2.10, 0.23, 0.04, 19.0, 14.0, 199.0, 32160.0, 67.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72504,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Ossuary', 'ossuary', 'sable', 'planet', 'The exposed iron core of a world stripped during Sable''s giant phase. Memorial habitats occupy the deep shadow of its synchronous orbit.', 1.88e24, 3.31e6, 703.0, 'iron-nickel core, carbide crust, refractory inclusions', 'metal vapor', 'negligible', 2.83, 0.032, 0.013, 0.91, 4.0, 49.0, 211.0, 244512.0, 0.1, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72601,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Reliquary', 'reliquary', 'sable', 'planet', 'A frozen terrestrial survivor containing sealed oceans beneath nitrogen glaciers and the canton''s deepest biological tombs.', 5.28e24, 5.88e6, 89.0, 'silicates, water ice, nitrogen glaciers, iron core', 'N2, Ne and trace CH4', '0.06 bar', 235.0, 0.61, 0.019, 0.22, 11.0, 318.0, 57.0, 118800.0, 63.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":72602,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"none","meanCover":null,"seed":null}}}'),
	('Carbon Copy', 'carbon-copy', 'sable', 'asteroid', 'A tight debris ring whose repeating occultations are used to detect timing drift without active radio.', 6.50e20, 2.10e5, 310.0, 'carbon, iron, fragments of differentiated mantle', NULL, NULL, 20.4, 0.119, 0.18, 0.47, 68.0, 92.0, 180.0, 17340.0, 19.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72603,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Kindness', 'kindness', 'red-mercy', 'planet', 'A circumbinary ocean world whose black floating forests store genetic archives in buoyant seed reefs.', 7.56e24, 7.02e6, 277.0, 'deep ocean, silicate core, high-pressure ice mantle', 'N2 68%, CO2 16%, O2 9%, CH4 and H2O 7%', '2.8 bar', 248.0, 0.79, 0.031, 0.38, 0.9, 28.0, 234.0, 99000.0, 16.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72701,"coverage":{"surfaceWater":0.94,"vegetation":0.57,"permanentSnowIce":0.13},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.82,"seed":72702}},"setting":{"population":"4.9 billion"}}'),
	('Severity', 'severity', 'red-mercy', 'planet', 'A dry inner circumbinary world where relief crews train amid real radiation, dust, and life-support scarcity.', 3.50e24, 4.89e6, 466.0, 'basalt, iron oxides, sulfate evaporites', 'CO2 91%, N2 7%, SO2 2%', '0.43 bar', 41.0, 0.237, 0.06, 0.73, 3.2, 111.0, 47.0, 121680.0, 6.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72703,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.08,"seed":72704}}}'),
	('Ledger', 'ledger', 'tally', 'planet', 'A dense super-Earth terraced by mines, audit vaults, and kilometer-deep mass standards cut from undisturbed mantle.', 1.21e25, 7.44e6, 287.0, 'iron-rich mantle, silicate crust, dense metallic core', 'N2 72%, O2 20%, Ar 5%, CO2 3%', '2.0 bar', 229.0, 0.64, 0.044, 0.12, 5.5, 220.0, 98.0, 104400.0, 9.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72801,"coverage":{"surfaceWater":0.29,"vegetation":0.17,"permanentSnowIce":0.04},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.37,"seed":72802}},"setting":{"population":"6.7 billion"}}'),
	('Remainder', 'remainder', 'tally', 'planet', 'A pale gas giant whose rings contain tagged ingots and obsolete coins ceremonially removed from circulation.', 1.70e27, 6.88e7, 91.0, 'hydrogen, helium, ammonia, enriched rocky core', 'H2 87%, He 12%, NH3 1%', 'not applicable (gas giant)', 2900.0, 3.98, 0.087, 0.56, 2.4, 9.0, 181.0, 39600.0, 11.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":72803,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.90,"seed":72804}}}'),
	('Decimal Dust', 'decimal-dust', 'tally', 'asteroid', 'A well-surveyed belt parceled into absurdly precise claims that are continuously redrawn by collisions.', 5.80e21, 5.70e5, 151.0, 'C-type asteroids, nickel-iron, hydrated salts', NULL, NULL, 1170.0, 1.71, 0.16, 0.28, 8.3, 146.0, 327.0, 47280.0, 22.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":72805,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.04},"maps":{}}}'),
	('Virid', 'virid', 'psalm', 'planet', 'A warm superhabitable world where emerald seas, mobile forests, and continent-scale fungal minds hold constitutional seats.', 7.02e24, 6.72e6, 291.0, 'silicate mantle, iron core, organic-rich shallow seas', 'N2 70%, O2 24%, H2O 4%, Ar and trace organics 2%', '1.16 bar', 335.0, 0.91, 0.018, 0.65, 1.1, 73.0, 269.0, 97200.0, 18.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":72901,"coverage":{"surfaceWater":0.58,"vegetation":0.79,"permanentSnowIce":0.02},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.71,"seed":72902}},"setting":{"population":"9.8 billion human; nonhuman constituencies not enumerated"}}'),
	('Pollen Line', 'pollen-line', 'psalm', 'asteroid', 'An ice-rich outer belt seeded with vacuum ecologies that exchange dormant spores along magnetic dust streams.', 7.10e21, 6.30e5, 133.0, 'water ice, carbonaceous rock, engineered dormant biota', 'transient water and organic vapor', 'negligible', 1420.0, 2.31, 0.20, 0.19, 14.0, 286.0, 54.0, 69120.0, 47.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":72903,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'),
	('Cauter', 'cauter', 'ash-regent', 'planet', 'A once-temperate world now warming beneath the giant star. Its migrating cities travel poleward along rails laid generations ahead.', 5.74e24, 6.10e6, 326.0, 'silicate mantle, iron core, evaporite basins', 'N2 63%, CO2 25%, H2O 8%, SO2 and Ar 4%', '1.9 bar', 1320.0, 2.83, 0.071, 0.46, 7.0, 199.0, 113.0, 136800.0, 33.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":73001,"coverage":{"surfaceWater":0.21,"vegetation":0.13,"permanentSnowIce":0.01},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.49,"seed":73002}},"setting":{"population":"2.4 billion; planned relocation active"}}'),
	('Requiem', 'requiem', 'ash-regent', 'planet', 'A vast striped gas giant used as a staging ground for habitats retreating from Ash Regent''s increasing light.', 3.18e27, 8.01e7, 186.0, 'hydrogen, helium, water-ammonia layers, massive core', 'H2 83%, He 15%, H2O and NH3 2%', 'not applicable (gas giant)', 8060.0, 11.1, 0.13, 0.74, 10.0, 21.0, 307.0, 32400.0, 42.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":73003,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.95,"seed":73004}}}'),
	('Funeral Coal', 'funeral-coal', 'ash-regent', 'asteroid', 'A population of carbon-black inner bodies gradually sublimating as the Regent brightens.', 1.40e21, 3.30e5, 610.0, 'carbon, silicates, refractory organics', 'carbon and sodium tails', 'negligible', 121.0, 0.60, 0.37, 0.11, 31.0, 348.0, 88.0, 28800.0, 74.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":73005,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Tapestry', 'tapestry', 'far-loom', 'planet', 'A cold circumsystem terrestrial world beneath three suns, patterned with orbital shipyard lights visible across its nightside ice.', 6.41e24, 6.37e6, 258.0, 'silicates, iron core, extensive water ice and brine seas', 'N2 81%, O2 12%, CO2 5%, Ar 2%', '1.34 bar', 2380.0, 4.92, 0.058, 0.34, 6.6, 158.0, 221.0, 110160.0, 38.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":73101,"coverage":{"surfaceWater":0.48,"vegetation":0.12,"permanentSnowIce":0.39},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.62,"seed":73102}},"setting":{"population":"0.9 billion permanent; 0.6 billion itinerant"}}'),
	('Selvedge', 'selvedge', 'far-loom', 'planet', 'A distant rose gas giant whose broad artificial-and-natural rings serve as raw stock yards for graduating ships.', 1.29e27, 6.54e7, 73.0, 'hydrogen, helium, methane and a water-rich core', 'H2 84%, He 13%, CH4 3%', 'not applicable (gas giant)', 11200.0, 13.5, 0.09, 0.81, 15.0, 297.0, 40.0, 41400.0, 26.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"gas","seed":73103,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.86,"seed":73104}}}'),
	('Loose Thread', 'loose-thread', 'bobbin', 'asteroid', 'A shepherded rubble swarm around the tertiary star Bobbin, used to rehearse close-quarters construction.', 3.90e19, 9.80e4, 211.0, 'silicates, nickel-iron, tagged construction scrap', NULL, NULL, 42.0, 0.141, 0.22, 0.52, 33.0, 65.0, 282.0, 16200.0, 119.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":73105,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Palimpsest', 'palimpsest', 'unwritten', 'planet', 'A cold, rust-red world covered in synchronized crystalline ruins whose inscription panels formed naturally blank.', 5.11e24, 5.91e6, 246.0, 'iron-rich silicates, crystalline carbonates, buried water ice', 'N2 82%, CO2 14%, Ar 4%', '0.71 bar', 83.0, 0.283, 0.029, 0.07, 4.9, 179.0, 320.0, 100800.0, 54.0, 1, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":73201,"coverage":{"surfaceWater":0.09,"vegetation":0,"permanentSnowIce":0.46},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.24,"seed":73202}},"setting":{"population":"0.63 billion","mystery":"synchronized pre-arrival ruins"}}'),
	('Null Margins', 'null-margins', 'unwritten', 'asteroid', 'A distant belt with unexplained clean gaps aligned to blank architectural panels on Palimpsest.', 3.20e21, 4.70e5, 62.0, 'water ice, silicates, complex carbon compounds', NULL, NULL, 873.0, 1.42, 0.26, 0.63, 27.0, 104.0, 9.0, 58320.0, 83.0, 0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":73203,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}')
) AS worlds(name, slug, parent_slug, body_type, description, mass_kg, radius_m, temperature_k, composition, atmosphere, surface_pressure, period_days, axis_au, eccentricity, phase, inclination, node, periapsis, rotation_s, axial_tilt, satellites, extra);

-- An unbound inhabited world exercises a non-system sector root with orbital
-- descendants and no invented stellar parent.
INSERT INTO rodder_bodies (
	kind, name, slug, body_type, description, mass_kg, radius_m, temperature_k,
	composition, atmosphere, surface_pressure, rotation_period_s, axial_tilt,
	satellites, extra, body, body_plain_text, body_size_bytes, body_updated_at
) VALUES (
	'body', 'Saint Orra', 'saint-orra', 'planet',
	'A rogue ice giant warmed from within, carrying the monastic city-chain Pilgrim and a dim artificial ring. It drifts Crownward through the Expanse without a parent star and is recognized as the itinerant Thirteenth Canton.',
	9.40e25, 2.91e7, 61.0, 'water-ammonia mantle, rocky core, hydrogen envelope',
	'H2 74%, He 18%, CH4 5%, NH3 3%', 'not applicable (ice giant)', 61200.0, 82.0, 1,
	'{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":73301,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.69,"seed":73302}},"setting":{"canton":"Itinerant Thirteenth Canton","population":"0.21 billion","heatSource":"primordial and tidal heat; artificial illumination explicit"}}'::jsonb,
	$wiki$== A canton without sunrise ==
Saint Orra was already inhabited when the first Mandate survey found it. Its people claimed descent from a convoy whose records describe stars that do not match the present sky. They joined the empire only after the compact was amended to say that a canton is a community under a declared horizon, not a star system.

Most citizens live on Pilgrim, a tidally heated moon webbed with buried seas and fusion-lit cloisters. The Dark Halo is an artificial ring of carbon vanes, radiators, and patient lamps; from the cloud tops it resembles a sunrise too thin to warm anything.$wiki$,
	'A canton without sunrise. Saint Orra was already inhabited when the first Mandate survey found it. Most citizens live on Pilgrim, a tidally heated moon webbed with buried seas and fusion-lit cloisters.',
	octet_length($wiki$== A canton without sunrise ==
Saint Orra was already inhabited when the first Mandate survey found it. Its people claimed descent from a convoy whose records describe stars that do not match the present sky. They joined the empire only after the compact was amended to say that a canton is a community under a declared horizon, not a star system.

Most citizens live on Pilgrim, a tidally heated moon webbed with buried seas and fusion-lit cloisters. The Dark Halo is an artificial ring of carbon vanes, radiators, and patient lamps; from the cloud tops it resembles a sunrise too thin to warm anything.$wiki$), now()
);

-- Moons and explicitly versioned ring-system facets.
INSERT INTO rodder_bodies (
	kind, name, slug, parent_id, body_type, description, mass_kg, radius_m,
	temperature_k, composition, atmosphere, surface_pressure, orbital_period_days,
	semi_major_axis_au, eccentricity, epoch_phase, inclination,
	longitude_ascending_node, argument_of_periapsis, rotation_period_s, axial_tilt,
	satellites, extra, body, body_plain_text, body_size_bytes, body_updated_at
)
SELECT 'body', name, slug, pg_temp.rid(parent_slug), body_type, description,
	mass_kg, radius_m, temperature_k, composition, atmosphere, surface_pressure,
	period_days, axis_au, eccentricity, phase, inclination, node, periapsis,
	rotation_s, axial_tilt, 0, extra::jsonb, description, description,
	octet_length(description), now()
FROM (VALUES
	('Little Crown', 'little-crown', 'vespera', 'planet', 'Vespera''s bright major moon, home to the official master clocks despite repeated proposals to move them somewhere less symbolically obvious.', 8.30e22, 1.81e6, 220.0, 'silicates, anorthosite, polar water ice', 'trace argon and sodium', 'negligible', 18.4, 0.00212, 0.017, 0.42, 5.1, 99.0, 13.0, 1589760.0, 2.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74101,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.08},"maps":{}}}'),
	('Thronefall', 'thronefall', 'vespera', 'asteroid', 'A captured black moon in a steep retrograde orbit; every eclipse recalls the deposition of the first hereditary court.', 9.10e19, 1.42e5, 164.0, 'carbonaceous chondrite and hydrated salts', NULL, NULL, 63.2, 0.00487, 0.21, 0.88, 147.0, 17.0, 203.0, 5457600.0, 12.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74102,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.15},"maps":{}}}'),
	('Indemnity', 'indemnity', 'blue-treasury', 'planet', 'A storm-scoured moon whose subsurface vaults hold seeds, treaty copies, and deliberately obsolete encryption keys.', 7.70e22, 1.62e6, 118.0, 'water ice, silicates, ammonia brine', 'trace water vapor', 'negligible', 7.8, 0.00078, 0.008, 0.33, 0.9, 42.0, 218.0, 673920.0, 0.5, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":74103,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'),
	('Hammerfall', 'hammerfall', 'calder', 'planet', 'A small dense moon used for destructive material tests; the largest craters are preserved as labor memorials.', 4.80e21, 6.30e5, 181.0, 'iron, basalt, sulfides', NULL, NULL, 9.6, 0.00109, 0.026, 0.18, 2.8, 251.0, 77.0, 829440.0, 6.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74201,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Peal', 'peal', 'resonance', 'planet', 'An icy moon whose conductive ocean rings like a damped bell in magnetometric surveys.', 3.20e22, 1.28e6, 92.0, 'water ice, brine ocean, silicate core', 'trace water vapor and oxygen', 'negligible', 5.1, 0.00062, 0.004, 0.57, 1.1, 114.0, 8.0, 440640.0, 0.8, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":74202,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'),
	('Hushglass', 'hushglass', 'mirrormere', 'planet', 'A dark moon where polarized crystal forests grow slowly in vacuum and are harvested only after natural collapse.', 1.10e22, 8.90e5, 171.0, 'silicates, glassy carbonates, polar ice', 'trace sodium', 'negligible', 21.7, 0.00176, 0.03, 0.61, 8.0, 44.0, 298.0, 1874880.0, 9.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74301,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.18},"maps":{}}}'),
	('Dissent', 'dissent', 'jury', 'planet', 'A grey moon whose sealed vaults preserve minority opinions until their scheduled century of reconsideration.', 5.50e22, 1.47e6, 192.0, 'silicates, iron core, water ice', 'trace argon', 'negligible', 24.0, 0.00205, 0.011, 0.77, 4.3, 181.0, 26.0, 2073600.0, 3.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74401,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.26},"maps":{}}}'),
	('Receipt', 'receipt', 'heliostat', 'planet', 'A pale moon permanently banded by the moving shadows of the Debt''s power-routing mirrors.', 6.60e22, 1.55e6, 190.0, 'silicates, water ice, implanted carbon', 'trace oxygen and sodium', 'negligible', 11.2, 0.00113, 0.015, 0.29, 3.4, 63.0, 185.0, 967680.0, 1.1, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74501,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.04},"maps":{}}}'),
	('Clemency', 'clemency', 'kindness', 'planet', 'A large tidal moon that organizes Kindness''s floating forests into migration gyres visible from orbit.', 2.40e23, 2.32e6, 178.0, 'silicates, water ice, iron-poor core', 'N2 and trace water vapor', '0.002 bar', 27.3, 0.00223, 0.02, 0.10, 7.1, 311.0, 54.0, 2358720.0, 4.0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":74701,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'),
	('Halfpenny', 'halfpenny', 'ledger', 'planet', 'A tiny moon containing the original platinum-iridium fraction standards and a parliament for neglected obligations.', 7.20e20, 3.90e5, 201.0, 'nickel-iron, basalt, sealed metrology vaults', NULL, NULL, 6.25, 0.00071, 0.009, 0.50, 2.0, 22.0, 209.0, 540000.0, 0.7, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":74801,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}}}'),
	('Amen', 'amen', 'virid', 'planet', 'Virid''s wet grey moon, protected as nesting ground for migratory vacuum organisms from the Pollen Line.', 9.10e22, 1.77e6, 209.0, 'silicates, water ice, organic-rich regolith', 'thin N2, O2 and water vapor', '0.011 bar', 16.1, 0.00157, 0.008, 0.26, 2.9, 139.0, 67.0, 1391040.0, 5.0, '{"surface":{"version":5,"fallback":"procedural","class":"terrestrial","seed":74901,"coverage":{"surfaceWater":0.24,"vegetation":0.08,"permanentSnowIce":0.41},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.19,"seed":74902}}}'),
	('Coda', 'coda', 'requiem', 'planet', 'A geologically active moon whose fault-line cities rehearse independent fragments of the Great Departure.', 6.90e23, 2.96e6, 279.0, 'basalt, iron sulfides, partially molten mantle', 'SO2 64%, CO2 29%, sulfur aerosols 7%', '0.21 bar', 8.9, 0.00102, 0.022, 0.69, 1.7, 204.0, 93.0, 768960.0, 1.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":75001,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.28,"seed":75002}}}'),
	('Knot', 'knot', 'tapestry', 'planet', 'A captured irregular moon wrapped in shipyard tethers, proving grounds, and temporary neighborhoods.', 8.40e20, 4.60e5, 144.0, 'carbonaceous rock, water ice, construction composites', NULL, NULL, 38.2, 0.00308, 0.27, 0.87, 129.0, 28.0, 317.0, 3300480.0, 32.0, '{"surface":{"version":5,"fallback":"procedural","class":"rocky","seed":75101,"coverage":{"surfaceWater":0,"vegetation":0,"permanentSnowIce":0.23},"maps":{}}}'),
	('Lacuna', 'lacuna', 'palimpsest', 'planet', 'A smooth ice moon with one rectangular equatorial basin that aligns with no present tidal axis.', 4.40e22, 1.34e6, 112.0, 'water ice, ammonia brine, silicate core', 'trace water vapor', 'negligible', 12.7, 0.00108, 0.005, 0.43, 0.4, 277.0, 1.0, 1097280.0, 0.3, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":75201,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}}}'),
	('Pilgrim', 'pilgrim', 'saint-orra', 'planet', 'A tidally heated ice moon holding a global brine ocean and most of the Thirteenth Canton''s fusion-lit cloisters.', 1.18e23, 1.92e6, 154.0, 'water ice, ammonia brine ocean, silicate core', 'N2, water vapor and trace ammonia', '0.04 bar', 9.4, 0.00132, 0.014, 0.22, 5.6, 117.0, 43.0, 812160.0, 2.0, '{"surface":{"version":5,"fallback":"procedural","class":"ice","seed":75301,"coverage":{"surfaceWater":null,"vegetation":null,"permanentSnowIce":null},"maps":{}},"weather":{"version":1,"clouds":{"mode":"procedural","meanCover":0.16,"seed":75302}},"setting":{"illumination":"fusion lamps and reflected thermal glow; no host star"}}'),
	('Charter Rings', 'charter-rings', 'blue-treasury', 'ring_system', 'Three rings of ice, carbon, and archive-marker foil, each named for a revision of the founding compact.', NULL, NULL, 92.0, 'water ice, carbon dust, marker foil', NULL, NULL, 0.72, 0.00018, 0.009, 0.31, 0.2, 10.0, 80.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"captured-debris","bands":[{"name":"Preamble","innerRadiusM":91000000,"outerRadiusM":108000000,"color":"ivory","opacity":0.52,"opticalDepth":0.31,"composition":"water ice and silicate dust","provenance":"authored"},{"name":"Amendments","innerRadiusM":116000000,"outerRadiusM":142000000,"color":"charcoal","opacity":0.33,"opticalDepth":0.14,"composition":"carbonaceous dust","provenance":"authored"},{"name":"Receipts","innerRadiusM":151000000,"outerRadiusM":178000000,"color":"pale gold","opacity":0.21,"composition":"ice and archive-marker foil","provenance":"illustrative"}]}}'),
	('Tribunal Rings', 'tribunal-rings', 'tribunal', 'ring_system', 'The black, ochre, and white bands of Tribunal, culturally read as intent, consequence, and evidence.', NULL, NULL, 99.0, 'ice, silicates, carbonaceous dust', NULL, NULL, 0.59, 0.00016, 0.006, 0.18, 0.4, 71.0, 201.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"tidal-disruption","bands":[{"name":"Intent","innerRadiusM":98000000,"outerRadiusM":121000000,"color":"charcoal","opacity":0.38,"opticalDepth":0.22,"composition":"carbonaceous dust","provenance":"authored"},{"name":"Consequence","innerRadiusM":129000000,"outerRadiusM":163000000,"color":"ochre","opacity":0.55,"opticalDepth":0.44,"composition":"iron-rich silicate and ice","provenance":"authored"},{"name":"Evidence","innerRadiusM":169000000,"outerRadiusM":207000000,"color":"white","opacity":0.71,"opticalDepth":0.66,"composition":"clean water ice","provenance":"authored"}]}}'),
	('Tithe Rings', 'tithe-rings', 'remainder', 'ring_system', 'A pale natural ring seeded with tagged ingots and withdrawn coinage during each decennial settlement.', NULL, NULL, 77.0, 'water ice, silicates, tagged refined metal', NULL, NULL, 0.66, 0.00017, 0.012, 0.48, 0.7, 123.0, 16.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"captured-debris","bands":[{"name":"Principal","innerRadiusM":86000000,"outerRadiusM":111000000,"color":"pearl","opacity":0.48,"opticalDepth":0.28,"composition":"water ice and silicate dust","provenance":"authored"},{"name":"Interest","innerRadiusM":118000000,"outerRadiusM":151000000,"color":"silver","opacity":0.26,"composition":"ice, nickel-iron, tagged ingots","provenance":"authored"}]}}'),
	('Ash Veil', 'ash-veil', 'requiem', 'ring_system', 'A dark dusty ring fed by captured Funeral Coal fragments and carefully monitored as a future construction reserve.', NULL, NULL, 149.0, 'carbon dust, silicates, water ice', NULL, NULL, 0.81, 0.00021, 0.031, 0.67, 1.1, 303.0, 101.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"captured-debris","bands":[{"name":"Mourning","innerRadiusM":103000000,"outerRadiusM":146000000,"color":"soot black","opacity":0.44,"opticalDepth":0.36,"composition":"carbon dust and silicate grains","provenance":"authored"},{"name":"Departure","innerRadiusM":158000000,"outerRadiusM":226000000,"color":"rust grey","opacity":0.19,"composition":"ice and captured refractory fragments","provenance":"derived"}]}}'),
	('Loom Rings', 'loom-rings', 'selvedge', 'ring_system', 'Alternating natural ice bands and artificial stock lanes from which Far Loom''s ships are woven.', NULL, NULL, 58.0, 'water ice, organics, construction stock and habitat modules', NULL, NULL, 0.75, 0.00019, 0.018, 0.25, 2.2, 199.0, 72.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"artificial","bands":[{"name":"Warp","innerRadiusM":84000000,"outerRadiusM":106000000,"color":"rose-grey","opacity":0.35,"composition":"natural ice and organic tholins","provenance":"authored"},{"name":"Weft","innerRadiusM":114000000,"outerRadiusM":152000000,"color":"copper","opacity":0.31,"composition":"tagged construction stock","provenance":"authored"},{"name":"Selvedge","innerRadiusM":161000000,"outerRadiusM":214000000,"color":"ice blue","opacity":0.42,"opticalDepth":0.27,"composition":"water ice and mobile yard modules","provenance":"authored"}]}}'),
	('The Dark Halo', 'dark-halo', 'saint-orra', 'ring_system', 'An artificial ring of carbon vanes, heat radiators, fusion lamps, and docking shrines: Saint Orra''s deliberately thin imitation of dawn.', NULL, NULL, 44.0, 'carbon composite, superconductors, radiator foil, inhabited modules', NULL, NULL, 0.84, 0.00023, 0.004, 0.76, 0.0, 0.0, 0.0, NULL, NULL, '{"ringSystem":{"schemaVersion":1,"plane":"parent-equatorial","origin":"artificial","bands":[{"name":"Vigil","innerRadiusM":41000000,"outerRadiusM":47000000,"color":"charcoal","opacity":0.24,"composition":"carbon vanes and heat radiators","provenance":"authored"},{"name":"Matins","innerRadiusM":50500000,"outerRadiusM":59000000,"color":"warm white","opacity":0.18,"composition":"fusion lamps and inhabited modules","provenance":"authored"}]}}')
) AS children(name, slug, parent_slug, body_type, description, mass_kg, radius_m, temperature_k, composition, atmosphere, surface_pressure, period_days, axis_au, eccentricity, phase, inclination, node, periapsis, rotation_s, axial_tilt, extra);

-- Explicit sector membership. Distances stored on system rows are the lengths
-- of these authored vectors to display precision.
INSERT INTO rodder_sector_roots (
	sector_id, body_id, x, y, z, position_provenance, position_uncertainty, notes
) VALUES
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('aureate-court'), 0.0, 0.0, 0.0, 'authored', 0.0, 'Definition of the object-centred frame origin.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('bellfoundry'), 6.8, -4.1, 1.6, 'authored', 0.02, 'Beacon-parallax solution, Mandate Synchrony 742.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('myrrhglass'), -9.2, 3.7, -2.4, 'authored', 0.04, 'System barycentre; Glassling orbital uncertainty included.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('three-witnesses'), 12.4, 7.8, 4.5, 'authored', 0.03, 'Triple-system barycentre.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('lanterns-debt'), -15.1, -6.3, 7.2, 'authored', 0.05, 'Photocentre corrected for sail-swarm glare.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('sable-quiet'), 4.2, 14.6, -5.7, 'authored', 0.01, 'White-dwarf centre; debris occultations excluded.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('red-mercy'), -3.8, -13.9, -1.2, 'authored', 0.03, 'Close-binary barycentre.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('tithe'), 17.2, -8.5, -7.1, 'authored', 0.02, 'Eighth Canton audit baseline.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('green-psalm'), -19.4, 11.3, 2.8, 'authored', 0.04, 'Corrected for Pollen Line dust scattering.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('ash-choir'), 8.9, 19.1, 8.4, 'authored', 0.06, 'Binary barycentre; giant photocentre varies.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('far-loom'), -24.0, -12.8, -9.3, 'authored', 0.08, 'Nested-triple barycentre and mobile-yard correction.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('unwritten-gate'), 25.1, 4.2, -11.5, 'authored', 0.07, 'Boundary survey solution.'),
	((SELECT id FROM rodder_sectors WHERE slug='vesperine-expanse'), pg_temp.rid('saint-orra'), 1.7, -22.0, 12.2, 'approximate', 0.18, 'Position valid only at Synchrony 742.000; Saint Orra is an unpropagated moving rogue world.');

UPDATE rodder_sectors
SET origin_kind = 'object-centred', origin_body_id = pg_temp.rid('aureate-court'), updated_at = now()
WHERE slug = 'vesperine-expanse';

-- Two different inhabited-world calendars exercise local day lengths, moon
-- cycles, seasons, and non-primary calendars without implying universality.
INSERT INTO calendars (name, slug, description, is_primary, planet_id, static_data, body, body_plain_text, body_size_bytes, body_updated_at)
VALUES
(
	'Vesperan Horizon Reckoning', 'vesperan-horizon-reckoning',
	'The court calendar of Vespera, used to date authority cones and diplomatic receipts.', true, pg_temp.rid('vespera'),
	'{"first_week_day":0,"weekdays":[{"name":"Seal","abbreviation":"Se"},{"name":"Send","abbreviation":"Sn"},{"name":"Flight","abbreviation":"Fl"},{"name":"Arrival","abbreviation":"Ar"},{"name":"Receipt","abbreviation":"Rc"},{"name":"Rest","abbreviation":"Rs"}],"months":[{"name":"First Horizon","short_name":"First","length":26,"month_type":"regular"},{"name":"Censer","short_name":"Censer","length":26,"month_type":"regular"},{"name":"Countersign","short_name":"Counter","length":26,"month_type":"regular"},{"name":"Blue Vault","short_name":"Vault","length":26,"month_type":"regular"},{"name":"High Crown","short_name":"Crown","length":26,"month_type":"regular"},{"name":"Testament","short_name":"Test","length":26,"month_type":"regular"},{"name":"Long Reply","short_name":"Reply","length":26,"month_type":"regular"},{"name":"Copperleaf","short_name":"Copper","length":26,"month_type":"regular"},{"name":"Thronefall","short_name":"Fall","length":26,"month_type":"regular"},{"name":"Open Hand","short_name":"Hand","length":26,"month_type":"regular"},{"name":"Indemnity","short_name":"Indem","length":26,"month_type":"regular"},{"name":"Last Light","short_name":"Last","length":26,"month_type":"regular"},{"name":"Interregnum","short_name":"Inter","length":26,"month_type":"regular"}],"leap_days":[],"moons":[{"name":"Little Crown","cycle":18.4,"offset":3.2,"face_color":"#d8d0b8","shadow_color":"#343341"},{"name":"Thronefall","cycle":63.2,"offset":41.0,"face_color":"#514b49","shadow_color":"#17161d"}],"eras":[{"name":"Mandate Synchrony","start_year":0,"format":"MS","reverse_numbering":false}],"seasons":[{"name":"Near Night","kind":"winter","color":"#667a96","timing":{"type":"dated","month":0,"day":1}},{"name":"Copper Rise","kind":"spring","color":"#76a38f","timing":{"type":"dated","month":3,"day":8}},{"name":"High Crown","kind":"summer","color":"#c7a25c","timing":{"type":"dated","month":6,"day":14}},{"name":"Long Reply","kind":"autumn","color":"#9b6b57","timing":{"type":"dated","month":9,"day":20}}],"display_moons":true,"year_offset":0,"epoch_offset":0,"day_length_seconds":92160}'::jsonb,
	'The Vesperan court calendar divides its exact 338-day year into thirteen equal months. Legal documents also carry a light-cone radius, so a date alone never states where a law is in force.',
	'The Vesperan court calendar divides its exact 338-day year into thirteen equal months. Legal documents also carry a light-cone radius.', 187, now()
),
(
	'Kindness Tide Count', 'kindness-tide-count',
	'A circumbinary civil and ecological calendar organized around Clemency tides and paired-sun eclipses.', false, pg_temp.rid('kindness'),
	'{"first_week_day":0,"weekdays":[{"name":"Flood","abbreviation":"Fd"},{"name":"Raft","abbreviation":"Rf"},{"name":"Root","abbreviation":"Rt"},{"name":"Dive","abbreviation":"Dv"},{"name":"Rise","abbreviation":"Rs"}],"months":[{"name":"Black Bloom","short_name":"Bloom","length":31,"month_type":"regular"},{"name":"Clemency Rising","short_name":"Rising","length":31,"month_type":"regular"},{"name":"First Mercy","short_name":"Mercy","length":31,"month_type":"regular"},{"name":"Deep Seed","short_name":"Seed","length":31,"month_type":"regular"},{"name":"Red Conjunction","short_name":"Red","length":31,"month_type":"regular"},{"name":"Long Gyre","short_name":"Gyre","length":31,"month_type":"regular"},{"name":"Second Mercy","short_name":"Second","length":31,"month_type":"regular"},{"name":"Clemency Falling","short_name":"Falling","length":31,"month_type":"regular"}],"leap_days":[],"moons":[{"name":"Clemency","cycle":27.3,"offset":7.0,"face_color":"#a8afb5","shadow_color":"#242933"}],"eras":[{"name":"Relief Compact","start_year":0,"format":"RC","reverse_numbering":false}],"seasons":[{"name":"Gathering","kind":"spring","color":"#507b68","timing":{"type":"dated","month":0,"day":1}},{"name":"Black Bloom","kind":"summer","color":"#40513f","timing":{"type":"dated","month":2,"day":1}},{"name":"Great Dive","kind":"autumn","color":"#624f58","timing":{"type":"dated","month":4,"day":1}},{"name":"Red Quiet","kind":"winter","color":"#5b6683","timing":{"type":"dated","month":6,"day":1}}],"display_moons":true,"year_offset":0,"epoch_offset":0,"day_length_seconds":99000}'::jsonb,
	'Kindness counts eight 31-day months. Ocean ecologists publish a separate living almanac because raft migrations follow tides and binary eclipses more closely than civil seasons.',
	'Kindness counts eight 31-day months, with a separate living almanac for raft migrations, tides, and binary eclipses.', 119, now()
);

-- A navigable setting overview also exercises the wiki parser and both map
-- embed contracts against the freshly seeded data.
INSERT INTO content_records (domain, slug, title, content, plain_text, size_bytes)
SELECT 'know', 'vesperine-mandate', 'The Vesperine Mandate', article, plain_text, octet_length(article)
FROM (VALUES (
	$wiki$The '''Vesperine Mandate''' is a thirteen-canton stellar empire in the [[Rodder:vesperine-expanse|Vesperine Expanse]]. It was designed around a fact earlier governments treated as an inconvenience: news, law, rescue, and blame all take time to cross interstellar space.

{{Sector map|vesperine-expanse|labels=major|selected=aureate-court}}

== Government ==
The Chamber of Horizons on [[Rodder:vespera|Vespera]] issues every decree with a date, provenance chain, and authority radius. Inside that light cone the decree is current law; outside it, the latest locally receipted compact remains valid. Each canton keeps an '''Hourkeeper''', not to enforce one clock, but to certify which version of the shared present has actually arrived.

The twelve stellar cantons owe constitutional duties rather than tribute alone: [[Rodder:bellfoundry|Bellfoundry]] maintains beacons, [[Rodder:myrrhglass|Myrrhglass]] reconstructs evidence, [[Rodder:three-witnesses|the Three Witnesses]] hears appeals, [[Rodder:red-mercy|Red Mercy]] preserves biospheres, and [[Rodder:far-loom|Far Loom]] builds the ships that keep delay from becoming abandonment. [[Rodder:saint-orra|Saint Orra]], a starless rogue world, is the itinerant Thirteenth Canton.

== The War of Premature Obedience ==
The Mandate began after three fleets obeyed three authentic but differently dated copies of one order. None had been forged. Each commander was legally correct in a different present, and two inhabited moons were lost while the capital argued about which timestamp should count as reality. The settlement that followed abolished instantaneous sovereignty as a legal fiction.

== The Unwritten Problem ==
On [[Rodder:palimpsest|Palimpsest]], synchronized ruins predate every accepted settlement. Their panels were not erased; they crystallized blank. The alignments recur in the Null Margins belt and, controversially, in the changing gaps of several ring systems. The Mandate funds investigation but forbids courts from treating the pattern as prophecy.

== Capital system ==
{{Root map|aureate-court|labels=all|trails=short|visibility=enhanced}}

[[Category:Celestial settings]]
[[Category:Vesperine Mandate]]$wiki$,
	'The Vesperine Mandate is a thirteen-canton stellar empire designed around the finite travel time of news, law, rescue, and blame. Its twelve stellar cantons owe constitutional duties, while the rogue world Saint Orra is the itinerant Thirteenth Canton. The empire began after the War of Premature Obedience and continues to investigate the synchronized blank ruins of Palimpsest.'
)) AS overview(article, plain_text);

INSERT INTO content_categories (content_record_id, category)
SELECT id, category FROM content_records
CROSS JOIN (VALUES ('Celestial settings'), ('Vesperine Mandate')) AS categories(category)
WHERE domain = 'know' AND slug = 'vesperine-mandate';

INSERT INTO entity_categories (entity_type, entity_id, category)
SELECT 'system', id, 'Vesperine Mandate' FROM rodder_bodies WHERE kind = 'system'
UNION ALL
SELECT 'body', id, 'Inhabited worlds' FROM rodder_bodies
WHERE slug IN ('vespera', 'calder', 'mirrormere', 'jury', 'kindness', 'ledger', 'virid', 'cauter', 'tapestry', 'palimpsest', 'saint-orra', 'pilgrim')
UNION ALL
SELECT 'body', id, 'Ring systems' FROM rodder_bodies WHERE body_type = 'ring_system';

-- Strong fixture assertions: exact cardinalities, hierarchy integrity, valid
-- root placement, and parseable ring contracts. Any regression aborts both
-- seed and wipe.
DO $verify$
DECLARE
	sector_count integer;
	root_count integer;
	system_count integer;
	star_count integer;
	body_count integer;
	ring_count integer;
	orphan_count integer;
	bad_root_count integer;
	bad_ring_count integer;
BEGIN
	SELECT count(*) INTO sector_count FROM rodder_sectors;
	SELECT count(*) INTO root_count FROM rodder_sector_roots;
	SELECT count(*) INTO system_count FROM rodder_bodies WHERE kind = 'system';
	SELECT count(*) INTO star_count FROM rodder_bodies WHERE kind = 'star';
	SELECT count(*) INTO body_count FROM rodder_bodies WHERE kind = 'body';
	SELECT count(*) INTO ring_count FROM rodder_bodies WHERE body_type = 'ring_system';
	SELECT count(*) INTO orphan_count
	FROM rodder_bodies b
	WHERE b.parent_id IS NULL
		AND NOT EXISTS (SELECT 1 FROM rodder_sector_roots r WHERE r.body_id = b.id);
	SELECT count(*) INTO bad_root_count
	FROM rodder_sector_roots r
	JOIN rodder_bodies b ON b.id = r.body_id
	WHERE b.parent_id IS NOT NULL OR r.x IS NULL OR r.y IS NULL OR r.z IS NULL;
	SELECT count(*) INTO bad_ring_count
	FROM rodder_bodies b
	WHERE b.body_type = 'ring_system'
		AND (b.parent_id IS NULL
			OR b.extra->'ringSystem'->>'schemaVersion' <> '1'
			OR b.extra->'ringSystem'->>'plane' <> 'parent-equatorial'
			OR jsonb_array_length(b.extra->'ringSystem'->'bands') = 0);

	IF sector_count <> 1 OR root_count <> 13 OR system_count <> 12
		OR star_count <> 20 OR body_count <> 54 OR ring_count <> 6
		OR orphan_count <> 0 OR bad_root_count <> 0 OR bad_ring_count <> 0 THEN
		RAISE EXCEPTION 'Unexpected fixture: sectors %, roots %, systems %, stars %, bodies %, rings %, orphans %, bad roots %, bad rings %',
			sector_count, root_count, system_count, star_count, body_count, ring_count,
			orphan_count, bad_root_count, bad_ring_count;
	END IF;

	IF (SELECT count(*) FROM users) < 1 OR (SELECT count(*) FROM accounts) < 1 THEN
		RAISE EXCEPTION 'Preserved auth core is unexpectedly empty';
	END IF;
END
$verify$;

COMMIT;
