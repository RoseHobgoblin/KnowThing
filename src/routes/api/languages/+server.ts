import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { asc, sql } from 'drizzle-orm'
import { lexicon } from '$lib/server/db/schema.js'

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
	const result = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, family, parent_language_id, 0 AS depth
			FROM languages
			UNION ALL
			SELECT a.id, p.family, p.parent_language_id, a.depth + 1
			FROM ancestry a
			JOIN languages p ON p.id = a.parent_language_id
			WHERE a.family IS NULL AND a.depth < 10
		)
		SELECT
			l.id, l.name, l.slug, l.native_name AS "nativeName",
			l.script,
			COALESCE(l.family, (
				SELECT a.family FROM ancestry a WHERE a.id = l.id AND a.family IS NOT NULL ORDER BY a.depth LIMIT 1
			)) AS family,
			l.color, l.description,
			l.parent_language_id AS "parentLanguageId",
			l.language_type AS "languageType",
			(SELECT COUNT(*) FROM lexicon WHERE language_id = l.id)::int AS "wordCount"
		FROM languages l
		ORDER BY l.name ASC
	`)

	return json(result)
}

/** POST /api/languages — create a language */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const body = await event.request.json()
	const parsed = createLanguageSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	const { name, slug, nativeName, script, family, color, description, pageSlug, parentLanguageId, languageType } = parsed.data

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
