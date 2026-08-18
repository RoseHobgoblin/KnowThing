-- Rename the live firmament domain and its persistence surface to Rodder.
-- Historical migrations keep their original names; this migration is the
-- compatibility boundary for both fresh and already-running installations.

ALTER TABLE IF EXISTS celestial_bodies RENAME TO rodder_bodies;
ALTER TABLE IF EXISTS celestial_sectors RENAME TO rodder_sectors;
ALTER TABLE IF EXISTS celestial_sector_roots RENAME TO rodder_sector_roots;
ALTER TABLE IF EXISTS celestial_id_map RENAME TO rodder_id_map;

ALTER SEQUENCE IF EXISTS celestial_bodies_id_seq RENAME TO rodder_bodies_id_seq;
ALTER SEQUENCE IF EXISTS celestial_sectors_id_seq RENAME TO rodder_sectors_id_seq;
ALTER SEQUENCE IF EXISTS celestial_sector_roots_id_seq RENAME TO rodder_sector_roots_id_seq;

ALTER INDEX IF EXISTS idx_celestial_bodies_slug RENAME TO idx_rodder_bodies_slug;
ALTER INDEX IF EXISTS idx_celestial_bodies_parent RENAME TO idx_rodder_bodies_parent;
ALTER INDEX IF EXISTS idx_celestial_bodies_kind_parent RENAME TO idx_rodder_bodies_kind_parent;

DO $$
DECLARE
	rename_pair text[];
BEGIN
	FOREACH rename_pair SLICE 1 IN ARRAY ARRAY[
		ARRAY['rodder_bodies', 'celestial_bodies_pkey', 'rodder_bodies_pkey'],
		ARRAY['rodder_bodies', 'celestial_bodies_slug_key', 'rodder_bodies_slug_key'],
		ARRAY['rodder_bodies', 'celestial_bodies_parent_id_fkey', 'rodder_bodies_parent_id_fkey'],
		ARRAY['rodder_bodies', 'chk_celestial_kind', 'chk_rodder_kind'],
		ARRAY['rodder_bodies', 'chk_celestial_system_no_parent', 'chk_rodder_system_no_parent'],
		ARRAY['rodder_bodies', 'chk_celestial_body_type', 'chk_rodder_body_type'],
		ARRAY['rodder_bodies', 'celestial_temperature_k_positive', 'rodder_temperature_k_positive'],
		ARRAY['rodder_sectors', 'celestial_sectors_pkey', 'rodder_sectors_pkey'],
		ARRAY['rodder_sectors', 'celestial_sectors_slug_key', 'rodder_sectors_slug_key'],
		ARRAY['rodder_sectors', 'celestial_sectors_origin_body_id_fkey', 'rodder_sectors_origin_body_id_fkey'],
		ARRAY['rodder_sector_roots', 'celestial_sector_roots_pkey', 'rodder_sector_roots_pkey'],
		ARRAY['rodder_sector_roots', 'celestial_sector_roots_sector_id_fkey', 'rodder_sector_roots_sector_id_fkey'],
		ARRAY['rodder_sector_roots', 'celestial_sector_roots_body_id_fkey', 'rodder_sector_roots_body_id_fkey'],
		ARRAY['rodder_sector_roots', 'celestial_sector_roots_body_id_key', 'rodder_sector_roots_body_id_key'],
		ARRAY['rodder_id_map', 'celestial_id_map_pkey', 'rodder_id_map_pkey'],
		ARRAY['calendars', 'calendars_planet_id_celestial_bodies_fk', 'calendars_planet_id_rodder_bodies_fk']
	]
	LOOP
		IF EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conrelid = rename_pair[1]::regclass
				AND conname = rename_pair[2]
		) THEN
			EXECUTE format(
				'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
				rename_pair[1], rename_pair[2], rename_pair[3]
			);
		END IF;
	END LOOP;
END $$;

UPDATE content_records SET domain = 'rodder' WHERE domain = 'celestial';
UPDATE content_links SET target_domain = 'rodder' WHERE target_domain = 'celestial';
UPDATE media_asset_bindings SET owner_type = 'rodder' WHERE owner_type = 'celestial';

UPDATE calendars
SET static_data = replace(static_data::text, '"celestial_id"', '"rodder_id"')::jsonb
WHERE static_data::text LIKE '%"celestial_id"%';

UPDATE entity_revisions
SET snapshot = replace(snapshot::text, '"celestial_id"', '"rodder_id"')::jsonb
WHERE snapshot::text LIKE '%"celestial_id"%';

-- Rewrite authored links and the old root-map template spelling. Cached ASTs
-- are cleared only where source changed, so normal loaders reparse them.
UPDATE content_records
SET content = regexp_replace(regexp_replace(content, 'celestial:', 'Rodder:', 'gi'), '\{\{system map', '{{Root map', 'gi'),
	parsed_ast = NULL,
	updated_at = now()
WHERE content ~* 'celestial:|\{\{system map';

UPDATE templates
SET source = regexp_replace(regexp_replace(source, 'celestial:', 'Rodder:', 'gi'), '\{\{system map', '{{Root map', 'gi'),
	updated_at = now()
WHERE source ~* 'celestial:|\{\{system map';

DO $$
DECLARE
	table_name text;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'calendars', 'languages', 'lexicon', 'rodder_bodies',
		'world_maps', 'countries', 'categories'
	]
	LOOP
		EXECUTE format(
			'UPDATE %I SET body = regexp_replace(regexp_replace(body, ''celestial:'', ''Rodder:'', ''gi''), ''\{\{system map'', ''{{Root map'', ''gi''), body_parsed_ast = NULL, body_updated_at = now() WHERE body ~* ''celestial:|\{\{system map''',
			table_name
		);
	END LOOP;
END $$;

UPDATE rodder_bodies
SET extra = replace(extra::text, '/seed-data/celestial/', '/seed-data/rodder/')::jsonb
WHERE extra::text LIKE '%/seed-data/celestial/%';

UPDATE media
SET filepath = replace(filepath, '/seed-data/celestial/', '/seed-data/rodder/')
WHERE filepath LIKE '%/seed-data/celestial/%';
