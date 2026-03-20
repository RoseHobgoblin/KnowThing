import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, lexicon, definitions } from '$lib/server/db/schema.js'
import { asc, desc, eq, sql } from 'drizzle-orm'

export const load: PageServerLoad = async () => {
	// Languages with word counts
	const langs = await db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			script: languages.script,
			family: languages.family,
			color: languages.color,
			description: languages.description,
			wordCount: sql<number>`COUNT(${lexicon.id})::int`.as('word_count'),
		})
		.from(languages)
		.leftJoin(lexicon, eq(lexicon.languageId, languages.id))
		.groupBy(languages.id)
		.orderBy(asc(languages.name))

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
