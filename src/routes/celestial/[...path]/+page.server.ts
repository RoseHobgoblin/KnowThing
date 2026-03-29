import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { starSystems, stars, planetaryBodies, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { parseWikitext } from '$lib/parser/index.js'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const isAdmin = locals.user?.role === 'admin'

	const pathSegments = params.path.split('/')
	const isEditMode = pathSegments.at(-1) === 'edit'
	if (isEditMode) pathSegments.pop()

	const slug = pathSegments.at(-1)!

	// Require auth for edit mode
	if (isEditMode && !locals.user) {
		redirect(302, `/auth/login?redirect=${encodeURIComponent(`/celestial/${params.path}`)}`)
	}

	// Try systems first, then stars, then planetary bodies (case-insensitive)
	const [system] = await db.select().from(starSystems).where(sql`LOWER(${starSystems.slug}) = LOWER(${slug})`)
	if (system) {
		if (system.slug !== slug && !isEditMode) redirect(301, `/celestial/${system.slug}`)
		const content = await getContent(system.contentRecordId)
		// Fetch stars + bodies for system map
		const systemStars = await db.execute(sql`
			SELECT id, name, slug, spectral_type AS "spectralType", color,
				page_slug AS "pageSlug", semi_major_axis_au AS "semiMajorAxisAu",
				eccentricity, parent_star_id AS "parentStarId"
			FROM stars WHERE system_id = ${system.id}
			ORDER BY parent_star_id NULLS FIRST, name
		`)
		const systemBodies = await db.execute(sql`
			SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
				pb.page_slug AS "pageSlug", pb.semi_major_axis_au AS "semiMajorAxisAu",
				pb.eccentricity, pb.star_id AS "starId", pb.parent_id AS "parentId",
				(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
			FROM planetary_bodies pb
			JOIN stars s ON s.id = pb.star_id
			WHERE s.system_id = ${system.id}
			ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
		`)
		return { kind: 'system' as const, body: system, isAdmin, isEditMode, systemStars, systemBodies, ...content }
	}

	const [star] = await db.select().from(stars).where(sql`LOWER(${stars.slug}) = LOWER(${slug})`)
	if (star) {
		const systemSlug = pathSegments.length > 1 ? pathSegments[0] : null
		const canonicalPath = systemSlug ? `/celestial/${systemSlug}/${star.slug}` : `/celestial/${star.slug}`
		if (star.slug !== slug && !isEditMode) redirect(301, canonicalPath)

		const allSystems = await db.select({ id: starSystems.id, name: starSystems.name }).from(starSystems).orderBy(starSystems.name)
		const content = await getContent(star.contentRecordId)
		return { kind: 'star' as const, body: star, allSystems, isAdmin, isEditMode, ...content }
	}

	const [planet] = await db.select().from(planetaryBodies).where(sql`LOWER(${planetaryBodies.slug}) = LOWER(${slug})`)
	if (planet) {
		const systemSlug = pathSegments.length > 1 ? pathSegments[0] : null
		const canonicalPath = systemSlug ? `/celestial/${systemSlug}/${planet.slug}` : `/celestial/${planet.slug}`
		if (planet.slug !== slug && !isEditMode) redirect(301, canonicalPath)

		const allStars = await db.select({ id: stars.id, name: stars.name, slug: stars.slug }).from(stars).orderBy(stars.name)
		const siblings = planet.starId
			? await db.select({ id: planetaryBodies.id, name: planetaryBodies.name, slug: planetaryBodies.slug })
				.from(planetaryBodies)
				.where(eq(planetaryBodies.starId, planet.starId))
			: []
		const content = await getContent(planet.contentRecordId)
		return { kind: 'planet' as const, body: planet, allStars, siblings, isAdmin, isEditMode, ...content }
	}

	error(404, 'Celestial body not found')
}

/** Save prose content for a celestial body */
export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event)
		const formData = await event.request.formData()
		const contentRecordId = Number(formData.get('contentRecordId'))
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''

		if (!contentRecordId) error(400, 'Missing content record ID')

		const [existing] = await db
			.select()
			.from(contentRecords)
			.where(eq(contentRecords.id, contentRecordId))

		if (!existing) error(404, 'Content record not found')

		const sizeBytes = new TextEncoder().encode(content).length
		const { plainText, ast } = await updateContentEffects(contentRecordId, content)

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

		// Redirect back to the view page (strip /edit from the path)
		const viewPath = event.url.pathname.replace(/\/edit$/, '')
		redirect(302, viewPath)
	},
}

/** Fetch wikitext content and parsed AST from the content record */
async function getContent(contentRecordId: number | null) {
	if (!contentRecordId) return { wikiContent: '', ast: null, contentRecordId: null }

	const [record] = await db
		.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
		.from(contentRecords)
		.where(eq(contentRecords.id, contentRecordId))

	if (!record) return { wikiContent: '', ast: null, contentRecordId: null }

	const ast = (record.parsedAst as import('$lib/parser/types.js').WikiNode) ?? (record.content ? parseWikitext(record.content) : null)

	return { wikiContent: record.content, ast, contentRecordId: record.id }
}
