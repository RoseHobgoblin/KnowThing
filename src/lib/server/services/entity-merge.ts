// ============================================================================
// Entity merge service — step 3 of the Bytes & Bits migration order.
//
// One entity per referent, via THIS service: Sun star + Sun article = one
// entity, two facets. The transaction order is law (demote-before-repoint or
// the one-canonical index fires mid-transaction):
//
//   lock both entities → resolve conflicts (halt with work items, never
//   guess editorially) → demote loser's canonical route → repoint loser's
//   routes to the survivor → repoint routes SCOPED BY the loser (a merged
//   language scopes its lexemes' routes) → move loser-only facets →
//   reconcile authored relations (self-edges out, equivalents deduped per
//   type rules) → flatten merge chains (every pointer points at the FINAL
//   thing) → mark loser merged → verify the survivor holds exactly one
//   canonical route.
//
// Facet conflict policy (the `elekoneta` triage generalized): loser-only
// facet → move. Both hold a singleton facet → halt, emit a work item —
// never silently overwrite. Conflicting unique_from relations → halt +
// report. Scoped-slug collisions (both languages holding a `boek` route) →
// halt — merge the equivalent lexemes first, never silently choose.
//
// The Phase 4 backfill migration FREEZES a SQL copy of these rules (created
// by the migration, used for the backfill, dropped after — never importing
// this live service); this file and that copy share the test scenarios in
// __tests__/entity-merge.test.ts.
//
// content_links scope repointing (`written_scope_entity_id`) joins this
// order when the redesigned mention cache lands with the backfill phase —
// the Phase 1 schema has no spine-scoped link columns yet.
// ============================================================================

import { error } from '@sveltejs/kit'
import { sql } from 'drizzle-orm'
import type { db } from '$lib/server/db/index.js'
import type { EntitySpineDatabase } from '$lib/server/services/entity-spine.js'

export type MergeDatabase = Pick<typeof db, 'transaction'>

/** Advisory-lock namespace for entity merges (arbitrary, project-unique). */
const MERGE_LOCK_NAMESPACE = 730_049

/**
 * Facet stores checked for singleton conflicts and moved loser→survivor.
 * The article facet spans two stores during the transition: legacy
 * content_records and spine-native entity_articles.
 */
const FACET_STORES: ReadonlyArray<{ facetKey: string, table: string }> = [
	{ facetKey: 'article', table: 'content_records' },
	{ facetKey: 'article', table: 'entity_articles' },
	{ facetKey: 'calendar', table: 'calendars' },
	{ facetKey: 'language', table: 'languages' },
	{ facetKey: 'lexicon', table: 'lexicon' },
	{ facetKey: 'celestial', table: 'celestial_bodies' },
	{ facetKey: 'country', table: 'countries' },
	{ facetKey: 'world_map', table: 'world_maps' },
	{ facetKey: 'category', table: 'categories' },
]

export type MergeConflict =
	| { kind: 'facet', facetKey: string, detail: string }
	| { kind: 'unique_from_relation', typeKey: string, detail: string }
	| { kind: 'compound_position', position: number, detail: string }
	| { kind: 'scoped_slug', slug: string, detail: string }

export interface MergeReport {
	loserId: number
	survivorId: number
	facetsMoved: string[]
	routesRepointed: number
	scopedRoutesRepointed: number
	relationsRepointed: number
	relationsDeduped: number
	chainsFlattened: number
}

/**
 * Halted merges roll back completely and surface the blockers as work items
 * for editorial triage; nothing is overwritten and nothing half-moves.
 */
export type MergeOutcome =
	| { merged: true, report: MergeReport }
	| { merged: false, conflicts: MergeConflict[] }

interface EntityRow {
	id: number
	status: string
	merged_into_id: number | null
}

