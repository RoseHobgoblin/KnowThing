// ============================================================================
// Route resolution — reader-flip acceptance (integration).
//
// Pins the routing model: canonical → 200, noncanonical → 301, archived
// canonical → 200 + banner, and the five-step Wordbook resolution algorithm
// with all red-link states. Gated on TEST_DATABASE_URL like the other spine
// suites; wipes spine tables between tests — throwaway databases only.
// ============================================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import {
	archiveEntity,
	createEntityWithRoute,
	repointCanonicalRoute,
	spinePreflight,
	type EntitySpineDatabase,
} from '../entity-spine.js'
import {
	resolveAddress,
	resolveKnowPage,
	resolveTypedFacet,
	resolveWordbook,
	resolveWordbookLanguage,
} from '../entity-resolver.js'

const url = process.env.TEST_DATABASE_URL

describe.runIf(!!url)('entity resolver (integration)', () => {
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
		await db.execute(sql`DELETE FROM content_records WHERE domain = 'know'`)
		await db.execute(sql`UPDATE content_records SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE calendars SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		// This suite creates real language/lexicon rows (the migration chain
		// seeds none) — remove them outright, detached or not.
		await db.execute(sql`DELETE FROM lexicon`)
		await db.execute(sql`DELETE FROM languages`)
		await db.execute(sql`UPDATE celestial_bodies SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE countries SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE world_maps SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE categories SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`UPDATE entity_revisions SET entity_id = NULL WHERE entity_id IS NOT NULL`)
		await db.execute(sql`DELETE FROM entity_routes`)
		await db.execute(sql`DELETE FROM relations`)
		await db.execute(sql`DELETE FROM entity_articles`)
		await db.execute(sql`UPDATE entities SET merged_into_id = NULL, status = 'active'`)
		await db.execute(sql`DELETE FROM entities`)
		await db.execute(sql`DELETE FROM spine_work_items`)
	})

	async function mintKnowPage(title: string, slug: string) {
		const entityId = await createEntityWithRoute(db, { displayName: title, namespace: 'know', slug })
		await db.execute(sql`
			INSERT INTO content_records (domain, slug, title, entity_id)
			VALUES ('know', ${slug}, ${title}, ${entityId})
		`)
		return entityId
	}

	async function mintLanguage(name: string, slug: string) {
		const entityId = await createEntityWithRoute(db, {
			displayName: name, namespace: 'know', legacySlugs: [slug],
		})
		const rows = await db.execute(sql`
			INSERT INTO languages (name, slug, entity_id) VALUES (${name}, ${slug}, ${entityId})
			RETURNING id
		`) as unknown as Array<{ id: number }>
		return { entityId, languageId: rows[0].id }
	}

	async function mintLexeme(word: string, languageId: number, languageEntityId: number, routeSlug: string, homographNumber = 1) {
		const entityId = await createEntityWithRoute(db, {
			displayName: word, namespace: 'wordbook', slug: routeSlug, scopeEntityId: languageEntityId,
		})
		await db.execute(sql`
			INSERT INTO lexicon (word, language_id, homograph_number, entity_id)
			VALUES (${word}, ${languageId}, ${homographNumber}, ${entityId})
		`)
		return entityId
	}

	describe('know pages', () => {
		it('renders the canonical address and 301s every other spelling of it', async () => {
			await mintKnowPage('Aide the Sun', 'Aide_the_Sun')

			const canonical = await resolveKnowPage(db, 'Aide_the_Sun')
			expect(canonical?.kind).toBe('article')
			if (canonical?.kind !== 'article') return
			expect(canonical.record.title).toBe('Aide the Sun')
			expect(canonical.archived).toBe(false)

			const wrongCase = await resolveKnowPage(db, 'aide_the_sun')
			expect(wrongCase).toEqual({ kind: 'redirect', href: '/know/Aide_the_Sun' })
		})

		it('301s a retired address to the canonical forever', async () => {
			const id = await mintKnowPage('Old Title', 'Old_Title')
			await repointCanonicalRoute(db, id, { namespace: 'know', slug: 'New_Title' })

			expect(await resolveKnowPage(db, 'Old_Title')).toEqual({ kind: 'redirect', href: '/know/New_Title' })
			const canonical = await resolveKnowPage(db, 'New_Title')
			expect(canonical?.kind).toBe('article')
		})

		it('archived canonical → 200 with the banner flag; all routes preserved, no 404', async () => {
			const id = await mintKnowPage('Gone Page', 'Gone_Page')
			await archiveEntity(db, id)

			const resolution = await resolveKnowPage(db, 'Gone_Page')
			expect(resolution?.kind).toBe('article')
			if (resolution?.kind !== 'article') return
			expect(resolution.archived).toBe(true)
		})

		it('301s an article-less celestial entity to its typed page (Celestial: renders nothing)', async () => {
			const entityId = await createEntityWithRoute(db, { displayName: 'Therne', namespace: 'know', legacySlugs: ['therne'] })
			await db.execute(sql`UPDATE celestial_bodies SET entity_id = ${entityId} WHERE slug = 'therne'`)

			// /know/Therne and the retired hyphen alias both land on the typed page.
			expect(await resolveKnowPage(db, 'Therne')).toEqual({ kind: 'redirect', href: '/Celestial:therne' })
			expect(await resolveKnowPage(db, 'therne')).toEqual({ kind: 'redirect', href: '/Celestial:therne' })
		})

		it('returns null for unrouted addresses so readers can fall back to legacy lookup', async () => {
			expect(await resolveKnowPage(db, 'Never_Minted')).toBeNull()
		})
	})

	describe('the Wordbook resolution algorithm', () => {
		it('resolves canonical segments without a redirect', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			await mintLexeme('boek', lang.languageId, lang.entityId, 'boek')

			const resolution = await resolveWordbook(db, 'Sunly', 'boek')
			expect(resolution.state).toBe('resolved')
			if (resolution.state !== 'resolved') return
			expect(resolution.lexeme.word).toBe('boek')
			expect(resolution.needsRedirect).toBe(false)
			expect(resolution.canonicalHref).toBe('/Wordbook/Sunly/boek')
		})

		it('301s when either entered segment was noncanonical', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			await mintLexeme('boek', lang.languageId, lang.entityId, 'boek')

			// Legacy hyphen language slug → same page, redirect to canonical pair.
			const viaAlias = await resolveWordbook(db, 'sunly', 'boek')
			expect(viaAlias.state).toBe('resolved')
			if (viaAlias.state !== 'resolved') return
			expect(viaAlias.needsRedirect).toBe(true)
			expect(viaAlias.canonicalHref).toBe('/Wordbook/Sunly/boek')

			const viaCase = await resolveWordbook(db, 'Sunly', 'BOEK')
			expect(viaCase.state === 'resolved' && viaCase.needsRedirect).toBe(true)
		})

		it('renaming a language touches zero lexeme rows; old word URLs 301 via the algorithm', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			await mintLexeme('boek', lang.languageId, lang.entityId, 'boek')

			// Rename: canonical route moves; 'Sunly' and 'sunly' become retired
			// aliases. No lexeme row or scoped route is written at all.
			await repointCanonicalRoute(db, lang.entityId, {
				namespace: 'know', slug: 'New_Sunly', displayName: 'New Sunly',
			})

			for (const formerSlug of ['Sunly', 'sunly']) {
				const resolution = await resolveWordbook(db, formerSlug, 'boek')
				expect(resolution.state).toBe('resolved')
				if (resolution.state !== 'resolved') return
				expect(resolution.needsRedirect).toBe(true)
				expect(resolution.canonicalHref).toBe('/Wordbook/New_Sunly/boek')
			}
		})

		it('boek and boek-2 both resolve as canonical homograph siblings', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			await mintLexeme('boek', lang.languageId, lang.entityId, 'boek', 1)
			await mintLexeme('Boek', lang.languageId, lang.entityId, 'boek-2', 2)

			const first = await resolveWordbook(db, 'Sunly', 'boek')
			const second = await resolveWordbook(db, 'Sunly', 'boek-2')
			expect(first.state).toBe('resolved')
			expect(second.state).toBe('resolved')
			if (first.state !== 'resolved' || second.state !== 'resolved') return
			expect(first.needsRedirect).toBe(false)
			expect(second.needsRedirect).toBe(false)
			expect(first.lexeme.homographNumber).toBe(1)
			expect(second.lexeme.homographNumber).toBe(2)
		})

		it('red link: word missing under a live language preserves the resolved scope', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			void lang

			const resolution = await resolveWordbook(db, 'sunly', 'wyrd')
			expect(resolution.state).toBe('word-missing')
			if (resolution.state !== 'word-missing') return
			expect(resolution.language.name).toBe('Sunly')
			expect(resolution.canonicalLanguageSlug).toBe('Sunly')
		})

		it('red link: language written under a former slug still scopes the missing word', async () => {
			const lang = await mintLanguage('Sunly', 'sunly')
			await repointCanonicalRoute(db, lang.entityId, { namespace: 'know', slug: 'New_Sunly', displayName: 'New Sunly' })

			const resolution = await resolveWordbook(db, 'sunly', 'wyrd')
			expect(resolution.state).toBe('word-missing')
			if (resolution.state !== 'word-missing') return
			expect(resolution.canonicalLanguageSlug).toBe('New_Sunly')
		})

		it('red link: neither exists', async () => {
			const resolution = await resolveWordbook(db, 'nolang', 'noword')
			expect(resolution.state).toBe('language-missing')
		})

		it('a same-named article is not a language scope', async () => {
			await mintKnowPage('Sunly', 'Sunly')
			const resolution = await resolveWordbook(db, 'Sunly', 'boek')
			expect(resolution.state).toBe('language-missing')
			expect(await resolveWordbookLanguage(db, 'Sunly')).toBeNull()
		})
	})

	describe('typed-namespace resolution through routes', () => {
		it('heals every alias of a celestial body to the same typed row', async () => {
			const entityId = await createEntityWithRoute(db, { displayName: 'Therne', namespace: 'know', legacySlugs: ['therne'] })
			await db.execute(sql`UPDATE celestial_bodies SET entity_id = ${entityId} WHERE slug = 'therne'`)

			for (const identifier of ['Therne', 'therne', 'THERNE']) {
				const target = await resolveTypedFacet(db, 'celestial', identifier)
				expect(target?.slug).toBe('therne')
				expect(target?.entityId).toBe(entityId)
			}
		})

		it('returns null when routes know nothing (legacy fallback) or the facet is absent', async () => {
			expect(await resolveTypedFacet(db, 'celestial', 'never-minted')).toBeNull()
			await mintKnowPage('Just an Article', 'Just_an_Article')
			expect(await resolveTypedFacet(db, 'celestial', 'Just_an_Article')).toBeNull()
		})
	})

	describe('preflight (cutover gates)', () => {
		it('is ready when the queue is drained and every invariant holds', async () => {
			const report = await spinePreflight(db)
			// The wiped test DB leaves migration-seeded rows detached, so the
			// spineless gate reports them — assert the structure, not zero.
			expect(report.canonicalViolations).toEqual([])
			expect(report.mergeChains).toEqual([])
			expect(report.unresolvedWorkItems).toEqual([])
		})

		it('an unresolved work item blocks the cutover; resolving it clears the gate', async () => {
			await db.execute(sql`
				INSERT INTO spine_work_items (kind, detail) VALUES ('merge_conflict', 'both hold a boek route')
			`)
			const blocked = await spinePreflight(db)
			expect(blocked.ready).toBe(false)
			expect(blocked.unresolvedWorkItems).toHaveLength(1)

			await db.execute(sql`UPDATE spine_work_items SET resolved_at = NOW()`)
			const cleared = await spinePreflight(db)
			expect(cleared.unresolvedWorkItems).toEqual([])
		})

		it('address lookups are scope-exact', async () => {
			const langA = await mintLanguage('Sunly', 'sunly')
			const langB = await mintLanguage('Roun', 'roun')
			await mintLexeme('boek', langA.languageId, langA.entityId, 'boek')

			expect(await resolveAddress(db, 'wordbook', 'boek', langA.entityId)).not.toBeNull()
			expect(await resolveAddress(db, 'wordbook', 'boek', langB.entityId)).toBeNull()
		})
	})
})
