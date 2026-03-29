import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { starSystems, stars, planetaryBodies, contentRecords } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { parseWikitext } from '$lib/parser/index.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const isAdmin = locals.user?.role === 'admin'

	// Try systems first, then stars, then planetary bodies
	const [system] = await db.select().from(starSystems).where(eq(starSystems.slug, params.slug))
	if (system) {
		const content = await getContent(system.contentRecordId)
		return { kind: 'system' as const, body: system, isAdmin, ...content }
	}

	const [star] = await db.select().from(stars).where(eq(stars.slug, params.slug))
	if (star) {
		const allSystems = await db.select({ id: starSystems.id, name: starSystems.name }).from(starSystems).orderBy(starSystems.name)
		const content = await getContent(star.contentRecordId)
		return { kind: 'star' as const, body: star, allSystems, isAdmin, ...content }
	}

	const [planet] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, params.slug))
	if (planet) {
		const allStars = await db.select({ id: stars.id, name: stars.name, slug: stars.slug }).from(stars).orderBy(stars.name)
		const siblings = planet.starId
			? await db.select({ id: planetaryBodies.id, name: planetaryBodies.name, slug: planetaryBodies.slug })
				.from(planetaryBodies)
				.where(eq(planetaryBodies.starId, planet.starId))
			: []
		const content = await getContent(planet.contentRecordId)
		return { kind: 'planet' as const, body: planet, allStars, siblings, isAdmin, ...content }
	}

	error(404, 'Celestial body not found')
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
