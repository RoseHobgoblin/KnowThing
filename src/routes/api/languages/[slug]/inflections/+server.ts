import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, inflectionDimensions, paradigmClasses } from '$lib/server/db/schema.js'
import { eq, asc } from 'drizzle-orm'

/** GET /api/languages/:slug/inflections — all dimensions + classes for a language */
export const GET: RequestHandler = async ({ params }) => {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const dimensions = await db
		.select()
		.from(inflectionDimensions)
		.where(eq(inflectionDimensions.languageId, lang.id))
		.orderBy(asc(inflectionDimensions.partOfSpeech), asc(inflectionDimensions.sortOrder))

	const classes = await db
		.select()
		.from(paradigmClasses)
		.where(eq(paradigmClasses.languageId, lang.id))
		.orderBy(asc(paradigmClasses.partOfSpeech), asc(paradigmClasses.name))

	return json({ dimensions, classes })
}
