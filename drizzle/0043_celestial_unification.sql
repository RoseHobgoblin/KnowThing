-- ============================================================================
-- Celestial unification: collapse star_systems / stars / planetary_bodies
-- into one celestial_bodies table.
--
--   kind:      'system' | 'star' | 'body'
--   parent_id: single hierarchy edge (star -> system|star, body -> star|body)
--
-- Dynamical role (planet vs moon vs companion) is derived from the parent's
-- kind at model time and is NOT stored. body_type remains a descriptive class
-- on kind='body' rows.
--
-- The whole file runs as one sql.unsafe() call => one implicit transaction;
-- any RAISE EXCEPTION below rolls back everything, including the renames.
--
-- Old tables are RENAMED to *_legacy (not dropped) so a missed raw-SQL
-- reference fails loudly. A later cleanup migration drops the _legacy tables,
-- celestial_id_map, and the legacy_kind/legacy_id audit columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS celestial_bodies (
	id                 serial primary key,
	kind               text not null,
	name               text not null,
	slug               text unique not null,
	page_slug          text,
	parent_id          integer references celestial_bodies(id) on delete set null,

	-- shared physical / observational
	mass_kg            double precision,
	radius_m           double precision,
	age                text,
	apparent_magnitude text,
	angular_diameter   text,

	-- orbital (stars in multiples, bodies)
	orbital_period_days double precision,
	semi_major_axis_au  double precision,
	eccentricity        double precision,
	epoch_phase         double precision default 0,
	inclination         double precision,

	-- rotation
	rotation_period_s  double precision,
	axial_tilt         double precision,

	-- star-only
	spectral_type      text,
	luminosity_w       double precision,
	luminosity_visual  text,
	temperature_k      double precision,
	color              text,
	metallicity        text,
	companion          text,
	absolute_magnitude text,

	-- body-only
	body_type          text,
	temperature        text,
	composition        text,
	atmosphere         text,
	surface_pressure   text,
	albedo             text,
	satellites         integer,
	has_rings          boolean default false,

	-- system-only
	system_type        text,
	distance_ly        double precision,
	galactic_x         double precision,
	galactic_y         double precision,
	galactic_z         double precision,
	formation_age      text,
	designations       text,

	-- migration audit (dropped by the cleanup migration)
	legacy_kind        text,
	legacy_id          integer,

	extra              jsonb default '{}'::jsonb,
	description        text default '',
	body               text not null default '',
	body_parsed_ast    jsonb,
	body_plain_text    text not null default '',
	body_size_bytes    integer not null default 0,
	body_updated_at    timestamptz,
	created_at         timestamptz not null default now(),
	updated_at         timestamptz not null default now(),

	CONSTRAINT chk_celestial_kind CHECK (kind IN ('system', 'star', 'body')),
	CONSTRAINT chk_celestial_system_no_parent CHECK (kind <> 'system' OR parent_id IS NULL),
	CONSTRAINT chk_celestial_body_type CHECK ((kind = 'body') = (body_type IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_celestial_bodies_slug ON celestial_bodies (slug);
CREATE INDEX IF NOT EXISTS idx_celestial_bodies_parent ON celestial_bodies (parent_id);
CREATE INDEX IF NOT EXISTS idx_celestial_bodies_kind_parent ON celestial_bodies (kind, parent_id);

-- ----------------------------------------------------------------------------
-- 2. Id map. `kind` uses the OLD labels ('system'|'star'|'planet') so it joins
--    directly against persisted reference rows (content_links.source_kind,
--    entity_revisions.entity_type, entity_categories.entity_type).
--    Kept until the cleanup migration for post-deploy auditing.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS celestial_id_map (
	kind     text not null,
	old_id   integer not null,
	new_id   integer,
	old_slug text not null,
	new_slug text not null,
	renamed  boolean not null default false,
	PRIMARY KEY (kind, old_id)
);

-- ----------------------------------------------------------------------------
-- 3. Slug collision resolution. Slugs were unique per-table; the merged table
--    has one namespace. Winner priority: system > star > body (then lower id).
--    Losers get '-star'/'-body' etc.; a second pass appends '-<old_id>' if the
--    suffixed slug still collides. The final UNIQUE constraint is the backstop.
--
--    NOTE: content_links.target_slug is deliberately NOT rewritten — the
--    colliding slug is retained by the winner, so existing links keep
--    resolving to the winner exactly as the old probe order (system first)
--    did. Renamed rows are flagged for manual audit:
--      SELECT * FROM celestial_id_map WHERE renamed;
-- ----------------------------------------------------------------------------

WITH all_rows AS (
	SELECT 'system' AS kind, id AS old_id, slug, 1 AS prio FROM star_systems
	UNION ALL
	SELECT 'star', id, slug, 2 FROM stars
	UNION ALL
	SELECT 'planet', id, slug, 3 FROM planetary_bodies
), ranked AS (
	SELECT kind, old_id, slug,
		ROW_NUMBER() OVER (PARTITION BY LOWER(slug) ORDER BY prio, old_id) AS rn
	FROM all_rows
)
INSERT INTO celestial_id_map (kind, old_id, old_slug, new_slug, renamed)
SELECT kind, old_id, slug,
	CASE WHEN rn = 1 THEN slug
		ELSE slug || '-' || CASE kind WHEN 'planet' THEN 'body' ELSE kind END
	END,
	rn > 1
FROM ranked;

WITH still_dup AS (
	SELECT kind, old_id FROM (
		SELECT kind, old_id,
			ROW_NUMBER() OVER (PARTITION BY LOWER(new_slug) ORDER BY renamed, old_id) AS rn
		FROM celestial_id_map
	) t
	WHERE rn > 1
)
UPDATE celestial_id_map m
SET new_slug = m.new_slug || '-' || m.old_id, renamed = true
FROM still_dup d
WHERE m.kind = d.kind AND m.old_id = d.old_id;

-- ----------------------------------------------------------------------------
-- 4. Copy rows (pass 1: parent_id NULL; pass 2: parent backfill via the map).
-- ----------------------------------------------------------------------------

INSERT INTO celestial_bodies (
	kind, legacy_kind, legacy_id, name, slug, page_slug,
	system_type, distance_ly, galactic_x, galactic_y, galactic_z, formation_age, designations,
	extra, description, body, body_parsed_ast, body_plain_text, body_size_bytes, body_updated_at,
	created_at, updated_at
)
SELECT
	'system', 'system', s.id, s.name, m.new_slug, s.page_slug,
	COALESCE(s.system_type, 'single'), s.distance_ly, s.galactic_x, s.galactic_y, s.galactic_z, s.formation_age, s.designations,
	s.extra, s.description, s.body, s.body_parsed_ast, s.body_plain_text, s.body_size_bytes, s.body_updated_at,
	s.created_at, s.updated_at
FROM star_systems s
JOIN celestial_id_map m ON m.kind = 'system' AND m.old_id = s.id;

INSERT INTO celestial_bodies (
	kind, legacy_kind, legacy_id, name, slug, page_slug,
	spectral_type, mass_kg, radius_m, luminosity_w, luminosity_visual, temperature_k, age, color,
	rotation_period_s, axial_tilt,
	orbital_period_days, semi_major_axis_au, eccentricity, epoch_phase,
	apparent_magnitude, absolute_magnitude, angular_diameter, metallicity, companion,
	extra, description, body, body_parsed_ast, body_plain_text, body_size_bytes, body_updated_at,
	created_at, updated_at
)
SELECT
	'star', 'star', s.id, s.name, m.new_slug, s.page_slug,
	s.spectral_type, s.mass_kg, s.radius_m, s.luminosity_w, s.luminosity_visual, s.temperature_k, s.age, s.color,
	s.rotation_period_s, s.axial_tilt,
	s.orbital_period_days, s.semi_major_axis_au, s.eccentricity, s.epoch_phase,
	s.apparent_magnitude, s.absolute_magnitude, s.angular_diameter, s.metallicity, s.companion,
	s.extra, s.description, s.body, s.body_parsed_ast, s.body_plain_text, s.body_size_bytes, s.body_updated_at,
	s.created_at, s.updated_at
FROM stars s
JOIN celestial_id_map m ON m.kind = 'star' AND m.old_id = s.id;

INSERT INTO celestial_bodies (
	kind, legacy_kind, legacy_id, name, slug, page_slug,
	body_type, mass_kg, radius_m, temperature, age, composition, atmosphere, surface_pressure,
	orbital_period_days, semi_major_axis_au, eccentricity, epoch_phase, inclination,
	rotation_period_s, axial_tilt,
	apparent_magnitude, angular_diameter, albedo, satellites, has_rings,
	extra, description, body, body_parsed_ast, body_plain_text, body_size_bytes, body_updated_at,
	created_at, updated_at
)
SELECT
	'body', 'planet', p.id, p.name, m.new_slug, p.page_slug,
	COALESCE(p.body_type, 'planet'), p.mass_kg, p.radius_m, p.temperature, p.age, p.composition, p.atmosphere, p.surface_pressure,
	p.orbital_period_days, p.semi_major_axis_au, p.eccentricity, p.epoch_phase, p.inclination,
	p.rotation_period_s, p.axial_tilt,
	p.apparent_magnitude, p.angular_diameter, p.albedo, p.satellites, p.has_rings,
	p.extra, p.description, p.body, p.body_parsed_ast, p.body_plain_text, p.body_size_bytes, p.body_updated_at,
	p.created_at, p.updated_at
FROM planetary_bodies p
JOIN celestial_id_map m ON m.kind = 'planet' AND m.old_id = p.id;

UPDATE celestial_id_map m
SET new_id = cb.id
FROM celestial_bodies cb
WHERE cb.legacy_kind = m.kind AND cb.legacy_id = m.old_id;

-- Pass 2: parents. The more specific parent wins — a companion star keeps its
-- parent star (system membership becomes transitive); a moon keeps its parent
-- body.
UPDATE celestial_bodies cb
SET parent_id = COALESCE(mp.new_id, ms.new_id)
FROM stars s
LEFT JOIN celestial_id_map mp ON mp.kind = 'star' AND mp.old_id = s.parent_star_id
LEFT JOIN celestial_id_map ms ON ms.kind = 'system' AND ms.old_id = s.system_id
WHERE cb.legacy_kind = 'star' AND cb.legacy_id = s.id;

UPDATE celestial_bodies cb
SET parent_id = COALESCE(mp.new_id, ms.new_id)
FROM planetary_bodies p
LEFT JOIN celestial_id_map mp ON mp.kind = 'planet' AND mp.old_id = p.parent_id
LEFT JOIN celestial_id_map ms ON ms.kind = 'star' AND ms.old_id = p.star_id
WHERE cb.legacy_kind = 'planet' AND cb.legacy_id = p.id;

-- ----------------------------------------------------------------------------
-- 5. calendars.planet_id: repoint FK to celestial_bodies and remap ids.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
	fk record;
BEGIN
	FOR fk IN
		SELECT conname FROM pg_constraint
		WHERE conrelid = 'calendars'::regclass
			AND contype = 'f'
			AND confrelid = 'planetary_bodies'::regclass
	LOOP
		EXECUTE format('ALTER TABLE calendars DROP CONSTRAINT %I', fk.conname);
	END LOOP;
END $$;

UPDATE calendars c
SET planet_id = m.new_id
FROM celestial_id_map m
WHERE m.kind = 'planet' AND c.planet_id = m.old_id;

ALTER TABLE calendars
	ADD CONSTRAINT calendars_planet_id_celestial_bodies_fk
	FOREIGN KEY (planet_id) REFERENCES celestial_bodies(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 6. calendars.static_data->'moons'[*].celestial_id: JSONB references to
--    planetary_bodies.id, matched at runtime against live body ids
--    (date-math.ts) — must be remapped or lunar cycles silently break.
-- ----------------------------------------------------------------------------

UPDATE calendars c
SET static_data = jsonb_set(c.static_data, '{moons}', (
	SELECT COALESCE(jsonb_agg(
		CASE WHEN (t.moon ? 'celestial_id') AND m.new_id IS NOT NULL
			THEN jsonb_set(t.moon, '{celestial_id}', to_jsonb(m.new_id))
			ELSE t.moon
		END
		ORDER BY t.ord), '[]'::jsonb)
	FROM jsonb_array_elements(c.static_data->'moons') WITH ORDINALITY AS t(moon, ord)
	LEFT JOIN celestial_id_map m
		ON m.kind = 'planet' AND m.old_id = (t.moon->>'celestial_id')::integer
))
WHERE c.static_data ? 'moons'
	AND jsonb_typeof(c.static_data->'moons') = 'array'
	AND jsonb_array_length(c.static_data->'moons') > 0;

-- ----------------------------------------------------------------------------
-- 7. Persisted references: content_links / entity_revisions /
--    entity_categories store (kind, per-table serial id). First delete rows
--    whose entity no longer exists (no FK ever enforced these; stale old ids
--    would otherwise falsely match NEW serial ids after the remap), then
--    remap ids and rewrite kind 'planet' -> 'body'.
-- ----------------------------------------------------------------------------

DELETE FROM content_links cl
WHERE cl.source_kind IN ('system', 'star', 'planet')
	AND NOT EXISTS (
		SELECT 1 FROM celestial_id_map m
		WHERE m.kind = cl.source_kind AND m.old_id = cl.source_entity_id
	);

DELETE FROM entity_revisions er
WHERE er.entity_type IN ('system', 'star', 'planet')
	AND NOT EXISTS (
		SELECT 1 FROM celestial_id_map m
		WHERE m.kind = er.entity_type AND m.old_id = er.entity_id
	);

DELETE FROM entity_categories ec
WHERE ec.entity_type IN ('system', 'star', 'planet')
	AND NOT EXISTS (
		SELECT 1 FROM celestial_id_map m
		WHERE m.kind = ec.entity_type AND m.old_id = ec.entity_id
	);

UPDATE content_links cl
SET source_entity_id = m.new_id,
	source_kind = CASE m.kind WHEN 'planet' THEN 'body' ELSE m.kind END
FROM celestial_id_map m
WHERE cl.source_kind = m.kind AND cl.source_entity_id = m.old_id;

UPDATE entity_revisions er
SET entity_id = m.new_id,
	entity_type = CASE m.kind WHEN 'planet' THEN 'body' ELSE m.kind END
FROM celestial_id_map m
WHERE er.entity_type = m.kind AND er.entity_id = m.old_id;

UPDATE entity_categories ec
SET entity_id = m.new_id,
	entity_type = CASE m.kind WHEN 'planet' THEN 'body' ELSE m.kind END
FROM celestial_id_map m
WHERE ec.entity_type = m.kind AND ec.entity_id = m.old_id;

-- ----------------------------------------------------------------------------
-- 8. Assertions — any failure aborts the whole (implicit) transaction.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
	n_old bigint;
	n_new bigint;
	n_bad bigint;
BEGIN
	SELECT (SELECT count(*) FROM star_systems)
		+ (SELECT count(*) FROM stars)
		+ (SELECT count(*) FROM planetary_bodies) INTO n_old;
	SELECT count(*) FROM celestial_bodies INTO n_new;
	IF n_old <> n_new THEN
		RAISE EXCEPTION 'celestial unification: row count mismatch (old %, new %)', n_old, n_new;
	END IF;

	SELECT count(*) INTO n_bad FROM celestial_id_map WHERE new_id IS NULL;
	IF n_bad > 0 THEN
		RAISE EXCEPTION 'celestial unification: % id_map rows missing new_id', n_bad;
	END IF;

	-- Every star that had a system or parent star must have gotten a parent.
	SELECT count(*) INTO n_bad
	FROM stars s
	JOIN celestial_bodies cb ON cb.legacy_kind = 'star' AND cb.legacy_id = s.id
	WHERE (s.system_id IS NOT NULL OR s.parent_star_id IS NOT NULL)
		AND cb.parent_id IS NULL;
	IF n_bad > 0 THEN
		RAISE EXCEPTION 'celestial unification: % stars lost their parent', n_bad;
	END IF;

	-- Every body that had a star or parent body must have gotten a parent.
	SELECT count(*) INTO n_bad
	FROM planetary_bodies p
	JOIN celestial_bodies cb ON cb.legacy_kind = 'planet' AND cb.legacy_id = p.id
	WHERE (p.star_id IS NOT NULL OR p.parent_id IS NOT NULL)
		AND cb.parent_id IS NULL;
	IF n_bad > 0 THEN
		RAISE EXCEPTION 'celestial unification: % bodies lost their parent', n_bad;
	END IF;

	-- No 'planet' kind strings may survive the rewrite.
	SELECT (SELECT count(*) FROM content_links WHERE source_kind = 'planet')
		+ (SELECT count(*) FROM entity_revisions WHERE entity_type = 'planet')
		+ (SELECT count(*) FROM entity_categories WHERE entity_type = 'planet') INTO n_bad;
	IF n_bad > 0 THEN
		RAISE EXCEPTION 'celestial unification: % rows still carry kind=planet', n_bad;
	END IF;

	-- Every remaining celestial reference must point at a real row.
	SELECT count(*) INTO n_bad
	FROM content_links cl
	WHERE cl.source_kind IN ('system', 'star', 'body')
		AND NOT EXISTS (SELECT 1 FROM celestial_bodies cb WHERE cb.id = cl.source_entity_id);
	IF n_bad > 0 THEN
		RAISE EXCEPTION 'celestial unification: % orphan content_links rows', n_bad;
	END IF;

	RAISE NOTICE 'celestial unification: % rows migrated, % slugs renamed',
		n_new, (SELECT count(*) FROM celestial_id_map WHERE renamed);
END $$;

-- ----------------------------------------------------------------------------
-- 9. Rename old tables. Any missed raw-SQL reference now fails loudly instead
--    of silently reading stale data. Dropped by the cleanup migration.
-- ----------------------------------------------------------------------------

ALTER TABLE star_systems RENAME TO star_systems_legacy;
ALTER TABLE stars RENAME TO stars_legacy;
ALTER TABLE planetary_bodies RENAME TO planetary_bodies_legacy;
