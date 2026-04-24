import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes } from '$lib/server/db/schema.js'
import { eq, asc, sql } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain } from '$lib/server/wordbook/language-tree.js'

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(302, `/auth/login?next=${encodeURIComponent(url.pathname)}`)

	// Fetch language with inherited family from ancestors (same pattern as /wordbook/[language])
	const langResult = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, family, parent_language_id, 0 AS depth
			FROM languages
			WHERE LOWER(slug) = LOWER(${params.language})
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
			l.color, l.description, l.page_slug AS "pageSlug",
			l.language_type AS "languageType"
		FROM languages l
		WHERE LOWER(l.slug) = LOWER(${params.language})
	`) as any[]

	const lang = langResult[0]
	if (!lang) throw error(404, 'Language not found')

	if (lang.slug !== params.language) {
		throw redirect(301, `/wordbook/${lang.slug}/phonology`)
	}

	const [ancestryChain, inventory] = await Promise.all([
		getAncestryChain(lang.id),
		db
			.select()
			.from(phonemes)
			.where(eq(phonemes.languageId, lang.id))
			.orderBy(asc(phonemes.type), asc(phonemes.sortOrder), asc(phonemes.id)),
	])

	return {
		language: lang,
		ancestryChain,
		inventory,
	}
}
