-- ============================================================================
-- Entity spine — Phase 4 (backfill).
--
-- Steps 3+4 of the Bytes & Bits migration order land here:
--
--   * spine_work_items — the editorial queue. The backfill NEVER guesses:
--     anything it can't decide mechanically (address collisions, facet
--     conflicts, shared page slugs) becomes a work item. The collision
--     preflight (step 5) requires this queue drained before reader cutover.
--   * SQL slug minting (spine_mint_slug) — same rules as mintEntitySlug in
--     src/lib/utils/slugify.ts; a parity test pins the two together. NOTE:
--     [[:alnum:]] classification follows the database locale — prod runs
--     postgres:16-alpine with the same provider this chain was verified on.
--   * spine_merge_entities_frozen — the FROZEN copy of the merge service
--     (entity-merge.ts). Created here, used for backfill glue merges, kept
--     for the preflight phase, dropped by the final cleanup migration.
--     Replaying history executes THIS code, never the live service. Both
--     implementations pass the shared scenarios in
--     src/lib/server/services/__tests__/entity-merge.test.ts — extend the
--     tests first if the rules ever change, then re-freeze BOTH copies.
--   * Backfill: every facet row with entity_id NULL gets an entity + a
--     canonical route (wiki style from the display name), with the legacy
--     hyphen slug preserved as a noncanonical route. Lexemes get scoped
--     routes with homograph suffixes (boek, boek-2) minted here, per the
--     design. Typed-domain content records and page_slug glue resolve
--     THROUGH ROUTES, never by comparing canonical slug strings.
--   * Relations per the moves table: calendars.planet_id →
--     measures_time_on; languages.parent_language_id → descends_from;
--     lexicon_relations → derived_from / loan_from / compound_of verbatim
--     (positions synthesized 1..n per compound in original insert order —
--     the legacy table never stored one).
--   * Revision consolidation — BEFORE any drops (nothing is dropped here).
--     entity_revisions becomes the unified store: legacy polymorphic
--     columns renamed to legacy_*, spine entity_id + facet_key added, and
--     content_revisions / lexicon_revisions copied in. Consolidation is
--     idempotent (unique on source_store+source_id) so the writer-flip
--     phase re-runs spine_consolidate_revisions() for the delta.
--
-- The whole file runs as one implicit transaction (simple-protocol
-- multi-statement); the trailing verification block RAISEs — and thus
-- rolls back everything — if the canonical-route or no-chains invariant
-- does not hold afterwards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Work items
-- ----------------------------------------------------------------------------

CREATE TABLE spine_work_items (
	id SERIAL PRIMARY KEY,
	kind TEXT NOT NULL,
	detail TEXT NOT NULL,
	context JSONB NOT NULL DEFAULT '{}',
	resolved_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ck_spine_work_items_kind CHECK (kind IN (
		'address_collision', 'unsluggable', 'unresolved_article',
		'shared_page_slug', 'merge_conflict', 'spineless_language'
	))
);

-- ----------------------------------------------------------------------------
-- 2. Slug minting — SQL twin of the one minting path in slugify.ts.
-- ----------------------------------------------------------------------------

