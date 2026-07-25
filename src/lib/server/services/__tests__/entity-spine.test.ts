// ============================================================================
// Entity spine — Phase 1 invariant tests (integration).
//
// Runs against a REAL Postgres with the migration chain applied — the spine's
// guarantees live in unique indexes and CHECK constraints that mocks can't
// exercise. Gated on TEST_DATABASE_URL; skipped silently when unset:
//
//   createdb knowthing_test
//   for f in drizzle/0*.sql; do psql knowthing_test -f "$f"; done   # skip 0000
//   TEST_DATABASE_URL=postgres://localhost/knowthing_test npm run test
//
// The spine tables are wiped between tests — point this ONLY at a throwaway
// database.
// ============================================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, sql } from 'drizzle-orm'
import { entities, entityRoutes } from '$lib/server/db/schema.js'
import {
	archiveEntity,
	createEntityWithRoute,
	countSpinelessRows,
	findCanonicalRouteViolations,
	findMergeChainViolations,
	mintOrAttachFacetEntity,
	repointCanonicalRoute,
	type EntitySpineDatabase,
} from '../entity-spine.js'

const url = process.env.TEST_DATABASE_URL

const hasFacet = (answer: boolean) => async () => answer

async function expectStatus(promise: Promise<unknown>, status: number) {
	try {
		await promise
		expect.unreachable(`expected HTTP ${status} error`)
	} catch (error) {
		expect((error as { status?: number }).status).toBe(status)
	}
}

/** Drizzle may wrap the driver error — check the SQLSTATE on either level. */
async function expectSqlState(promise: Promise<unknown>, code: string) {
	try {
		await promise
		expect.unreachable(`expected SQLSTATE ${code}`)
	} catch (error) {
		const actual = (error as { code?: string }).code
			?? ((error as { cause?: { code?: string } }).cause?.code)
		expect(actual).toBe(code)
	}
}

