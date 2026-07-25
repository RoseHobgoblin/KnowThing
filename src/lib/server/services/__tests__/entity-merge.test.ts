// ============================================================================
// Entity merge — step 3 shared test scenarios (integration).
//
// These scenarios define the merge RULES. The Phase 4 backfill migration
// freezes a SQL copy of the merge for replaying history; that frozen copy
// must pass these same scenarios — extend here first, then re-freeze.
//
// Gated on TEST_DATABASE_URL exactly like entity-spine.test.ts; wipes the
// spine tables between tests — throwaway databases only.
// ============================================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, sql } from 'drizzle-orm'
import { entities, entityRoutes } from '$lib/server/db/schema.js'
import {
	createEntityWithRoute,
	findCanonicalRouteViolations,
	findMergeChainViolations,
	type EntitySpineDatabase,
} from '../entity-spine.js'
import { mergeEntities, type MergeDatabase } from '../entity-merge.js'

const url = process.env.TEST_DATABASE_URL

describe.runIf(!!url)('entity merge (integration)', () => {
	let client: postgres.Sql
	let db: EntitySpineDatabase & MergeDatabase

	beforeAll(async () => {
		client = postgres(url!, { max: 1, onnotice: () => {} })
		db = drizzle(client) as unknown as EntitySpineDatabase & MergeDatabase
		// The DB suites share one database and wipe it between tests —
		// serialize across parallel vitest workers.
		await client`SELECT pg_advisory_lock(730_100, 0)`
	}, 120_000)

	afterAll(async () => {
		await client`SELECT pg_advisory_unlock(730_100, 0)`
		await client?.end()
	})

	beforeEach(async () => {
		await db.execute(sql`DELETE FROM entity_routes`)
		await db.execute(sql`DELETE FROM relations`)
		await db.execute(sql`DELETE FROM content_records WHERE entity_id IS NOT NULL`)
		await db.execute(sql`DELETE FROM entity_articles`)
		await db.execute(sql`UPDATE entities SET merged_into_id = NULL, status = 'active'`)
		await db.execute(sql`DELETE FROM entities`)
	})

	async function mintKnow(displayName: string, slug?: string) {
		return createEntityWithRoute(db, { displayName, namespace: 'know', slug })
	}

	async function attachArticle(entityId: number, slug: string) {
		await db.execute(sql`
			INSERT INTO content_records (domain, slug, title, entity_id)
			VALUES ('know', ${slug}, ${slug}, ${entityId})
		`)
	}

	async function entityRow(id: number) {
		const [row] = await db.select().from(entities).where(eq(entities.id, id))
		return row
	}

	async function routesOf(id: number) {
		return db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
	}

	describe('happy path', () => {
		it('repoints routes to the survivor, moves loser-only facets, marks the loser merged', async () => {
			const survivor = await mintKnow('Sun')
			const loser = await mintKnow('The Sun', 'The_Sun')
			await attachArticle(loser, 'The_Sun')

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(true)
			if (!outcome.merged) return
			expect(outcome.report.facetsMoved).toEqual(['article'])
			expect(outcome.report.routesRepointed).toBe(1)

			// Loser: merged, pointing at the survivor, owning no routes.
			expect(await entityRow(loser)).toMatchObject({ status: 'merged', mergedIntoId: survivor })
			expect(await routesOf(loser)).toEqual([])

			// Survivor: its own canonical + the loser's demoted address (301).
			const survivorRoutes = await routesOf(survivor)
			expect(survivorRoutes).toHaveLength(2)
			expect(survivorRoutes.find(r => r.isCanonical)?.slug).toBe('Sun')
			expect(survivorRoutes.find(r => !r.isCanonical)?.slug).toBe('The_Sun')

			// The article facet now belongs to the survivor.
			const [moved] = await db.execute(sql`
				SELECT entity_id AS "entityId" FROM content_records WHERE slug = 'The_Sun'
			`) as unknown as Array<{ entityId: number }>
			expect(moved.entityId).toBe(survivor)

			expect(await findCanonicalRouteViolations(db)).toEqual([])
			expect(await findMergeChainViolations(db)).toEqual([])
		})

		it('A→B then B→C leaves A and B both pointing at C, with every route on C', async () => {
			const a = await mintKnow('Elekoneta (old)', 'Elekoneta_old')
			const b = await mintKnow('Elekoneta (draft)', 'Elekoneta_draft')
			const c = await mintKnow('Elekoneta')

			const firstMerge = await mergeEntities(db, a, b)
			const secondMerge = await mergeEntities(db, b, c)
			expect(firstMerge.merged).toBe(true)
			expect(secondMerge.merged).toBe(true)

			expect(await entityRow(a)).toMatchObject({ status: 'merged', mergedIntoId: c })
			expect(await entityRow(b)).toMatchObject({ status: 'merged', mergedIntoId: c })
			expect(await routesOf(a)).toEqual([])
			expect(await routesOf(b)).toEqual([])
			expect(await routesOf(c)).toHaveLength(3)

			expect(await findMergeChainViolations(db)).toEqual([])
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('refuses to reuse a merged entity on either side', async () => {
			const survivor = await mintKnow('Sun')
			const loser = await mintKnow('Old Sun')
			const third = await mintKnow('Moon')
			const setup = await mergeEntities(db, loser, survivor)
			expect(setup.merged).toBe(true)

			await expect(mergeEntities(db, loser, third)).rejects.toMatchObject({ status: 409 })
			await expect(mergeEntities(db, third, loser)).rejects.toMatchObject({ status: 409 })
			await expect(mergeEntities(db, third, third)).rejects.toMatchObject({ status: 400 })
		})
	})

	describe('facet conflict policy — halt, never overwrite', () => {
		it('halts with a work item when both entities hold the singleton article facet', async () => {
			const survivor = await mintKnow('Sun')
			const loser = await mintKnow('The Sun', 'The_Sun')
			await attachArticle(survivor, 'Sun')
			await attachArticle(loser, 'The_Sun')

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(false)
			if (outcome.merged) return
			expect(outcome.conflicts).toEqual([
				expect.objectContaining({ kind: 'facet', facetKey: 'article' }),
			])

			// Nothing changed: no half-merges.
			expect(await entityRow(loser)).toMatchObject({ status: 'active', mergedIntoId: null })
			const loserRoutes = await routesOf(loser)
			expect(loserRoutes.find(r => r.isCanonical)?.slug).toBe('The_Sun')
			const [still] = await db.execute(sql`
				SELECT entity_id AS "entityId" FROM content_records WHERE slug = 'The_Sun'
			`) as unknown as Array<{ entityId: number }>
			expect(still.entityId).toBe(loser)
		})

		it('spine-native entity_articles counts as the article facet too', async () => {
			const survivor = await mintKnow('Sun')
			const loser = await mintKnow('The Sun', 'The_Sun')
			await db.execute(sql`INSERT INTO entity_articles (entity_id, body) VALUES (${survivor}, 'x')`)
			await attachArticle(loser, 'The_Sun')

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(false)
		})
	})

	describe('language merges — scoped routes', () => {
		it('repoints every lexeme route scoped by the loser language', async () => {
			const loserLang = await mintKnow('Old Sunly')
			const survivorLang = await mintKnow('Sunly')
			const boek = await createEntityWithRoute(db, {
				displayName: 'boek', namespace: 'wordbook', slug: 'boek', scopeEntityId: loserLang,
			})
			const wyrd = await createEntityWithRoute(db, {
				displayName: 'wyrd', namespace: 'wordbook', slug: 'wyrd', scopeEntityId: survivorLang,
			})

			const outcome = await mergeEntities(db, loserLang, survivorLang)
			expect(outcome.merged).toBe(true)
			if (!outcome.merged) return
			expect(outcome.report.scopedRoutesRepointed).toBe(1)

			// Both words now live under the surviving language's scope; the
			// word entities themselves are untouched (renaming/merging a
			// language touches zero lexeme rows).
			const scoped = await db.execute(sql`
				SELECT entity_id AS "entityId", slug FROM entity_routes
				WHERE scope_entity_id = ${survivorLang} ORDER BY slug
			`) as unknown as Array<{ entityId: number, slug: string }>
			expect(scoped).toEqual([
				{ entityId: boek, slug: 'boek' },
				{ entityId: wyrd, slug: 'wyrd' },
			])
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('halts when both languages hold the same word address', async () => {
			const loserLang = await mintKnow('Old Sunly')
			const survivorLang = await mintKnow('Sunly')
			await createEntityWithRoute(db, {
				displayName: 'boek', namespace: 'wordbook', slug: 'boek', scopeEntityId: loserLang,
			})
			await createEntityWithRoute(db, {
				displayName: 'boek', namespace: 'wordbook', slug: 'Boek', scopeEntityId: survivorLang,
			})

			const outcome = await mergeEntities(db, loserLang, survivorLang)
			expect(outcome.merged).toBe(false)
			if (outcome.merged) return
			expect(outcome.conflicts).toEqual([
				expect.objectContaining({ kind: 'scoped_slug', slug: 'boek' }),
			])
			// Scopes untouched.
			expect(await entityRow(loserLang)).toMatchObject({ status: 'active' })
		})
	})

	describe('relation reconciliation', () => {
		it('drops self-edges and dedupes equivalent edges per type rules', async () => {
			const survivor = await mintKnow('boek')
			const loser = await mintKnow('boek (dup)', 'boek_dup')
			const ancestor = await mintKnow('bokam')

			// Equivalent: both derive from the same ancestor → dedupe to one.
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${survivor}, ${ancestor}, 'derived_from')`)
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${loser}, ${ancestor}, 'derived_from')`)
			// Between the pair: becomes a self-edge → deleted.
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${loser}, ${survivor}, 'loan_from')`)

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(true)
			if (!outcome.merged) return
			expect(outcome.report.relationsDeduped).toBe(2)

			const remaining = await db.execute(sql`
				SELECT from_id AS "fromId", to_id AS "toId", type_key AS "typeKey" FROM relations
			`) as unknown as Array<{ fromId: number, toId: number, typeKey: string }>
			expect(remaining).toEqual([{ fromId: survivor, toId: ancestor, typeKey: 'derived_from' }])
		})

		it('halts on conflicting unique_from relations', async () => {
			const survivor = await mintKnow('Sunly')
			const loser = await mintKnow('Sunly (dup)', 'Sunly_dup')
			const parentA = await mintKnow('Proto-Sunly')
			const parentB = await mintKnow('Proto-Roun')
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${survivor}, ${parentA}, 'descends_from')`)
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${loser}, ${parentB}, 'descends_from')`)

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(false)
			if (outcome.merged) return
			expect(outcome.conflicts).toEqual([
				expect.objectContaining({ kind: 'unique_from_relation', typeKey: 'descends_from' }),
			])
		})

		it('repoints inbound compound edges — a merged component may legitimately repeat', async () => {
			const survivor = await mintKnow('boek')
			const loser = await mintKnow('boek (dup)', 'boek_dup')
			const compound = await mintKnow('boekboek')

			// The compound lists both copies at DIFFERENT positions (the same
			// position twice is impossible — the slot index forbids it). After
			// the merge it's one component repeated: reduplication, kept.
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${compound}, ${survivor}, 'compound_of', '{"position": 1}')`)
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${compound}, ${loser}, 'compound_of', '{"position": 2}')`)

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(true)
			if (!outcome.merged) return

			const remaining = await db.execute(sql`
				SELECT to_id AS "toId", (properties ->> 'position')::int AS position
				FROM relations WHERE from_id = ${compound} ORDER BY position
			`) as unknown as Array<{ toId: number, position: number }>
			expect(remaining).toEqual([
				{ toId: survivor, position: 1 },
				{ toId: survivor, position: 2 },
			])
		})

		it('halts when both compounds fill the same position with different components', async () => {
			const survivor = await mintKnow('sunboek')
			const loser = await mintKnow('sunboek (dup)', 'sunboek_dup')
			const sun = await mintKnow('sun')
			const boek = await mintKnow('boek')
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${survivor}, ${sun}, 'compound_of', '{"position": 1}')`)
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${loser}, ${boek}, 'compound_of', '{"position": 1}')`)

			const outcome = await mergeEntities(db, loser, survivor)
			expect(outcome.merged).toBe(false)
			if (outcome.merged) return
			expect(outcome.conflicts).toEqual([
				expect.objectContaining({ kind: 'compound_position', position: 1 }),
			])
		})
	})
})
