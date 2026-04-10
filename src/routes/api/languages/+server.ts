import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { queryLanguagesWithFamily } from '$lib/server/wordbook/language-tree.js'
import { parseBody } from '$lib/server/utils.js'

const createLanguageSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	slug: z.string().min(1, 'Slug is required'),
	nativeName: z.string().nullish(),
	family: z.string().nullish(),
	script: z.string().nullish(),
	parentLanguageId: z.number().nullish(),
	languageType: z.string().nullish(),
	color: z.string().nullish(),
	pageSlug: z.string().nullish(),
	description: z.string().nullish(),
})

/** GET /api/languages — list all languages with word counts, inheriting family from ancestors */
export const GET: RequestHandler = async () => {
	return json(await queryLanguagesWithFamily())
}

/** POST /api/languages — create a language */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, createLanguageSchema)
	if (data instanceof Response) return data

	const { name, slug, nativeName, script, family, color, description, pageSlug, parentLanguageId, languageType } = data

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
