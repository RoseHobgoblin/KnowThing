-- ============================================================================
-- Entity spine — Phase 1 (additive).
--
-- Implements step 1 of the migration order in "KnowThing Bytes and Bits"
-- (Rev 4): one `entities` table as shared identity for all content, addresses
-- in one `entity_routes` table, article prose in `entity_articles`, semantic
-- links in one governed `relations` table, and a nullable `entity_id` on every
-- typed table that becomes a facet. Nothing here changes readers or writers;
-- compatibility writers (same phase) mint entity + route from app code so no
-- spine-less rows are created after this migration applies.
--
-- Enforcement doctrine: authored relation-type constraints live HERE, on
-- `relations` (each seeded type ships its metadata + property-shape CHECK +
-- partial unique indexes together). Derived types (`orbits`,
-- `member_of_system`) get NO indexes or CHECKs on `relations` — they would
-- guard rows that never exist; their constraints are enforced at their typed
-- source (`celestial_bodies.parent_id` writer, map-region writer).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. entities — identity only; owns NO slug.
-- ----------------------------------------------------------------------------

CREATE TABLE entities (
	id SERIAL PRIMARY KEY,
	display_name TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	merged_into_id INTEGER REFERENCES entities(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ck_entities_status CHECK (status IN ('active', 'archived', 'merged')),
	CONSTRAINT ck_entities_no_self_merge CHECK (merged_into_id IS NULL OR merged_into_id <> id),
	-- Status and pointer move together: merged ⟺ pointing at a survivor.
	CONSTRAINT ck_entities_merged_iff_target CHECK ((status = 'merged') = (merged_into_id IS NOT NULL))
);

CREATE INDEX idx_entities_merged_into ON entities(merged_into_id);

-- ----------------------------------------------------------------------------
-- 2. entity_routes — every address is one row pointing at the FINAL entity.
--    Canonical → 200; noncanonical → 301. No chains; retired slugs never
--    reused. Address + canonical uniqueness are INDEXES, not table
--    constraints: LOWER(slug) is an expression, and table-level UNIQUE takes
--    columns only.
-- ----------------------------------------------------------------------------

CREATE TABLE entity_routes (
	id SERIAL PRIMARY KEY,
	entity_id INTEGER NOT NULL REFERENCES entities(id),
	namespace TEXT NOT NULL,
	-- Wordbook lexeme routes are scoped by their language entity; deleting a
	-- language with scoped lexeme routes is RESTRICTed (default FK behavior).
	scope_entity_id INTEGER REFERENCES entities(id),
	slug TEXT NOT NULL,
	is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ck_entity_routes_namespace CHECK (namespace IN ('know', 'wordbook', 'category')),
	CONSTRAINT ck_entity_routes_wordbook_scope CHECK ((namespace = 'wordbook') = (scope_entity_id IS NOT NULL)),
	CONSTRAINT ck_entity_routes_slug_nonempty CHECK (slug <> ''),
	-- Backstop only: the shared minting path (mintEntitySlug/mintLexemeSlug in
	-- src/lib/utils/slugify.ts) already emits NFC. `boek ≠ bœk` is intentional;
	-- unaccent is search-only. Precomposed vs combining-mark spellings of the
	-- same slug normalize to the same bytes and so collide on the address index.
	CONSTRAINT ck_entity_routes_slug_nfc CHECK (slug = normalize(slug, NFC))
);

-- One address, case-insensitively, across the whole site. NULLS NOT DISTINCT
-- so two unscoped routes with the same slug collide (prod is
-- postgres:16-alpine; PG15+ feature).
CREATE UNIQUE INDEX entity_routes_address_uq
	ON entity_routes (namespace, scope_entity_id, LOWER(slug))
	NULLS NOT DISTINCT;

-- At most one canonical route per entity; "exactly one" for non-merged
-- entities is the app-level invariant (see entity-spine invariant queries).
CREATE UNIQUE INDEX entity_routes_one_canonical_uq
	ON entity_routes (entity_id) WHERE is_canonical;

CREATE INDEX idx_entity_routes_entity ON entity_routes(entity_id);
CREATE INDEX idx_entity_routes_scope ON entity_routes(scope_entity_id);

-- ----------------------------------------------------------------------------
-- 3. entity_articles — prose facet. Destination for content_records prose at
--    backfill; new spine-native articles land here directly.
-- ----------------------------------------------------------------------------

CREATE TABLE entity_articles (
	entity_id INTEGER PRIMARY KEY REFERENCES entities(id),
	body TEXT NOT NULL DEFAULT '',
	parsed_ast JSONB,
	plain_text TEXT NOT NULL DEFAULT '',
	size_bytes INTEGER NOT NULL DEFAULT 0,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. relation_types — governed vocabulary. Seeded ONLY in migrations, as
--    complete bundles; no type-creation UI. On derived types, unique_from and
--    acyclic are documentation only — enforcement lives at the typed source.
-- ----------------------------------------------------------------------------

CREATE TABLE relation_types (
	key TEXT PRIMARY KEY,
	from_label TEXT NOT NULL,
	to_label TEXT NOT NULL,
	-- Quoted: SYMMETRIC is a reserved word in Postgres.
	"symmetric" BOOLEAN NOT NULL DEFAULT FALSE,
	acyclic BOOLEAN NOT NULL DEFAULT FALSE,
	transitive BOOLEAN NOT NULL DEFAULT FALSE,
	unique_from BOOLEAN NOT NULL DEFAULT FALSE,
	unique_to BOOLEAN NOT NULL DEFAULT FALSE,
	-- [] = unrestricted; nonempty = endpoint must have ANY listed facet.
	from_facets TEXT[] NOT NULL DEFAULT '{}',
	to_facets TEXT[] NOT NULL DEFAULT '{}',
	derived BOOLEAN NOT NULL DEFAULT FALSE,
	description TEXT NOT NULL DEFAULT '',
	-- facet_key governance: the identifiers usable in relation rules (and, at
	-- consolidation, entity_revisions.facet_key) come from this CHECK-governed
	-- list, amended by migration. This governs identifiers, not attachment —
	-- a facet-table row IS the attachment; there is no entity_facets registry.
	CONSTRAINT ck_relation_types_from_facets CHECK (
		from_facets <@ ARRAY['article', 'celestial', 'calendar', 'country', 'world_map', 'language', 'lexicon', 'category']
	),
	CONSTRAINT ck_relation_types_to_facets CHECK (
		to_facets <@ ARRAY['article', 'celestial', 'calendar', 'country', 'world_map', 'language', 'lexicon', 'category']
	)
);

-- ----------------------------------------------------------------------------
-- 5. relations — AUTHORED semantic edges only. Derived edges (orbits,
--    member_of_system, map depiction) are projected by the all_relations view
--    (built in a later phase) and never stored here; the relation service
--    rejects all writes to derived types.
-- ----------------------------------------------------------------------------

CREATE TABLE relations (
	id SERIAL PRIMARY KEY,
	from_id INTEGER NOT NULL REFERENCES entities(id),
	to_id INTEGER NOT NULL REFERENCES entities(id),
	type_key TEXT NOT NULL REFERENCES relation_types(key),
	properties JSONB NOT NULL DEFAULT '{}',
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ck_relations_no_self CHECK (from_id <> to_id)
);

CREATE INDEX idx_relations_from ON relations(from_id, type_key);
CREATE INDEX idx_relations_to ON relations(to_id, type_key);

-- ----------------------------------------------------------------------------
-- 6. Seed relation types — each authored type ships its complete bundle:
--    metadata row + property-shape CHECK + partial unique index(es).
--    Naming law: dependent → grounding, verb phrase read from→to.
-- ----------------------------------------------------------------------------

INSERT INTO relation_types
	(key, from_label, to_label, "symmetric", acyclic, transitive, unique_from, unique_to, from_facets, to_facets, derived, description)
VALUES
	-- calendars.planet_id becomes this edge at backfill. Single FK today →
	-- unique_from. Service integrity replaces FK integrity, hence the
	-- facet-removal guard in the relation service.
	('measures_time_on', 'measures time on', 'time measured by', FALSE, FALSE, FALSE, TRUE, FALSE,
		ARRAY['calendar'], ARRAY['celestial'], FALSE,
		'A calendar counts days and years by the rotation and orbit of this celestial body.'),
	-- lexicon_relations types move verbatim.
	('derived_from', 'derived from', 'derivations', FALSE, FALSE, FALSE, FALSE, FALSE,
		ARRAY['lexicon'], ARRAY['lexicon'], FALSE,
		'A word formed from another word inside the same language (affixation, ablaut, clipping).'),
	('loan_from', 'loaned from', 'loaned to', FALSE, FALSE, FALSE, FALSE, FALSE,
		ARRAY['lexicon'], ARRAY['lexicon'], FALSE,
		'A word borrowed from a word in another language.'),
	('compound_of', 'compound of', 'component of', FALSE, FALSE, FALSE, FALSE, FALSE,
		ARRAY['lexicon'], ARRAY['lexicon'], FALSE,
		'A compound word and one of its components; properties.position (1-based) orders the components. The same component may recur at different positions (reduplication).'),
	-- Word → concept; replaces shadow lexeme articles at backfill. The concept
	-- end is unrestricted: any entity can be denoted.
	('denotes', 'denotes', 'denoted by', FALSE, FALSE, FALSE, FALSE, FALSE,
		ARRAY['lexicon'], '{}', FALSE,
		'A word names this concept. Polysemous words may denote several concepts.'),
	-- languages.parent_language_id (migration 0008) becomes this edge. Single
	-- parent today → unique_from.
	('descends_from', 'descends from', 'descendant languages', FALSE, TRUE, FALSE, TRUE, FALSE,
		ARRAY['language'], ARRAY['language'], FALSE,
		'Genetic ancestry between languages.'),
	-- transitive=false at launch; evolution is TYPE SPLITTING
	-- (administratively_in, …) when non-administrative containment arrives —
	-- never a scheme property; mixed schemes corrupt transitive traversal AND
	-- the acyclic check.
	('located_in', 'located in', 'contains', FALSE, TRUE, FALSE, FALSE, FALSE,
		'{}', '{}', FALSE,
		'Spatial/administrative containment. Non-transitive at launch.'),
	('child_of', 'child of', 'children', FALSE, TRUE, FALSE, FALSE, FALSE,
		'{}', '{}', FALSE,
		'Genealogical parentage. Dormant: seeded for governance, no UI yet.'),
	-- DERIVED types: projected from celestial_bodies.parent_id + orbital
	-- elements by the all_relations view. unique_from/acyclic here are
	-- documentation only — the celestial parent writer enforces the
	-- endpoint-kind matrix, cycle checks, and single parent.
	('orbits', 'orbits', 'orbited by', FALSE, TRUE, FALSE, TRUE, FALSE,
		ARRAY['celestial'], ARRAY['celestial'], TRUE,
		'Derived: emitted wherever the child carries orbital elements, barycentric orbits included (the system row IS the barycenter).'),
	('member_of_system', 'member of', 'system members', FALSE, TRUE, FALSE, TRUE, FALSE,
		ARRAY['celestial'], ARRAY['celestial'], TRUE,
		'Derived: emitted for every system-parented child. A companion star legitimately carries both orbits and member_of_system.');
	-- NOT seeded: depicts (awaits media on the spine — no polymorphic media_id),
	-- cognate_of (computed: common ancestor via derived_from-only paths).

-- compound_of property shape: position exists, numeric, positive, integral.
-- Cast via ::numeric + x = floor(x) — an ::integer cast on '1.5' RAISES
-- instead of failing the CHECK. House pattern: NOT VALID → VALIDATE.
ALTER TABLE relations
	ADD CONSTRAINT ck_relations_compound_of_position CHECK (
		type_key <> 'compound_of' OR (
			(properties ->> 'position') IS NOT NULL
			AND (properties ->> 'position')::numeric > 0
			AND (properties ->> 'position')::numeric = floor((properties ->> 'position')::numeric)
		)
	) NOT VALID;
ALTER TABLE relations VALIDATE CONSTRAINT ck_relations_compound_of_position;

-- Per-type uniqueness (authored types only). Pair-dedupe mirrors the legacy
-- uq_lexicon_relations_edge semantics; compound_of is keyed by position
-- instead so a component may recur at a different position.
CREATE UNIQUE INDEX relations_measures_time_on_from_uq
	ON relations (from_id) WHERE type_key = 'measures_time_on';
CREATE UNIQUE INDEX relations_descends_from_from_uq
	ON relations (from_id) WHERE type_key = 'descends_from';
CREATE UNIQUE INDEX relations_derived_from_edge_uq
	ON relations (from_id, to_id) WHERE type_key = 'derived_from';
CREATE UNIQUE INDEX relations_loan_from_edge_uq
	ON relations (from_id, to_id) WHERE type_key = 'loan_from';
CREATE UNIQUE INDEX relations_denotes_edge_uq
	ON relations (from_id, to_id) WHERE type_key = 'denotes';
CREATE UNIQUE INDEX relations_located_in_edge_uq
	ON relations (from_id, to_id) WHERE type_key = 'located_in';
CREATE UNIQUE INDEX relations_child_of_edge_uq
	ON relations (from_id, to_id) WHERE type_key = 'child_of';
CREATE UNIQUE INDEX relations_compound_of_position_uq
	ON relations (from_id, ((properties ->> 'position')::int))
	WHERE type_key = 'compound_of';

-- ----------------------------------------------------------------------------
-- 7. Nullable entity_id on every table that becomes a facet. NULL means the
--    row predates the spine (backfilled in a later phase); compatibility
--    writers keep new rows attached from this migration on. Partial unique:
--    a facet-table row IS the attachment, and each singleton facet attaches
--    to at most one entity (lexicon included — one entity per homograph row).
--    The writer flip (a later phase) is gated on zero NULLs everywhere, then
--    sets NOT NULL.
-- ----------------------------------------------------------------------------

ALTER TABLE content_records ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX content_records_entity_uq ON content_records(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE calendars ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX calendars_entity_uq ON calendars(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE languages ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX languages_entity_uq ON languages(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE lexicon ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX lexicon_entity_uq ON lexicon(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE celestial_bodies ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX celestial_bodies_entity_uq ON celestial_bodies(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE countries ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX countries_entity_uq ON countries(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE world_maps ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX world_maps_entity_uq ON world_maps(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE categories ADD COLUMN entity_id INTEGER REFERENCES entities(id);
CREATE UNIQUE INDEX categories_entity_uq ON categories(entity_id) WHERE entity_id IS NOT NULL;
