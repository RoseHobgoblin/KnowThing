import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages } from '$lib/server/db/schema.js'
import { eq, sql, asc, and } from 'drizzle-orm'

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() || ''
	const language = url.searchParams.get('language') || ''
	const tag = url.searchParams.get('tag') || ''
	const pos = url.searchParams.get('pos') || ''

	const conditions = []
	if (language) conditions.push(eq(languages.slug, language))
	if (tag) conditions.push(sql`${tag} = ANY(${lexicon.tags})`)
	if (pos) conditions.push(sql`EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.part_of_speech = ${pos})`)

	let results: any[] = []

	if (q) {
		results = await db
			.select({
				id: lexicon.id,
				word: lexicon.word,
				pronunciation: lexicon.pronunciation,
				tags: lexicon.tags,
				languageName: languages.name,
				languageSlug: languages.slug,
				languageColor: languages.color,
				definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('definition'),
				partOfSpeech: sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('part_of_speech'),
				relevance: sql<number>`
					CASE
						WHEN LOWER(${lexicon.word}) = LOWER(${q}) THEN 4
						WHEN LOWER(${lexicon.word}) LIKE LOWER(${q + '%'}) THEN 3
						WHEN ${lexicon.word} % ${q} THEN 2
						ELSE 1
					END
				`.as('relevance'),
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(
				and(
					sql`
						(
												LOWER(${lexicon.word}) = LOWER(${q})
												OR LOWER(${lexicon.word}) LIKE LOWER(${q + '%'})
												OR ${lexicon.word} % ${q}
												OR EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.search_vector @@ plainto_tsquery('english', ${q}))
											)
					`,
					...(conditions.length > 0 ? conditions : []),
				),
			)
			.orderBy(sql`relevance DESC`, asc(lexicon.word))
			.limit(100)
	} else if (tag || language || pos) {
		results = await db
			.select({
				id: lexicon.id,
				word: lexicon.word,
				pronunciation: lexicon.pronunciation,
				tags: lexicon.tags,
				languageName: languages.name,
				languageSlug: languages.slug,
				languageColor: languages.color,
				definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('definition'),
				partOfSpeech: sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('part_of_speech'),
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(and(...conditions))
			.orderBy(asc(lexicon.word))
			.limit(100)
	}

	const langs = await db
		.select({ name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name))

	return { results, query: q, language, tag, pos, languages: langs }
}
