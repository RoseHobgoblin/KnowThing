-- ============================================================================
-- Phase 1 of the Monster Migration: namespace scaffold (additive only).
--
-- Adds body fields to all prose-bearing structured tables, the new categories
-- table, the unified entity_revisions table, the entity_categories tagging
-- table, and the source-side generalisation of content_links so that entity
-- rows can be link sources (not just targets).
--
-- Nothing reads these columns or tables yet. See plan-the-monster-migration-
-- wise-giraffe.md for the rollout sequence.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. body_* fields on prose-bearing tables
-- ----------------------------------------------------------------------------

ALTER TABLE stars              ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE stars              ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE stars              ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE stars              ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE stars              ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE planetary_bodies   ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE planetary_bodies   ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE planetary_bodies   ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE planetary_bodies   ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE planetary_bodies   ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE star_systems       ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE star_systems       ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE star_systems       ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE star_systems       ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE star_systems       ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE languages          ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE languages          ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE languages          ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE languages          ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE languages          ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS description     text default '';
ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE lexicon            ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE calendars          ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE calendars          ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE calendars          ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE calendars          ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE calendars          ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE countries          ADD COLUMN IF NOT EXISTS description     text default '';
ALTER TABLE countries          ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE countries          ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE countries          ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE countries          ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE countries          ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

ALTER TABLE world_maps         ADD COLUMN IF NOT EXISTS body            text not null default '';
ALTER TABLE world_maps         ADD COLUMN IF NOT EXISTS body_parsed_ast jsonb;
ALTER TABLE world_maps         ADD COLUMN IF NOT EXISTS body_plain_text text not null default '';
ALTER TABLE world_maps         ADD COLUMN IF NOT EXISTS body_size_bytes integer not null default 0;
ALTER TABLE world_maps         ADD COLUMN IF NOT EXISTS body_updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. Categories namespace (Phase 7 wires this up)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
	id              serial primary key,
	slug            text unique not null,
	title           text not null,
	body            text not null default '',
	body_parsed_ast jsonb,
	body_plain_text text not null default '',
	body_size_bytes integer not null default 0,
	body_updated_at timestamptz,
	created_at      timestamptz not null default now(),
	updated_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (LOWER(slug));

-- ----------------------------------------------------------------------------
-- 3. Unified revisions for any entity (Phase 4+ writes here)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_revisions (
	id            serial primary key,
	entity_type   text not null,
	entity_id     integer not null,
	title         text not null,
	snapshot      jsonb not null,
	edit_summary  text,
	user_id       integer references users(id) on delete set null,
	created_at    timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_entity_revisions_entity
	ON entity_revisions (entity_type, entity_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Categorising structured entities (Phase 7 wires this up)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_categories (
	entity_type text not null,
	entity_id   integer not null,
	category    text not null,
	primary key (entity_type, entity_id, category)
);

CREATE INDEX IF NOT EXISTS idx_entity_categories_cat
	ON entity_categories (category);

-- ----------------------------------------------------------------------------
-- 5. content_links source-side generalisation
--
-- Existing rows are all Know-sourced; backfill source_kind='know',
-- source_entity_id=source_id for every existing row, then re-PK on
-- (source_kind, source_entity_id, target_domain, target_slug) so entity-
-- sourced rows (source_id NULL) become legal.
-- ----------------------------------------------------------------------------

ALTER TABLE content_links
	ADD COLUMN IF NOT EXISTS source_kind      text not null default 'know',
	ADD COLUMN IF NOT EXISTS source_entity_id integer;

UPDATE content_links
	SET source_entity_id = source_id
	WHERE source_entity_id IS NULL;

-- Drop the old (source_id, target_domain, target_slug) PK and replace it.
DO $$
DECLARE
	pk_name text;
BEGIN
	SELECT conname INTO pk_name
	FROM pg_constraint
	WHERE conrelid = 'content_links'::regclass AND contype = 'p'
	LIMIT 1;
	IF pk_name IS NOT NULL THEN
		EXECUTE format('ALTER TABLE content_links DROP CONSTRAINT %I', pk_name);
	END IF;
END $$;

ALTER TABLE content_links ALTER COLUMN source_entity_id SET NOT NULL;
ALTER TABLE content_links ALTER COLUMN source_id DROP NOT NULL;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'content_links'::regclass AND contype = 'p'
	) THEN
		ALTER TABLE content_links
			ADD CONSTRAINT content_links_pk
			PRIMARY KEY (source_kind, source_entity_id, target_domain, target_slug);
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinks_source_entity
	ON content_links (source_kind, source_entity_id);