describe.runIf(!!url)('entity spine (integration)', () => {
	let client: postgres.Sql
	let db: EntitySpineDatabase

	beforeAll(async () => {
		client = postgres(url!, { max: 1, onnotice: () => {} })
		db = drizzle(client) as unknown as EntitySpineDatabase
		// The DB suites share one database and wipe it between tests —
		// serialize across parallel vitest workers.
		await client`SELECT pg_advisory_lock(730_100, 0)`
	}, 120_000)

	afterAll(async () => {
		await client`SELECT pg_advisory_unlock(730_100, 0)`
		await client?.end()
	})

	beforeEach(async () => {
		// Order matters: routes, relations, and facet rows reference entities.
		await db.execute(sql`DELETE FROM entity_routes`)
		await db.execute(sql`DELETE FROM relations`)
		await db.execute(sql`DELETE FROM content_records WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE entities SET merged_into_id = NULL, status = 'active'`)
		await db.execute(sql`DELETE FROM entities`)
	})

	describe('createEntityWithRoute', () => {
		it('mints entity + exactly one canonical route atomically', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Aide the Sun', namespace: 'know' })

			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			expect(routes).toHaveLength(1)
			expect(routes[0]).toMatchObject({ slug: 'Aide_the_Sun', namespace: 'know', isCanonical: true })
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('preserves legacy hyphen slugs as noncanonical aliases, skipping case-collisions', async () => {
			const id = await createEntityWithRoute(db, {
				displayName: 'Aide the Sun',
				namespace: 'know',
				legacySlugs: ['aide-the-sun', 'aide_the_sun'],
			})

			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			// 'aide_the_sun' is the canonical address in different case — skipped.
			expect(routes).toHaveLength(2)
			expect(routes.filter(r => r.isCanonical)).toHaveLength(1)
			expect(routes.find(r => !r.isCanonical)?.slug).toBe('aide-the-sun')
		})

		it('409s when the canonical address is taken', async () => {
			await createEntityWithRoute(db, { displayName: 'Sun', namespace: 'know' })
			await expectStatus(
				createEntityWithRoute(db, { displayName: 'sun', namespace: 'know' }),
				409,
			)
		})

		it('scopes wordbook routes by language and keeps homograph siblings distinct', async () => {
			const lang = await createEntityWithRoute(db, { displayName: 'Sunly', namespace: 'know' })
			const boek = await createEntityWithRoute(db, {
				displayName: 'boek', namespace: 'wordbook', slug: 'boek', scopeEntityId: lang,
			})
			const boek2 = await createEntityWithRoute(db, {
				displayName: 'boek', namespace: 'wordbook', slug: 'boek-2', scopeEntityId: lang,
			})

			expect(boek).not.toBe(boek2)
			expect(await findCanonicalRouteViolations(db)).toEqual([])
			// Same word under the same scope is one address.
			await expectStatus(
				createEntityWithRoute(db, { displayName: 'Boek', namespace: 'wordbook', slug: 'Boek', scopeEntityId: lang }),
				409,
			)
		})

		it('rejects an unsluggable name', async () => {
			await expectStatus(
				createEntityWithRoute(db, { displayName: '???', namespace: 'know' }),
				400,
			)
		})
	})

	describe('mintOrAttachFacetEntity', () => {
		it('attaches to an active entity that lacks the facet (country + its article are one referent)', async () => {
			const pageEntity = await createEntityWithRoute(db, { displayName: 'Roun Basin', namespace: 'know' })

			const result = await mintOrAttachFacetEntity(db, {
				displayName: 'Roun Basin',
				namespace: 'know',
				legacySlugs: ['roun-basin'],
				hasFacet: hasFacet(false),
			})

			expect(result).toEqual({ entityId: pageEntity, attached: true })
			const aliases = await db
				.select()
				.from(entityRoutes)
				.where(eq(entityRoutes.entityId, pageEntity))
			// The hyphen alias is a distinct address from Roun_Basin — preserved.
			expect(aliases.some(r => r.slug === 'roun-basin' && !r.isCanonical)).toBe(true)
			// A case-identical alias would be the SAME address and is skipped.
			expect(aliases.filter(r => r.isCanonical)).toHaveLength(1)
		})

		it('409s when the entity already carries the facet', async () => {
			await createEntityWithRoute(db, { displayName: 'Ilseth', namespace: 'know' })
			await expectStatus(
				mintOrAttachFacetEntity(db, { displayName: 'Ilseth', namespace: 'know', hasFacet: hasFacet(true) }),
				409,
			)
		})

		it('409s on a retired (noncanonical) address — retired slugs are never reused', async () => {
			await createEntityWithRoute(db, { displayName: 'New Name', namespace: 'know', legacySlugs: ['old-name'] })
			await expectStatus(
				mintOrAttachFacetEntity(db, { displayName: 'old name', namespace: 'know', slug: 'Old-name', hasFacet: hasFacet(false) }),
				409,
			)
		})

		it('mints fresh when the address is free', async () => {
			const result = await mintOrAttachFacetEntity(db, {
				displayName: 'Vdi Dao', namespace: 'know', hasFacet: hasFacet(false),
			})
			expect(result.attached).toBe(false)
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})
	})

	describe('repointCanonicalRoute', () => {
		it('demotes the old canonical (it 301s forever) and inserts the new one', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Old Title', namespace: 'know' })

			await repointCanonicalRoute(db, id, { namespace: 'know', slug: 'New_Title', displayName: 'New Title' })

			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			expect(routes).toHaveLength(2)
			expect(routes.find(r => r.isCanonical)?.slug).toBe('New_Title')
			expect(routes.find(r => !r.isCanonical)?.slug).toBe('Old_Title')

			const [entity] = await db.select().from(entities).where(eq(entities.id, id))
			expect(entity.displayName).toBe('New Title')
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('re-promotes an owned retired route instead of duplicating the address', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Old Title', namespace: 'know' })
			await repointCanonicalRoute(db, id, { namespace: 'know', slug: 'New_Title' })
			await repointCanonicalRoute(db, id, { namespace: 'know', slug: 'Old_Title' })

			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			expect(routes).toHaveLength(2)
			expect(routes.find(r => r.isCanonical)?.slug).toBe('Old_Title')
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('updates spelling in place when only case changes', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Boek', namespace: 'know' })
			await repointCanonicalRoute(db, id, { namespace: 'know', slug: 'BOEK' })

			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			expect(routes).toHaveLength(1)
			expect(routes[0].slug).toBe('BOEK')
		})

		it('409s when the target address belongs to another entity', async () => {
			await createEntityWithRoute(db, { displayName: 'Sun', namespace: 'know' })
			const other = await createEntityWithRoute(db, { displayName: 'Moon', namespace: 'know' })
			await expectStatus(
				repointCanonicalRoute(db, other, { namespace: 'know', slug: 'Sun' }),
				409,
			)
		})
	})

	describe('archiveEntity', () => {
		it('archives instead of deleting; every route keeps resolving', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Gone Page', namespace: 'know', legacySlugs: ['gone-page'] })
			await archiveEntity(db, id)

			const [entity] = await db.select().from(entities).where(eq(entities.id, id))
			expect(entity.status).toBe('archived')
			const routes = await db.select().from(entityRoutes).where(eq(entityRoutes.entityId, id))
			expect(routes).toHaveLength(2)
			expect(await findCanonicalRouteViolations(db)).toEqual([])
		})

		it('is a no-op for spine-less legacy rows (NULL entity id)', async () => {
			await expect(archiveEntity(db, null)).resolves.toBeUndefined()
		})
	})

	describe('invariants', () => {
		it('flags an entity whose canonical route was lost', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'Sun', namespace: 'know' })
			await db.execute(sql`UPDATE entity_routes SET is_canonical = FALSE WHERE entity_id = ${id}`)

			const violations = await findCanonicalRouteViolations(db)
			expect(violations).toHaveLength(1)
			expect(violations[0]).toMatchObject({ entityId: id, canonicalCount: 0 })
		})

		it('flags a merged entity that still owns a canonical route', async () => {
			const survivor = await createEntityWithRoute(db, { displayName: 'Survivor', namespace: 'know' })
			const loser = await createEntityWithRoute(db, { displayName: 'Loser', namespace: 'know' })
			await db.execute(sql`UPDATE entities SET status = 'merged', merged_into_id = ${survivor} WHERE id = ${loser}`)

			const violations = await findCanonicalRouteViolations(db)
			expect(violations.map(v => v.entityId)).toEqual([loser])
		})

		it('flags merge chains — every loser must point at the FINAL survivor', async () => {
			const a = await createEntityWithRoute(db, { displayName: 'A', namespace: 'know' })
			const b = await createEntityWithRoute(db, { displayName: 'B', namespace: 'know' })
			const c = await createEntityWithRoute(db, { displayName: 'C', namespace: 'know' })
			await db.execute(sql`DELETE FROM entity_routes WHERE entity_id IN (${a}, ${b})`)
			await db.execute(sql`UPDATE entities SET status = 'merged', merged_into_id = ${c} WHERE id = ${b}`)
			await db.execute(sql`UPDATE entities SET status = 'merged', merged_into_id = ${b} WHERE id = ${a}`)

			const violations = await findMergeChainViolations(db)
			expect(violations).toEqual([{ entityId: a, mergedIntoId: b }])

			// Flattening A onto the final survivor clears it.
			await db.execute(sql`UPDATE entities SET merged_into_id = ${c} WHERE id = ${a}`)
			expect(await findMergeChainViolations(db)).toEqual([])
		})

		it('counts rows missing entity_id per facet table — the writer-flip gate', async () => {
			// The test DB may carry migration-seeded legacy rows; work relative
			// to that baseline.
			const before = await countSpinelessRows(db)
			const baseline = before.find(row => row.facetTable === 'content_records')?.rows ?? 0

			await db.execute(sql`INSERT INTO content_records (domain, slug, title) VALUES ('know', 'Spineless_Probe', 'Spineless Probe')`)
			const during = await countSpinelessRows(db)
			expect(during.find(row => row.facetTable === 'content_records')?.rows).toBe(baseline + 1)

			// Attaching the row to the spine clears it from the report.
			const id = await createEntityWithRoute(db, { displayName: 'Spineless Probe', namespace: 'know' })
			await db.execute(sql`UPDATE content_records SET entity_id = ${id} WHERE slug = 'Spineless_Probe'`)
			const after = await countSpinelessRows(db)
			expect(after.find(row => row.facetTable === 'content_records')?.rows ?? 0).toBe(baseline)

			await db.execute(sql`DELETE FROM content_records WHERE slug = 'Spineless_Probe'`)
		})
	})

	describe('DB-level acceptance (constraints the app never sees)', () => {
		it('rejects a non-NFC slug and collides precomposed with normalized combining marks', async () => {
			const id = await createEntityWithRoute(db, { displayName: 'x', namespace: 'know', slug: 'bo\u00E9k' })

			// Combining-mark spelling: rejected outright as non-NFC.
			await expectSqlState(db.execute(
				sql`INSERT INTO entity_routes (entity_id, namespace, slug) VALUES (${id}, 'know', ${'boe\u0301k'})`,
			), '23514')

			// The SAME spelling normalized (what the minting path emits) is the
			// same address — the unique index fires.
			await expectSqlState(db.execute(
				sql`INSERT INTO entity_routes (entity_id, namespace, slug) VALUES (${id}, 'know', ${'boe\u0301k'.normalize('NFC')})`,
			), '23505')
		})

		it('enforces compound_of position shape and per-position uniqueness', async () => {
			const from = await createEntityWithRoute(db, { displayName: 'sunboek', namespace: 'know' })
			const to = await createEntityWithRoute(db, { displayName: 'boek', namespace: 'know' })
			const to2 = await createEntityWithRoute(db, { displayName: 'sun', namespace: 'know' })

			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${from}, ${to}, 'compound_of', '{"position": 1}')`)
			await db.execute(sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${from}, ${to2}, 'compound_of', '{"position": 3}')`)

			await expectSqlState(db.execute(
				sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${to}, ${to2}, 'compound_of', '{"position": 1.5}')`,
			), '23514')
			await expectSqlState(db.execute(
				sql`INSERT INTO relations (from_id, to_id, type_key) VALUES (${to}, ${to2}, 'compound_of')`,
			), '23514')
			await expectSqlState(db.execute(
				sql`INSERT INTO relations (from_id, to_id, type_key, properties) VALUES (${from}, ${to2}, 'compound_of', '{"position": 1}')`,
			), '23505')
		})

		it('seeds derived types that reject nothing here — no rows, no indexes (doctrine)', async () => {
			const derived = await db.execute(sql`SELECT key FROM relation_types WHERE derived ORDER BY key`)
			expect((derived as unknown as Array<{ key: string }>).map(r => r.key)).toEqual(['member_of_system', 'orbits'])
			// depicts awaits media on the spine; cognate_of is computed.
			const absent = await db.execute(sql`SELECT key FROM relation_types WHERE key IN ('depicts', 'cognate_of')`)
			expect(absent).toHaveLength(0)
		})
	})
})
