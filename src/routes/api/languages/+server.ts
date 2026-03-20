import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { asc, sql } from 'drizzle-orm'
import { lexicon } from '$lib/server/db/schema.js'

/** GET /api/languages — list all languages with word counts */
export const GET: RequestHandler = async () => {
	const result = await db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			script: languages.script,
			family: languages.family,
			color: languages.color,
			description: languages.description,
			wordCount: sql<number>`(SELECT COUNT(*) FROM lexicon WHERE language_id = ${languages.id})`.as('word_count'),
		})
		.from(languages)
		.orderBy(asc(languages.name))

	return json(result)
}

/** POST /api/languages — create a language */
export const POST: RequestHandler = async (event) => {
	requireAuth(event)
	const body = await event.request.json()
	const { name, slug, nativeName, script, family, color, description, pageSlug, parentLanguageId, languageType } = body as {
		name: string
		slug: string
		nativeName?: string
		script?: string
		family?: string
		color?: string
		description?: string
		pageSlug?: string
		parentLanguageId?: number
		languageType?: string
	}

	if (!name?.trim() || !slug?.trim()) {
		return json({ error: 'Name and slug are required' }, { status: 400 })
	}

	const validTypes = ['proto', 'language', 'historical']
	const type = languageType && validTypes.includes(languageType) ? languageType : 'language'

	const [lang] = await db
		.insert(languages)
		.values({
			name: name.trim(),
			slug: slug.trim().toLowerCase(),
			nativeName: nativeName?.trim() || null,
			script: script?.trim() || 'Latin',
			family: family?.trim() || null,
			color: color?.trim() || '#d97706',
			description: description?.trim() || null,
			pageSlug: pageSlug?.trim() || null,
			parentLanguageId: parentLanguageId || null,
			languageType: type,
		})
		.returning()

	return json(lang, { status: 201 })
}
