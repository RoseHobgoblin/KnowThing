-- ============================================================================
-- Celestial sectors and sector roots (Celestial-Sector-and-System-Model.md,
-- Initial Delivery Order steps 1–2).
--
-- A sector is a bounded 3D authoring space with an explicit reference-frame
-- contract: units, shape/extent, origin semantics, axes, handedness, and
-- provenance. A sector root is an independently positioned object on that
-- sector's map — today always a `kind='system'` row, later also unbound
-- planets, stations, phenomena, and markers. Orbital children never carry
-- sector coordinates; roots never carry orbital elements. The two scales stay
-- separate (sector: ly/pc, Orrery: AU/km).
--
-- The old star-system `galactic_x/y/z` columns (0038) declared no origin, no
-- axes, no handedness, and no epoch — they were legacy local coordinates with
-- an implicit frame, not "galactic" positions. This migration moves their
-- values VERBATIM into roots of a declared legacy sector, then drops the
-- misleadingly named columns. Positions stay exactly as authored; only the
-- frame around them becomes explicit (and explicitly marked 'legacy').
--
-- Extent and position columns are nullable on purpose: an undeclared extent or
-- an unknown root position must remain visibly unavailable rather than being
-- invented here. Partial legacy triples (an X without a Z) are preserved
-- as-is; new writes go through the app layer, which requires complete
-- positions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS celestial_sectors (
	id serial PRIMARY KEY,
	name text NOT NULL,
	slug text UNIQUE NOT NULL,
	description text NOT NULL DEFAULT '',

	-- Frame contract.
	units text NOT NULL DEFAULT 'ly',
	shape text,
	radius double precision,             -- spherical extent, in sector units
	extent_x double precision,           -- cuboid extents, in sector units
	extent_y double precision,
	extent_z double precision,
	origin_kind text NOT NULL DEFAULT 'frame-centred',
	origin_body_id integer REFERENCES celestial_bodies(id) ON DELETE SET NULL,
	axes_note text,                      -- axis directions/labels, prose
	handedness text NOT NULL DEFAULT 'right-handed',
	reference_epoch text,
	provenance text NOT NULL DEFAULT 'authored',

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	CONSTRAINT chk_sector_units CHECK (units IN ('ly', 'pc')),
	CONSTRAINT chk_sector_shape CHECK (shape IS NULL OR shape IN ('sphere', 'cuboid')),
	CONSTRAINT chk_sector_origin_kind CHECK (origin_kind IN ('object-centred', 'frame-centred', 'imported')),
	CONSTRAINT chk_sector_handedness CHECK (handedness IN ('right-handed', 'left-handed')),
	CONSTRAINT chk_sector_provenance CHECK (provenance IN ('authored', 'imported', 'transformed', 'approximate', 'legacy'))
);

CREATE TABLE IF NOT EXISTS celestial_sector_roots (
	id serial PRIMARY KEY,
	sector_id integer NOT NULL REFERENCES celestial_sectors(id) ON DELETE CASCADE,
	-- A body is a root of at most one sector; deleting the body removes the
	-- root record (the position assertion is meaningless without its object).
	body_id integer UNIQUE NOT NULL REFERENCES celestial_bodies(id) ON DELETE CASCADE,

	-- Position in the sector frame, in the sector's units. Nullable: a root may
	-- exist before its position is known.
	x double precision,
	y double precision,
	z double precision,
	position_provenance text NOT NULL DEFAULT 'authored',
	position_uncertainty double precision, -- radius, sector units
	notes text,

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	CONSTRAINT chk_sector_root_position_provenance
		CHECK (position_provenance IN ('authored', 'imported', 'derived', 'approximate', 'legacy'))
);

CREATE INDEX IF NOT EXISTS idx_sector_roots_sector ON celestial_sector_roots(sector_id);

-- The one home-neighbourhood sector every existing system migrates into. Its
-- frame contract is declared but honest: legacy provenance, arbitrary
-- frame-centred origin, undeclared extent.
INSERT INTO celestial_sectors (name, slug, description, units, origin_kind, handedness, provenance, axes_note)
VALUES (
	'Local Sector',
	'local-sector',
	'The home stellar neighbourhood. Created by migration 0054 as the declared frame for coordinates previously stored as bare galactic X/Y/Z values.',
	'ly',
	'frame-centred',
	'right-handed',
	'legacy',
	'Axis directions inherited from the legacy galactic_x/y/z columns, which never declared them. Treat orientation as arbitrary until re-authored.'
)
ON CONFLICT (slug) DO NOTHING;

-- Every system becomes a root of the local sector. Coordinate values are
-- copied verbatim — including NULLs and (unlikely) partial triples.
INSERT INTO celestial_sector_roots (sector_id, body_id, x, y, z, position_provenance)
SELECT s.id, cb.id, cb.galactic_x, cb.galactic_y, cb.galactic_z, 'legacy'
FROM celestial_bodies cb
CROSS JOIN (SELECT id FROM celestial_sectors WHERE slug = 'local-sector') s
WHERE cb.kind = 'system'
ON CONFLICT (body_id) DO NOTHING;

ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS galactic_x;
ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS galactic_y;
ALTER TABLE celestial_bodies DROP COLUMN IF EXISTS galactic_z;
