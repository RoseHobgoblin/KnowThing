import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { asc, sql } from 'drizzle-orm'
import { lexicon } from '$lib/server/db/schema.js'

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
