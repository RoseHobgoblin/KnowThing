import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, sql } from 'drizzle-orm'
import { isDescendant } from '$lib/server/wordbook/language-tree.js'

/** GET /api/languages/:slug — with inherited family from ancestors */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, family, parent_language_id, 0 AS depth
			FROM languages
			WHERE slug = ${params.slug}
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
			l.page_slug AS "pageSlug",
			(SELECT COUNT(*) FROM lexicon WHERE language_id = l.id)::int AS "wordCount"
		FROM languages l
		WHERE l.slug = ${params.slug}
	`)

	if (!result.length) {
		return json({ error: 'Language not found' }, { status: 404 })
	}

	return json(result[0])
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
