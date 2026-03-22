import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, lexicon, definitions } from '$lib/server/db/schema.js'
import { asc, desc, eq, sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	// Languages with word counts + inherited family from ancestors
	const langs = await db.execute(sql`
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
			(SELECT COUNT(*)::int FROM lexicon WHERE language_id = l.id) AS "wordCount"
		FROM languages l
		ORDER BY l.name ASC
	`) as any[]

	// Recently added words with first definition
	const recent = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('definition'),
			partOfSpeech: sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('part_of_speech'),
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.orderBy(desc(lexicon.createdAt))
		.limit(10)

	// Total word count
	const [{ total }] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(lexicon)

	return { languages: langs, recent, totalWords: Number(total) }
}