CREATE FUNCTION spine_slug_wiki(p_name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $sql$
	SELECT CASE WHEN cleaned = '' OR cleaned IS NULL THEN COALESCE(cleaned, '')
		ELSE upper(left(cleaned, 1)) || substr(cleaned, 2) END
	FROM (
		SELECT regexp_replace(
			replace(trim(normalize(p_name, NFC)), ' ', '_'),
			'[^[:alnum:]_().-]', '', 'g'
		) AS cleaned
	) AS t
$sql$;

CREATE FUNCTION spine_slug_url(p_name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $sql$
	SELECT trim(BOTH '-' FROM regexp_replace(
		lower(trim(normalize(p_name, NFC))),
		'[^[:alnum:]]+', '-', 'g'
	))
$sql$;

CREATE FUNCTION spine_mint_slug(p_namespace TEXT, p_name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $sql$
	SELECT CASE WHEN p_namespace = 'wordbook'
		THEN spine_slug_url(p_name)
		ELSE spine_slug_wiki(p_name) END
$sql$;

-- ----------------------------------------------------------------------------
-- 3. Facet presence — a facet-table row IS the attachment. The article facet
--    spans two stores during the transition.
-- ----------------------------------------------------------------------------

CREATE FUNCTION spine_entity_has_facet(p_entity INTEGER, p_facet TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
	RETURN CASE p_facet
		WHEN 'article' THEN
			EXISTS (SELECT 1 FROM content_records WHERE entity_id = p_entity)
			OR EXISTS (SELECT 1 FROM entity_articles WHERE entity_id = p_entity)
		WHEN 'calendar' THEN EXISTS (SELECT 1 FROM calendars WHERE entity_id = p_entity)
		WHEN 'language' THEN EXISTS (SELECT 1 FROM languages WHERE entity_id = p_entity)
		WHEN 'lexicon' THEN EXISTS (SELECT 1 FROM lexicon WHERE entity_id = p_entity)
		WHEN 'celestial' THEN EXISTS (SELECT 1 FROM celestial_bodies WHERE entity_id = p_entity)
		WHEN 'country' THEN EXISTS (SELECT 1 FROM countries WHERE entity_id = p_entity)
		WHEN 'world_map' THEN EXISTS (SELECT 1 FROM world_maps WHERE entity_id = p_entity)
		WHEN 'category' THEN EXISTS (SELECT 1 FROM categories WHERE entity_id = p_entity)
		ELSE FALSE
	END;
END $fn$;

CREATE FUNCTION spine_entity_facets(p_entity INTEGER) RETURNS TEXT[]
LANGUAGE sql STABLE AS $sql$
	SELECT COALESCE(array_agg(f) FILTER (WHERE spine_entity_has_facet(p_entity, f)), '{}')
	FROM unnest(ARRAY['article', 'celestial', 'calendar', 'country', 'world_map', 'language', 'lexicon', 'category']) AS f
$sql$;

-- ----------------------------------------------------------------------------
-- 4. Attach-or-mint — the backfill twin of mintOrAttachFacetEntity. Returns
--    the entity id, or NULL when the address can't be claimed (the caller
--    records the work item). Attach only to an ACTIVE entity's CANONICAL
--    address when it lacks the facet; retired slugs are never reused.
-- ----------------------------------------------------------------------------

CREATE FUNCTION spine_backfill_attach_or_mint(
	p_display TEXT, p_namespace TEXT, p_slug TEXT,
	p_scope INTEGER, p_facet TEXT, p_legacy TEXT[] DEFAULT '{}'
) RETURNS INTEGER
LANGUAGE plpgsql AS $fn$
DECLARE
	v_slug TEXT;
	v_alias TEXT;
	v_route entity_routes%ROWTYPE;
	v_status TEXT;
	v_entity INTEGER;
BEGIN
	v_slug := normalize(COALESCE(p_slug, ''), NFC);
	IF v_slug = '' THEN RETURN NULL; END IF;

	SELECT * INTO v_route FROM entity_routes
	WHERE namespace = p_namespace
		AND scope_entity_id IS NOT DISTINCT FROM p_scope
		AND LOWER(slug) = LOWER(v_slug)
	LIMIT 1;

	IF FOUND THEN
		SELECT status INTO v_status FROM entities WHERE id = v_route.entity_id;
		IF v_route.is_canonical AND v_status = 'active'
			AND NOT spine_entity_has_facet(v_route.entity_id, p_facet) THEN
			v_entity := v_route.entity_id;
		ELSE
			RETURN NULL;
		END IF;
	ELSE
		INSERT INTO entities (display_name) VALUES (trim(p_display)) RETURNING id INTO v_entity;
		INSERT INTO entity_routes (entity_id, namespace, scope_entity_id, slug, is_canonical)
		VALUES (v_entity, p_namespace, p_scope, v_slug, TRUE);
	END IF;

	FOREACH v_alias IN ARRAY COALESCE(p_legacy, '{}') LOOP
		CONTINUE WHEN v_alias IS NULL;
		v_alias := normalize(v_alias, NFC);
		CONTINUE WHEN v_alias = '' OR LOWER(v_alias) = LOWER(v_slug);
		CONTINUE WHEN EXISTS (
			SELECT 1 FROM entity_routes
			WHERE namespace = p_namespace
				AND scope_entity_id IS NOT DISTINCT FROM p_scope
				AND LOWER(slug) = LOWER(v_alias)
		);
		INSERT INTO entity_routes (entity_id, namespace, scope_entity_id, slug, is_canonical)
		VALUES (v_entity, p_namespace, p_scope, v_alias, FALSE);
	END LOOP;

	RETURN v_entity;
END $fn$;

-- ----------------------------------------------------------------------------
-- 5. The FROZEN merge. Mirrors entity-merge.ts step for step; raises
--    KT400/KT404/KT409 for misuse, returns jsonb outcomes shaped exactly
--    like the service's MergeOutcome so both pass one test suite.
-- ----------------------------------------------------------------------------

CREATE FUNCTION spine_merge_entities_frozen(p_loser INTEGER, p_survivor INTEGER) RETURNS JSONB
LANGUAGE plpgsql AS $fn$
DECLARE
	v_loser entities%ROWTYPE;
	v_survivor entities%ROWTYPE;
	v_conflicts JSONB := '[]'::jsonb;
	v_facets_moved TEXT[] := '{}';
	v_rec RECORD;
	v_count INTEGER;
	v_routes INTEGER := 0;
	v_scoped INTEGER := 0;
	v_repointed INTEGER := 0;
	v_deduped INTEGER := 0;
	v_flattened INTEGER := 0;
BEGIN
	IF p_loser = p_survivor THEN
		RAISE EXCEPTION 'An entity cannot be merged into itself' USING ERRCODE = 'KT400';
	END IF;

	PERFORM pg_advisory_xact_lock(730049, LEAST(p_loser, p_survivor));
	PERFORM pg_advisory_xact_lock(730049, GREATEST(p_loser, p_survivor));

	SELECT * INTO v_loser FROM entities WHERE id = p_loser FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Entity % not found', p_loser USING ERRCODE = 'KT404'; END IF;
	SELECT * INTO v_survivor FROM entities WHERE id = p_survivor FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Entity % not found', p_survivor USING ERRCODE = 'KT404'; END IF;

	IF v_loser.status = 'merged' THEN
		RAISE EXCEPTION 'Entity % was already merged — merge chains are not allowed', p_loser USING ERRCODE = 'KT409';
	END IF;
	IF v_survivor.status = 'merged' THEN
		RAISE EXCEPTION 'The survivor was itself merged (into entity %) — merge into the final entity instead', v_survivor.merged_into_id USING ERRCODE = 'KT409';
	END IF;

	-- Conflict triage: read-only, so a halt mutates nothing.
	FOR v_rec IN
		SELECT f AS facet_key
		FROM unnest(spine_entity_facets(p_loser)) AS f
		WHERE f = ANY (spine_entity_facets(p_survivor))
	LOOP
		v_conflicts := v_conflicts || jsonb_build_object(
			'kind', 'facet', 'facetKey', v_rec.facet_key,
			'detail', format('Both entities carry a %s facet — merge or delete one side first; nothing was overwritten.', v_rec.facet_key));
	END LOOP;

	FOR v_rec IN
		SELECT l.type_key, l.to_id AS loser_to, s.to_id AS survivor_to
		FROM relations l
		JOIN relations s ON s.type_key = l.type_key AND s.from_id = p_survivor
		JOIN relation_types rt ON rt.key = l.type_key
		WHERE l.from_id = p_loser
			AND rt.unique_from AND NOT rt.derived
			AND l.to_id NOT IN (p_loser, p_survivor)
			AND s.to_id NOT IN (p_loser, p_survivor)
			AND l.to_id <> s.to_id
	LOOP
		v_conflicts := v_conflicts || jsonb_build_object(
			'kind', 'unique_from_relation', 'typeKey', v_rec.type_key,
			'detail', format('Both entities have a %s edge with different targets (%s vs %s) — resolve which one is true first.', v_rec.type_key, v_rec.loser_to, v_rec.survivor_to));
	END LOOP;

	FOR v_rec IN
		SELECT (l.properties ->> 'position')::int AS position, l.to_id AS loser_to, s.to_id AS survivor_to
		FROM relations l
		JOIN relations s ON s.type_key = 'compound_of'
			AND s.from_id = p_survivor
			AND (s.properties ->> 'position')::int = (l.properties ->> 'position')::int
		WHERE l.type_key = 'compound_of'
			AND l.from_id = p_loser
			AND l.to_id NOT IN (p_loser, p_survivor)
			AND s.to_id NOT IN (p_loser, p_survivor)
			AND l.to_id <> s.to_id
	LOOP
		v_conflicts := v_conflicts || jsonb_build_object(
			'kind', 'compound_position', 'position', v_rec.position,
			'detail', format('Both compounds list a component at position %s (%s vs %s) — reorder one side first.', v_rec.position, v_rec.loser_to, v_rec.survivor_to));
	END LOOP;

	FOR v_rec IN
		SELECT l.slug
		FROM entity_routes l
		JOIN entity_routes s ON s.scope_entity_id = p_survivor
			AND s.namespace = l.namespace
			AND LOWER(s.slug) = LOWER(l.slug)
		WHERE l.scope_entity_id = p_loser
	LOOP
		v_conflicts := v_conflicts || jsonb_build_object(
			'kind', 'scoped_slug', 'slug', v_rec.slug,
			'detail', format('Both languages hold a "%s" route — merge the equivalent lexemes (or rename one) first; never silently chosen.', v_rec.slug));
	END LOOP;

	IF jsonb_array_length(v_conflicts) > 0 THEN
		RETURN jsonb_build_object('merged', FALSE, 'conflicts', v_conflicts);
	END IF;

	-- Execute, in the transaction order the design fixes.
	UPDATE entity_routes SET is_canonical = FALSE WHERE entity_id = p_loser AND is_canonical;
	UPDATE entity_routes SET entity_id = p_survivor WHERE entity_id = p_loser;
	GET DIAGNOSTICS v_routes = ROW_COUNT;
	UPDATE entity_routes SET scope_entity_id = p_survivor WHERE scope_entity_id = p_loser;
	GET DIAGNOSTICS v_scoped = ROW_COUNT;

	FOR v_rec IN
		SELECT * FROM (VALUES
			('article', 'content_records'), ('article', 'entity_articles'),
			('calendar', 'calendars'), ('language', 'languages'),
			('lexicon', 'lexicon'), ('celestial', 'celestial_bodies'),
			('country', 'countries'), ('world_map', 'world_maps'),
			('category', 'categories')
		) AS stores(facet_key, table_name)
	LOOP
		EXECUTE format('UPDATE %I SET entity_id = $1 WHERE entity_id = $2', v_rec.table_name)
			USING p_survivor, p_loser;
		GET DIAGNOSTICS v_count = ROW_COUNT;
		IF v_count > 0 AND NOT v_rec.facet_key = ANY (v_facets_moved) THEN
			v_facets_moved := v_facets_moved || v_rec.facet_key;
		END IF;
	END LOOP;

	DELETE FROM relations
	WHERE (from_id = p_loser AND to_id = p_survivor)
		OR (from_id = p_survivor AND to_id = p_loser);
	GET DIAGNOSTICS v_count = ROW_COUNT;
	v_deduped := v_deduped + v_count;

	DELETE FROM relations l
	USING relations s
	WHERE l.from_id = p_loser
		AND s.from_id = p_survivor
		AND s.type_key = l.type_key
		AND s.to_id = l.to_id
		AND (l.type_key <> 'compound_of'
			OR (s.properties ->> 'position')::int = (l.properties ->> 'position')::int);
	GET DIAGNOSTICS v_count = ROW_COUNT;
	v_deduped := v_deduped + v_count;

	DELETE FROM relations l
	USING relations s
	WHERE l.to_id = p_loser
		AND s.to_id = p_survivor
		AND s.type_key = l.type_key
		AND s.from_id = l.from_id
		AND (l.type_key <> 'compound_of'
			OR (s.properties ->> 'position')::int = (l.properties ->> 'position')::int);
	GET DIAGNOSTICS v_count = ROW_COUNT;
	v_deduped := v_deduped + v_count;

	UPDATE relations SET from_id = p_survivor WHERE from_id = p_loser;
	GET DIAGNOSTICS v_count = ROW_COUNT;
	v_repointed := v_repointed + v_count;
	UPDATE relations SET to_id = p_survivor WHERE to_id = p_loser;
	GET DIAGNOSTICS v_count = ROW_COUNT;
	v_repointed := v_repointed + v_count;

	UPDATE entities SET merged_into_id = p_survivor, updated_at = NOW()
	WHERE merged_into_id = p_loser;
	GET DIAGNOSTICS v_flattened = ROW_COUNT;

	UPDATE entities SET status = 'merged', merged_into_id = p_survivor, updated_at = NOW()
	WHERE id = p_loser;

	SELECT COUNT(*) INTO v_count FROM entity_routes WHERE entity_id = p_survivor AND is_canonical;
	IF v_count <> 1 THEN
		RAISE EXCEPTION 'Merge left the survivor with % canonical routes — rolled back', v_count;
	END IF;

	RETURN jsonb_build_object('merged', TRUE, 'report', jsonb_build_object(
		'loserId', p_loser, 'survivorId', p_survivor,
		'facetsMoved', to_jsonb(v_facets_moved),
		'routesRepointed', v_routes, 'scopedRoutesRepointed', v_scoped,
		'relationsRepointed', v_repointed, 'relationsDeduped', v_deduped,
		'chainsFlattened', v_flattened));
END $fn$;

-- ----------------------------------------------------------------------------
-- 6. Backfill: entities + routes. Only rows with entity_id NULL — everything
--    created since 0049 already carries its spine.
-- ----------------------------------------------------------------------------

-- 6a. Know pages: the stored slug IS the identity (already wiki-style);
--     minted verbatim, exactly as the compatibility writer does.
DO $do$
DECLARE r RECORD; v INTEGER;
BEGIN
	FOR r IN SELECT id, slug, title FROM content_records WHERE domain = 'know' AND entity_id IS NULL ORDER BY id LOOP
		v := spine_backfill_attach_or_mint(r.title, 'know', r.slug, NULL, 'article');
		IF v IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('address_collision', format('know page "%s" could not claim its address', r.slug),
				jsonb_build_object('table', 'content_records', 'id', r.id, 'slug', r.slug));
		ELSE
			UPDATE content_records SET entity_id = v WHERE id = r.id;
		END IF;
	END LOOP;
END $do$;

-- 6b. Typed tables: canonical = wiki style of the display name; the legacy
--     hyphen slug survives as a noncanonical route (301 forever).
DO $do$
DECLARE r RECORD; v INTEGER;
BEGIN
	FOR r IN
		SELECT 'celestial_bodies' AS tbl, 'celestial' AS facet, id, name AS display, slug FROM celestial_bodies WHERE entity_id IS NULL
		UNION ALL SELECT 'calendars', 'calendar', id, name, slug FROM calendars WHERE entity_id IS NULL
		UNION ALL SELECT 'countries', 'country', id, name, slug FROM countries WHERE entity_id IS NULL
		UNION ALL SELECT 'world_maps', 'world_map', id, name, slug FROM world_maps WHERE entity_id IS NULL
		UNION ALL SELECT 'languages', 'language', id, name, slug FROM languages WHERE entity_id IS NULL
		ORDER BY tbl, id
	LOOP
		v := spine_backfill_attach_or_mint(r.display, 'know', spine_mint_slug('know', r.display), NULL, r.facet, ARRAY[r.slug]);
		IF v IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('address_collision', format('%s "%s" could not claim address "%s"', r.facet, r.display, spine_mint_slug('know', r.display)),
				jsonb_build_object('table', r.tbl, 'id', r.id, 'slug', r.slug));
		ELSE
			EXECUTE format('UPDATE %I SET entity_id = $1 WHERE id = $2', r.tbl) USING v, r.id;
		END IF;
	END LOOP;
END $do$;

-- 6c. Categories live in their own namespace.
DO $do$
DECLARE r RECORD; v INTEGER;
BEGIN
	FOR r IN SELECT id, slug, title FROM categories WHERE entity_id IS NULL ORDER BY id LOOP
		v := spine_backfill_attach_or_mint(r.title, 'category', spine_mint_slug('category', r.title), NULL, 'category', ARRAY[r.slug]);
		IF v IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('address_collision', format('category "%s" could not claim its address', r.title),
				jsonb_build_object('table', 'categories', 'id', r.id, 'slug', r.slug));
		ELSE
			UPDATE categories SET entity_id = v WHERE id = r.id;
		END IF;
	END LOOP;
END $do$;

-- 6d. Lexemes: one entity per homograph; scoped route slugs are minted HERE
--     (`lexicon` has no slug column — identity is language + LOWER(word) +
--     homograph number): boek, boek-2, … Stable once minted.
DO $do$
DECLARE r RECORD; v INTEGER; v_slug TEXT;
BEGIN
	FOR r IN
		SELECT l.id, l.word, l.homograph_number, lang.entity_id AS lang_entity, lang.slug AS lang_slug
		FROM lexicon l
		JOIN languages lang ON lang.id = l.language_id
		WHERE l.entity_id IS NULL
		ORDER BY l.id
	LOOP
		IF r.lang_entity IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('spineless_language', format('lexeme "%s" skipped: language "%s" has no entity', r.word, r.lang_slug),
				jsonb_build_object('table', 'lexicon', 'id', r.id));
			CONTINUE;
		END IF;
		v_slug := spine_slug_url(r.word)
			|| CASE WHEN r.homograph_number > 1 THEN '-' || r.homograph_number ELSE '' END;
		v := spine_backfill_attach_or_mint(r.word, 'wordbook', v_slug, r.lang_entity, 'lexicon');
		IF v IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('address_collision', format('lexeme "%s" could not claim scoped address "%s"', r.word, v_slug),
				jsonb_build_object('table', 'lexicon', 'id', r.id, 'scope', r.lang_entity, 'slug', v_slug));
		ELSE
			UPDATE lexicon SET entity_id = v WHERE id = r.id;
		END IF;
	END LOOP;
END $do$;

-- 6e. Typed-domain content records are the ARTICLE facet of the typed row's
--     entity. Resolved THROUGH ROUTES (the typed backfill just planted the
--     hyphen slug as a route), never by comparing canonical slug strings.
DO $do$
DECLARE r RECORD; v_entity INTEGER;
BEGIN
	FOR r IN SELECT id, domain, slug FROM content_records WHERE domain <> 'know' AND entity_id IS NULL ORDER BY id LOOP
		SELECT rt.entity_id INTO v_entity
		FROM entity_routes rt
		JOIN entities e ON e.id = rt.entity_id
		WHERE rt.namespace IN ('know', 'category')
			AND rt.scope_entity_id IS NULL
			AND LOWER(rt.slug) = LOWER(r.slug)
			AND e.status = 'active'
		ORDER BY CASE WHEN rt.namespace = 'know' THEN 0 ELSE 1 END
		LIMIT 1;

		IF v_entity IS NULL THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('unresolved_article', format('%s content record "%s" resolves to no route', r.domain, r.slug),
				jsonb_build_object('table', 'content_records', 'id', r.id, 'domain', r.domain, 'slug', r.slug));
		ELSIF spine_entity_has_facet(v_entity, 'article') THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('unresolved_article', format('%s content record "%s" resolves to an entity that already has an article', r.domain, r.slug),
				jsonb_build_object('table', 'content_records', 'id', r.id, 'domain', r.domain, 'slug', r.slug, 'entityId', v_entity));
		ELSE
			UPDATE content_records SET entity_id = v_entity WHERE id = r.id;
		END IF;
	END LOOP;
END $do$;

-- 6f. page_slug glue merges — "duplicate merges via frozen merge". The glue
--     columns assert country/language/map/celestial X and know page Y are
--     ONE referent. Resolve the page through routes; merge its entity into
--     the typed entity ONLY when the page entity is article-only (a page
--     entity carrying other facets is an editorial situation → work item).
--     lexicon.page_slug is deliberately excluded: shadow lexeme articles
--     get DELETED (with a denotes edge to the real concept) in a later
--     editorial phase, never merged into the lexeme.
DO $do$
DECLARE r RECORD; v_page_id INTEGER; v_page_status TEXT; v_result JSONB; v_facets TEXT[];
BEGIN
	FOR r IN
		SELECT 'countries' AS tbl, id, entity_id, page_slug AS glue FROM countries WHERE entity_id IS NOT NULL AND COALESCE(page_slug, '') <> ''
		UNION ALL SELECT 'languages', id, entity_id, page_slug FROM languages WHERE entity_id IS NOT NULL AND COALESCE(page_slug, '') <> ''
		UNION ALL SELECT 'world_maps', id, entity_id, linked_page_slug FROM world_maps WHERE entity_id IS NOT NULL AND COALESCE(linked_page_slug, '') <> ''
		UNION ALL SELECT 'celestial_bodies', id, entity_id, page_slug FROM celestial_bodies WHERE entity_id IS NOT NULL AND COALESCE(page_slug, '') <> ''
		ORDER BY tbl, id
	LOOP
		v_page_id := NULL;
		v_page_status := NULL;
		SELECT e.id, e.status INTO v_page_id, v_page_status
		FROM entity_routes rt
		JOIN entities e ON e.id = rt.entity_id
		WHERE rt.namespace = 'know'
			AND rt.scope_entity_id IS NULL
			AND LOWER(rt.slug) = LOWER(r.glue)
		LIMIT 1;

		CONTINUE WHEN v_page_id IS NULL OR v_page_id = r.entity_id OR v_page_status <> 'active';

		v_facets := spine_entity_facets(v_page_id);
		IF v_facets <> '{}' AND v_facets <> ARRAY['article'] THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('shared_page_slug', format('%s #%s links page "%s", but that entity carries facets %s — needs editorial triage', r.tbl, r.id, r.glue, v_facets),
				jsonb_build_object('table', r.tbl, 'id', r.id, 'pageEntityId', v_page_id, 'facets', to_jsonb(v_facets)));
			CONTINUE;
		END IF;

		BEGIN
			v_result := spine_merge_entities_frozen(v_page_id, r.entity_id);
			IF NOT (v_result ->> 'merged')::boolean THEN
				INSERT INTO spine_work_items (kind, detail, context)
				VALUES ('merge_conflict', format('merging page "%s" into %s #%s halted', r.glue, r.tbl, r.id),
					jsonb_build_object('table', r.tbl, 'id', r.id, 'pageEntityId', v_page_id, 'conflicts', v_result -> 'conflicts'));
			END IF;
		EXCEPTION WHEN OTHERS THEN
			INSERT INTO spine_work_items (kind, detail, context)
			VALUES ('merge_conflict', format('merging page "%s" into %s #%s raised: %s', r.glue, r.tbl, r.id, SQLERRM),
				jsonb_build_object('table', r.tbl, 'id', r.id, 'pageEntityId', v_page_id));
		END;
	END LOOP;
END $do$;

-- ----------------------------------------------------------------------------
-- 7. Relations per the moves table. ON CONFLICT DO NOTHING rides the
--    per-type unique indexes from 0049 — replays stay idempotent.
-- ----------------------------------------------------------------------------

INSERT INTO relations (from_id, to_id, type_key, created_at)
SELECT c.entity_id, p.entity_id, 'measures_time_on', NOW()
FROM calendars c
JOIN celestial_bodies p ON p.id = c.planet_id
WHERE c.entity_id IS NOT NULL AND p.entity_id IS NOT NULL AND c.entity_id <> p.entity_id
ON CONFLICT DO NOTHING;

INSERT INTO relations (from_id, to_id, type_key, created_at)
SELECT child.entity_id, parent.entity_id, 'descends_from', NOW()
FROM languages child
JOIN languages parent ON parent.id = child.parent_language_id
WHERE child.entity_id IS NOT NULL AND parent.entity_id IS NOT NULL AND child.entity_id <> parent.entity_id
ON CONFLICT DO NOTHING;

INSERT INTO relations (from_id, to_id, type_key, notes, created_at)
SELECT s.entity_id, t.entity_id, lr.relation_type, lr.notes, lr.created_at
FROM lexicon_relations lr
JOIN lexicon s ON s.id = lr.source_id
JOIN lexicon t ON t.id = lr.target_id
WHERE lr.relation_type IN ('derived_from', 'loan_from')
	AND s.entity_id IS NOT NULL AND t.entity_id IS NOT NULL AND s.entity_id <> t.entity_id
ON CONFLICT DO NOTHING;

-- compound_of: the legacy table never stored a position — synthesize 1..n
-- per compound in original insert order.
INSERT INTO relations (from_id, to_id, type_key, properties, notes, created_at)
SELECT s.entity_id, t.entity_id, 'compound_of',
	jsonb_build_object('position', ROW_NUMBER() OVER (PARTITION BY lr.source_id ORDER BY lr.id)),
	lr.notes, lr.created_at
FROM lexicon_relations lr
JOIN lexicon s ON s.id = lr.source_id
JOIN lexicon t ON t.id = lr.target_id
WHERE lr.relation_type = 'compound_of'
	AND s.entity_id IS NOT NULL AND t.entity_id IS NOT NULL AND s.entity_id <> t.entity_id
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. Revision consolidation — the unified store, BEFORE anything is dropped
--    (content_revisions is ON DELETE CASCADE under content_records; the
--    drop phase must find history already here). The old polymorphic tuple
--    stays as legacy_* audit columns; readers keep working until the flip.
-- ----------------------------------------------------------------------------

ALTER TABLE entity_revisions RENAME COLUMN entity_type TO legacy_entity_type;
ALTER TABLE entity_revisions RENAME COLUMN entity_id TO legacy_entity_id;
ALTER TABLE entity_revisions ADD COLUMN entity_id INTEGER REFERENCES entities(id);
ALTER TABLE entity_revisions ADD COLUMN facet_key TEXT;
ALTER TABLE entity_revisions ADD COLUMN source_store TEXT NOT NULL DEFAULT 'live';
ALTER TABLE entity_revisions ADD COLUMN source_id INTEGER;
ALTER TABLE entity_revisions ADD CONSTRAINT ck_entity_revisions_facet_key CHECK (
	facet_key IS NULL OR facet_key IN ('article', 'celestial', 'calendar', 'country', 'world_map', 'language', 'lexicon', 'category')
);

CREATE UNIQUE INDEX entity_revisions_source_uq
	ON entity_revisions (source_store, source_id) WHERE source_store <> 'live';
CREATE INDEX idx_entity_revisions_spine ON entity_revisions (entity_id, facet_key, created_at);

-- Idempotent: the writer-flip phase re-runs this for rows written to the
-- legacy stores between now and the flip, then verifies counts per facet.
CREATE FUNCTION spine_consolidate_revisions() RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
	-- Attach live polymorphic rows to the spine. Celestial rows written
	-- since the 0043 unification carry celestial_bodies ids; older rows
	-- carry pre-unification ids that map through the legacy audit columns.
	UPDATE entity_revisions er SET entity_id = cb.entity_id, facet_key = 'celestial'
	FROM celestial_bodies cb
	WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type IN ('star', 'body', 'system')
		AND cb.id = er.legacy_entity_id AND cb.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = cb.entity_id, facet_key = 'celestial'
	FROM celestial_bodies cb
	WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type IN ('star', 'body', 'system')
		AND cb.legacy_kind = er.legacy_entity_type AND cb.legacy_id = er.legacy_entity_id
		AND cb.entity_id IS NOT NULL;

	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'language'
	FROM languages t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'language' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'lexicon'
	FROM lexicon t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'lexicon' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'calendar'
	FROM calendars t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'calendar' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'category'
	FROM categories t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'category' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'country'
	FROM countries t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'country' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;
	UPDATE entity_revisions er SET entity_id = t.entity_id, facet_key = 'world_map'
	FROM world_maps t WHERE er.entity_id IS NULL AND er.source_store = 'live'
		AND er.legacy_entity_type = 'map' AND t.id = er.legacy_entity_id AND t.entity_id IS NOT NULL;

	-- Article history from content_revisions.
	INSERT INTO entity_revisions
		(legacy_entity_type, legacy_entity_id, entity_id, facet_key, title, snapshot, edit_summary, user_id, created_at, source_store, source_id)
	SELECT 'content_record', cr.content_record_id, c.entity_id, 'article', cr.title,
		jsonb_build_object('title', cr.title, 'content', cr.content, 'sizeBytes', cr.size_bytes),
		cr.edit_summary, cr.user_id, cr.created_at, 'content_revisions', cr.id
	FROM content_revisions cr
	JOIN content_records c ON c.id = cr.content_record_id
	ON CONFLICT DO NOTHING;

	-- Lexicon history: snapshots already embed definitions/variants/
	-- relations/inflections. entry_id is SET NULL on delete — orphaned
	-- history consolidates too, just without a spine attachment.
	INSERT INTO entity_revisions
		(legacy_entity_type, legacy_entity_id, entity_id, facet_key, title, snapshot, edit_summary, user_id, created_at, source_store, source_id)
	SELECT 'lexicon', lr.entry_id, l.entity_id, 'lexicon',
		COALESCE(lr.snapshot ->> 'word', '(deleted entry)'), lr.snapshot,
		lr.edit_summary, lr.user_id, lr.created_at, 'lexicon_revisions', lr.id
	FROM lexicon_revisions lr
	LEFT JOIN lexicon l ON l.id = lr.entry_id
	ON CONFLICT DO NOTHING;
END $fn$;

SELECT spine_consolidate_revisions();

-- ----------------------------------------------------------------------------
-- 9. Verification: the invariants close the migration. A violation RAISEs
--    and rolls back the whole file.
-- ----------------------------------------------------------------------------

DO $do$
DECLARE v_count INTEGER;
BEGIN
	SELECT COUNT(*) INTO v_count FROM (
		SELECT e.id
		FROM entities e
		LEFT JOIN entity_routes r ON r.entity_id = e.id
		GROUP BY e.id, e.status
		HAVING (e.status <> 'merged' AND COUNT(r.id) FILTER (WHERE r.is_canonical) <> 1)
			OR (e.status = 'merged' AND COUNT(r.id) FILTER (WHERE r.is_canonical) > 0)
	) AS violations;
	IF v_count > 0 THEN
		RAISE EXCEPTION 'backfill violated the canonical-route invariant for % entities — rolled back', v_count;
	END IF;

	SELECT COUNT(*) INTO v_count
	FROM entities loser
	JOIN entities survivor ON survivor.id = loser.merged_into_id
	WHERE survivor.status = 'merged';
	IF v_count > 0 THEN
		RAISE EXCEPTION 'backfill left % merge chains — rolled back', v_count;
	END IF;
END $do$;