async function detectFacetConflicts(
	tx: EntitySpineDatabase,
	loserId: number,
	survivorId: number,
): Promise<MergeConflict[]> {
	const conflicts: MergeConflict[] = []
	const presence = new Map<string, { loser: boolean, survivor: boolean }>()

	for (const store of FACET_STORES) {
		const rows = await tx.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE entity_id = ${loserId})::int AS loser,
				COUNT(*) FILTER (WHERE entity_id = ${survivorId})::int AS survivor
			FROM ${sql.raw(store.table)}
		`) as unknown as Array<{ loser: number, survivor: number }>
		const current = presence.get(store.facetKey) ?? { loser: false, survivor: false }
		presence.set(store.facetKey, {
			loser: current.loser || rows[0].loser > 0,
			survivor: current.survivor || rows[0].survivor > 0,
		})
	}

	for (const [facetKey, has] of presence) {
		if (has.loser && has.survivor) {
			conflicts.push({
				kind: 'facet',
				facetKey,
				detail: `Both entities carry a ${facetKey} facet — merge or delete one side first; nothing was overwritten.`,
			})
		}
	}
	return conflicts
}

/**
 * Conflicts among authored relations, evaluated as if the merge had already
 * repointed loser endpoints to the survivor. Edges BETWEEN the pair are
 * excluded — they become self-edges and are deleted, not moved.
 */
async function detectRelationConflicts(
	tx: EntitySpineDatabase,
	loserId: number,
	survivorId: number,
): Promise<MergeConflict[]> {
	const conflicts: MergeConflict[] = []

	// unique_from types: after repointing, the survivor would hold two
	// from-edges of the same type with DIFFERENT targets.
	const uniqueFrom = await tx.execute(sql`
		SELECT l.type_key AS "typeKey", l.to_id AS "loserTo", s.to_id AS "survivorTo"
		FROM relations l
		JOIN relations s ON s.type_key = l.type_key AND s.from_id = ${survivorId}
		JOIN relation_types rt ON rt.key = l.type_key
		WHERE l.from_id = ${loserId}
			AND rt.unique_from
			AND NOT rt.derived
			AND l.to_id NOT IN (${loserId}, ${survivorId})
			AND s.to_id NOT IN (${loserId}, ${survivorId})
			AND l.to_id <> s.to_id
	`) as unknown as Array<{ typeKey: string, loserTo: number, survivorTo: number }>
	for (const row of uniqueFrom) {
		conflicts.push({
			kind: 'unique_from_relation',
			typeKey: row.typeKey,
			detail: `Both entities have a ${row.typeKey} edge with different targets (${row.loserTo} vs ${row.survivorTo}) — resolve which one is true first.`,
		})
	}

	// compound_of: the position slot is unique per compound. Same position +
	// same component dedupes; same position + different components is an
	// editorial conflict.
	const positions = await tx.execute(sql`
		SELECT (l.properties ->> 'position')::int AS position, l.to_id AS "loserTo", s.to_id AS "survivorTo"
		FROM relations l
		JOIN relations s ON s.type_key = 'compound_of'
			AND s.from_id = ${survivorId}
			AND (s.properties ->> 'position')::int = (l.properties ->> 'position')::int
		WHERE l.type_key = 'compound_of'
			AND l.from_id = ${loserId}
			AND l.to_id NOT IN (${loserId}, ${survivorId})
			AND s.to_id NOT IN (${loserId}, ${survivorId})
			AND l.to_id <> s.to_id
	`) as unknown as Array<{ position: number, loserTo: number, survivorTo: number }>
	for (const row of positions) {
		conflicts.push({
			kind: 'compound_position',
			position: row.position,
			detail: `Both compounds list a component at position ${row.position} (${row.loserTo} vs ${row.survivorTo}) — reorder one side first.`,
		})
	}

	return conflicts
}

/**
 * Scoped-slug collisions: both languages hold a `boek` route. Repointing
 * would violate the address index — and silently choosing a side would
 * orphan real word URLs. Halt; merge the equivalent lexemes first.
 */
async function detectScopedSlugConflicts(
	tx: EntitySpineDatabase,
	loserId: number,
	survivorId: number,
): Promise<MergeConflict[]> {
	const rows = await tx.execute(sql`
		SELECT l.slug
		FROM entity_routes l
		JOIN entity_routes s ON s.scope_entity_id = ${survivorId}
			AND s.namespace = l.namespace
			AND LOWER(s.slug) = LOWER(l.slug)
		WHERE l.scope_entity_id = ${loserId}
	`) as unknown as Array<{ slug: string }>

	return rows.map(row => ({
		kind: 'scoped_slug' as const,
		slug: row.slug,
		detail: `Both languages hold a "${row.slug}" route — merge the equivalent lexemes (or rename one) first; never silently chosen.`,
	}))
}

/**
 * Merge the loser entity into the survivor. Runs in its own transaction
 * under a per-entity advisory lock (taken in ascending id order so
 * concurrent merges can't deadlock or interleave into chains).
 */
export async function mergeEntities(
	database: MergeDatabase,
	loserId: number,
	survivorId: number,
): Promise<MergeOutcome> {
	if (loserId === survivorId) throw error(400, 'An entity cannot be merged into itself')

	return database.transaction(async (tx) => {
		const [first, second] = loserId < survivorId ? [loserId, survivorId] : [survivorId, loserId]
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${MERGE_LOCK_NAMESPACE}, ${first})`)
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${MERGE_LOCK_NAMESPACE}, ${second})`)

		const rows = await tx.execute(sql`
			SELECT id, status, merged_into_id
			FROM entities
			WHERE id IN (${loserId}, ${survivorId})
			FOR UPDATE
		`) as unknown as EntityRow[]
		const loser = rows.find(row => row.id === loserId)
		const survivor = rows.find(row => row.id === survivorId)
		if (!loser || !survivor) throw error(404, 'Entity not found')
		if (loser.status === 'merged') {
			throw error(409, 'This entity was already merged — merge chains are not allowed')
		}
		if (survivor.status === 'merged') {
			throw error(409, `The survivor was itself merged (into entity ${survivor.merged_into_id}) — merge into the final entity instead`)
		}

		// ---- Conflict triage: read-only, so a halt mutates nothing. ----
		const conflicts = [
			...await detectFacetConflicts(tx, loserId, survivorId),
			...await detectRelationConflicts(tx, loserId, survivorId),
			...await detectScopedSlugConflicts(tx, loserId, survivorId),
		]
		if (conflicts.length > 0) return { merged: false, conflicts }

		// ---- Execute, in the transaction order the design fixes. ----

		// Demote BEFORE repoint, or the one-canonical index fires.
		await tx.execute(sql`
			UPDATE entity_routes SET is_canonical = FALSE
			WHERE entity_id = ${loserId} AND is_canonical
		`)
		const repointed = await tx.execute(sql`
			UPDATE entity_routes SET entity_id = ${survivorId}
			WHERE entity_id = ${loserId}
		`) as unknown as { count?: number }

		// Routes SCOPED BY the loser: a merged language carries its lexemes'
		// addresses with it (collisions were ruled out above).
		const scoped = await tx.execute(sql`
			UPDATE entity_routes SET scope_entity_id = ${survivorId}
			WHERE scope_entity_id = ${loserId}
		`) as unknown as { count?: number }

		// Loser-only facets move whole; conflicts already halted the merge.
		const facetsMoved: string[] = []
		for (const store of FACET_STORES) {
			const moved = await tx.execute(sql`
				UPDATE ${sql.raw(store.table)} SET entity_id = ${survivorId}
				WHERE entity_id = ${loserId}
			`) as unknown as { count?: number }
			if ((moved.count ?? 0) > 0 && !facetsMoved.includes(store.facetKey)) {
				facetsMoved.push(store.facetKey)
			}
		}

		// Authored relations: edges between the pair become self-edges → gone.
		const selfEdges = await tx.execute(sql`
			DELETE FROM relations
			WHERE (from_id = ${loserId} AND to_id = ${survivorId})
				OR (from_id = ${survivorId} AND to_id = ${loserId})
		`) as unknown as { count?: number }

		// Equivalent edges dedupe per type rules: same type + same far
		// endpoint (+ same position for compound_of) — keep the survivor's.
		const dedupedFrom = await tx.execute(sql`
			DELETE FROM relations l
			USING relations s
			WHERE l.from_id = ${loserId}
				AND s.from_id = ${survivorId}
				AND s.type_key = l.type_key
				AND s.to_id = l.to_id
				AND (l.type_key <> 'compound_of'
					OR (s.properties ->> 'position')::int = (l.properties ->> 'position')::int)
		`) as unknown as { count?: number }
		const dedupedTo = await tx.execute(sql`
			DELETE FROM relations l
			USING relations s
			WHERE l.to_id = ${loserId}
				AND s.to_id = ${survivorId}
				AND s.type_key = l.type_key
				AND s.from_id = l.from_id
				AND (l.type_key <> 'compound_of'
					OR (s.properties ->> 'position')::int = (l.properties ->> 'position')::int)
		`) as unknown as { count?: number }

		const repointedFrom = await tx.execute(sql`
			UPDATE relations SET from_id = ${survivorId} WHERE from_id = ${loserId}
		`) as unknown as { count?: number }
		const repointedTo = await tx.execute(sql`
			UPDATE relations SET to_id = ${survivorId} WHERE to_id = ${loserId}
		`) as unknown as { count?: number }

		// No chains: entities that merged into the loser now point at the
		// FINAL survivor (their routes already moved when THEY merged).
		const flattened = await tx.execute(sql`
			UPDATE entities SET merged_into_id = ${survivorId}, updated_at = NOW()
			WHERE merged_into_id = ${loserId}
		`) as unknown as { count?: number }

		await tx.execute(sql`
			UPDATE entities
			SET status = 'merged', merged_into_id = ${survivorId}, updated_at = NOW()
			WHERE id = ${loserId}
		`)

		// The invariant closes the transaction: exactly one canonical on the
		// survivor, or everything rolls back.
		const canonical = await tx.execute(sql`
			SELECT COUNT(*)::int AS count FROM entity_routes
			WHERE entity_id = ${survivorId} AND is_canonical
		`) as unknown as Array<{ count: number }>
		if (canonical[0].count !== 1) {
			throw error(500, `Merge left the survivor with ${canonical[0].count} canonical routes — rolled back`)
		}

		return {
			merged: true,
			report: {
				loserId,
				survivorId,
				facetsMoved,
				routesRepointed: repointed.count ?? 0,
				scopedRoutesRepointed: scoped.count ?? 0,
				relationsRepointed: (repointedFrom.count ?? 0) + (repointedTo.count ?? 0),
				relationsDeduped: (selfEdges.count ?? 0) + (dedupedFrom.count ?? 0) + (dedupedTo.count ?? 0),
				chainsFlattened: flattened.count ?? 0,
			},
		}
	})
}
