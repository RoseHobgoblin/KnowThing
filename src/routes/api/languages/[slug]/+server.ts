import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'
import { isDescendant, queryLanguagesWithFamily } from '$lib/server/wordbook/language-tree.js'
import { parseBody } from '$lib/server/utils.js'

const updateLanguageSchema = z.object({
	name: z.string().nullish(),
	nativeName: z.string().nullish(),
	family: z.string().nullish(),
	script: z.string().nullish(),
	parentLanguageId: z.number().nullish(),
	languageType: z.string().nullish(),
	color: z.string().nullish(),
	pageSlug: z.string().nullish(),
	description: z.string().nullish(),
})

/** GET /api/languages/:slug — with inherited family from ancestors */
export const GET: RequestHandler = async ({ params }) => {
	const result = await queryLanguagesWithFamily(params.slug)

	if (result.length === 0) {
		return json({ error: 'Language not found' }, { status: 404 })
	}

	return json(result[0])
}

/** PUT /api/languages/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, updateLanguageSchema)
	if (data instanceof Response) return data

	const { name, nativeName, script, family, color, description, pageSlug, parentLanguageId, languageType } = data

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
