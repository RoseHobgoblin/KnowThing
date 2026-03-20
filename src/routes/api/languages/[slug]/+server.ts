import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { isDescendant } from '$lib/server/wordbook/language-tree.js'

/** GET /api/languages/:slug */
export const GET: RequestHandler = async ({ params }) => {
	const [lang] = await db
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
		.where(eq(languages.slug, params.slug))

	if (!lang) {
		return json({ error: 'Language not found' }, { status: 404 })
	}

	return json(lang)
}

/** PUT /api/languages/:slug */
export const PUT: RequestHandler = async (event) => {
	requireAuth(event)
	const body = await event.request.json()
	const { name, nativeName, script, family, color, description, pageSlug, parentLanguageId, languageType } = body as {
		name?: string
		nativeName?: string
		script?: string
		family?: string
		color?: string
		description?: string
		pageSlug?: string
		parentLanguageId?: number | null
		languageType?: string
	}

	// Get current language ID for circular reference check
	const [current] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!current) return json({ error: 'Language not found' }, { status: 404 })

	// Circular reference prevention
	if (parentLanguageId !== undefined && parentLanguageId !== null && await isDescendant(current.id, parentLanguageId)) {
		return json({ error: 'Cannot set parent to self or a descendant (circular reference)' }, { status: 400 })
	}

	const validTypes = ['proto', 'language', 'historical']

	const [updated] = await db
		.update(languages)
		.set({
			...(name && { name: name.trim() }),
			...(nativeName !== undefined && { nativeName: nativeName?.trim() || null }),
			...(script !== undefined && { script: script?.trim() || 'Latin' }),
			...(family !== undefined && { family: family?.trim() || null }),
			...(color !== undefined && { color: color?.trim() || '#d97706' }),
			...(description !== undefined && { description: description?.trim() || null }),
			...(pageSlug !== undefined && { pageSlug: pageSlug?.trim() || null }),
			...(parentLanguageId !== undefined && { parentLanguageId: parentLanguageId || null }),
			...(languageType && validTypes.includes(languageType) && { languageType }),
			updatedAt: new Date(),
		})
		.where(eq(languages.slug, event.params.slug))
		.returning()

	if (!updated) {
		return json({ error: 'Language not found' }, { status: 404 })
	}

	return json(updated)
}
