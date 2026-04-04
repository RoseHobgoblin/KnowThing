import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { starSystems, stars, planetaryBodies, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { parseWikitext } from '$lib/parser/index.js'
import { hasRole } from '$lib/server/auth.js'
import { requireEditor } from '$lib/server/guards.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
import { resolveStructuredData } from '$lib/server/structured-data.js'
import { getResolvedLinks, serializeResolvedLinks } from '$lib/server/resolved-links.js'
import {
	ensurePlanetaryBodyContentRecord,
	ensureStarContentRecord,
	ensureSystemContentRecord,
} from '$lib/server/services/celestial-content.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const pathSegments = params.path.split('/')
	const lastSeg = pathSegments.at(-1)
	const isEditMode = lastSeg === 'edit'
	const isConfigureMode = lastSeg === 'configure'
	if (isEditMode || isConfigureMode) pathSegments.pop()

	const slug = pathSegments.at(-1)!

	// Require auth for edit/configure mode
	if (isEditMode || isConfigureMode) {
		if (!locals.user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(`/celestial/${params.path}`)}`)
		}
		if (!hasRole(locals.user.role, 'editor')) {
			const viewPath = `/celestial/${pathSegments.join('/')}`
			throw redirect(302, viewPath)
		}
	}

	// Try systems first, then stars, then planetary bodies (case-insensitive, also match by page_slug)
	const [system] = await db.select().from(starSystems).where(sql`LOWER(${starSystems.slug}) = LOWER(${slug}) OR LOWER(${starSystems.pageSlug}) = LOWER(${slug})`)
	if (system) {
		if (system.slug !== slug && !isEditMode) throw redirect(301, `/celestial/${system.slug}`)
		const contentRecordId = system.contentRecordId ?? await ensureSystemContentRecord(db, system)
		const content = await getContent(contentRecordId)
		// Fetch stars + bodies for system map (include orbital data)
		const systemStars = await db.execute(sql`
			SELECT id, name, slug, spectral_type AS "spectralType", color,
				page_slug AS "pageSlug", semi_major_axis_au AS "semiMajorAxisAu",
				eccentricity, parent_star_id AS "parentStarId",
				epoch_phase AS "epochPhase"
			FROM stars WHERE system_id = ${system.id}
			ORDER BY parent_star_id NULLS FIRST, name
		`)
		const systemBodies = await db.execute(sql`
			SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
				pb.page_slug AS "pageSlug", pb.semi_major_axis_au AS "semiMajorAxisAu",
				pb.eccentricity, pb.star_id AS "starId", pb.parent_id AS "parentId",
				pb.orbital_period_days AS "orbitalPeriodDays",
				pb.epoch_phase AS "epochPhase",
				(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
			FROM planetary_bodies pb
			JOIN stars s ON s.id = pb.star_id
			WHERE s.system_id = ${system.id}
			ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
		`)
		// Load calendars relevant to this system (linked to bodies here, plus universal)
		const systemCalendars = await db.execute(sql`
			SELECT c.id, c.name, c.static_data AS "staticData", c.planet_id AS "planetId"
			FROM calendars c
			WHERE c.planet_id IN (
				SELECT pb.id FROM planetary_bodies pb
				JOIN stars s ON s.id = pb.star_id
				WHERE s.system_id = ${system.id}
			)
			OR c.planet_id IS NULL
			ORDER BY c.name
		`)
		const infoboxFields = await resolveStructuredData('system', system.slug)
		return { kind: 'system' as const, body: system, isEditMode, isConfigureMode, systemStars, systemBodies, systemCalendars, infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null, parentCrumbs: [] as { label: string, href: string }[], ...content }
	}

	const [star] = await db.select().from(stars).where(sql`LOWER(${stars.slug}) = LOWER(${slug}) OR LOWER(${stars.pageSlug}) = LOWER(${slug})`)
	if (star) {
		// Resolve canonical system slug from DB
		let parentSystem: { name: string, slug: string } | null = null
		if (star.systemId) {
			const [sys] = await db.select({ slug: starSystems.slug, name: starSystems.name }).from(starSystems).where(eq(starSystems.id, star.systemId))
			parentSystem = sys ?? null
		}
		const canonicalPath = parentSystem ? `/celestial/${parentSystem.slug}/${star.slug}` : `/celestial/${star.slug}`
		const inputPath = `/celestial/${pathSegments.join('/')}`
		if (canonicalPath !== inputPath && !isEditMode) throw redirect(301, canonicalPath)

		const allSystems = await db.select({ id: starSystems.id, name: starSystems.name }).from(starSystems).orderBy(starSystems.name)
		const contentRecordId = star.contentRecordId ?? await ensureStarContentRecord(db, star)
		const content = await getContent(contentRecordId)
		const parentCrumbs: { label: string, href: string }[] = []
		if (parentSystem) {
			parentCrumbs.push({ label: parentSystem.name, href: `/celestial/${parentSystem.slug}` })
		}
		const infoboxFields = await resolveStructuredData('star', star.slug)
		return { kind: 'star' as const, body: star, allSystems, isEditMode, isConfigureMode, parentCrumbs, infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null, ...content }
	}

	const [planet] = await db.select().from(planetaryBodies).where(sql`LOWER(${planetaryBodies.slug}) = LOWER(${slug}) OR LOWER(${planetaryBodies.pageSlug}) = LOWER(${slug})`)
	if (planet) {
		// Resolve canonical path and breadcrumb parents from hierarchy
		let parentSystem: { name: string, slug: string } | null = null
		if (planet.starId) {
			const [parentStar] = await db.select({ systemId: stars.systemId }).from(stars).where(eq(stars.id, planet.starId))
			if (parentStar?.systemId) {
				const [sys] = await db.select({ slug: starSystems.slug, name: starSystems.name }).from(starSystems).where(eq(starSystems.id, parentStar.systemId))
				parentSystem = sys ?? null
			}
		}
		const canonicalPath = parentSystem ? `/celestial/${parentSystem.slug}/${planet.slug}` : `/celestial/${planet.slug}`
		const inputPath = `/celestial/${pathSegments.join('/')}`
		if (canonicalPath !== inputPath && !isEditMode) throw redirect(301, canonicalPath)

		const parentCrumbs: { label: string, href: string }[] = []
		if (parentSystem) {
			parentCrumbs.push({ label: parentSystem.name, href: `/celestial/${parentSystem.slug}` })
		}

		const allStars = await db.select({ id: stars.id, name: stars.name, slug: stars.slug, massKg: stars.massKg }).from(stars).orderBy(stars.name)
		const siblings = planet.starId
			? await db.select({ id: planetaryBodies.id, name: planetaryBodies.name, slug: planetaryBodies.slug, massKg: planetaryBodies.massKg })
				.from(planetaryBodies)
				.where(eq(planetaryBodies.starId, planet.starId))
			: []
		const contentRecordId = planet.contentRecordId ?? await ensurePlanetaryBodyContentRecord(db, planet)
		const content = await getContent(contentRecordId)
		const infoboxFields = await resolveStructuredData('planet', planet.slug)
		return { kind: 'planet' as const, body: planet, allStars, siblings, isEditMode, isConfigureMode, parentCrumbs, infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null, ...content }
	}

	throw error(404, 'Celestial body not found')
}

/** Save prose content for a celestial body */
export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const contentRecordId = Number(formData.get('contentRecordId'))
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''

		if (!contentRecordId) return fail(400, { error: 'Missing content record ID' })

		const [existing] = await db
			.select()
			.from(contentRecords)
			.where(eq(contentRecords.id, contentRecordId))

		if (!existing) return fail(404, { error: 'Content record not found' })

		try {
			const sizeBytes = new TextEncoder().encode(content).length
			const { plainText, ast } = await updateContentEffects(db, contentRecordId, content, 'celestial')

			await db
				.update(contentRecords)
				.set({ content, plainText, parsedAst: ast, sizeBytes, updatedAt: new Date() })
				.where(eq(contentRecords.id, contentRecordId))

			await db.insert(contentRevisions).values({
				contentRecordId,
				title: existing.title,
				content,
				sizeBytes,
				editSummary,
				userId: user.id,
			})
		} catch {
			return fail(500, { error: 'Failed to save article changes' })
		}

		// Redirect back to the view page (strip /edit from the path)
		const viewPath = event.url.pathname.replace(/\/(edit|configure)$/, '')
		throw redirect(302, viewPath)
	},
}

/** Fetch wikitext content, parsed AST, and resolved links from the content record */
async function getContent(contentRecordId: number | null) {
	if (!contentRecordId) return { wikiContent: '', ast: null, contentRecordId: null, resolvedLinks: {} as Record<string, { href: string, exists: boolean }> }

	const [record] = await db
		.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
		.from(contentRecords)
		.where(eq(contentRecords.id, contentRecordId))

	if (!record) return { wikiContent: '', ast: null, contentRecordId: null, resolvedLinks: {} as Record<string, { href: string, exists: boolean }> }

	const ast = (record.parsedAst as import('$lib/parser/types.js').WikiNode) ?? (record.content ? parseWikitext(record.content) : null)
	const links = await getResolvedLinks(record.id)

	return { wikiContent: record.content, ast, contentRecordId: record.id, resolvedLinks: serializeResolvedLinks(links) }
}
