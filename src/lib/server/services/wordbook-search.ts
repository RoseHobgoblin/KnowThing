import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { definitions, inflectedForms, languages, lexicon } from '$lib/server/db/schema.js'

export interface WordbookSearchParams {
	query?: string
	language?: string
	tag?: string
	pos?: string
	letter?: string
	limit: number
	offset?: number
}

export async function searchWordbook(params: WordbookSearchParams) {
	const q = params.query?.trim()
	const conditions = []

	if (params.language) {
		conditions.push(eq(languages.slug, params.language))
	}
	if (params.letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${params.letter.toLowerCase()}`)
	}
	if (params.tag) {
		conditions.push(sql`LOWER(${params.tag}) = ANY(${lexicon.tags})`)
	}
	if (params.pos) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.part_of_speech = ${params.pos})`,
		)
	}

	if (q) {
		const [definitionMatches, inflectionMatches] = await Promise.all([
			db.selectDistinct({ entryId: definitions.entryId })
				.from(definitions)
				.where(sql`search_vector @@ websearch_to_tsquery('english', ${q})`),
			db.selectDistinct({ entryId: inflectedForms.entryId })
				.from(inflectedForms)
				.where(sql`LOWER(${inflectedForms.form}) = LOWER(${q})`),
		])

		const definitionIds = new Set(definitionMatches.map(row => row.entryId))
		const inflectionIds = new Set(inflectionMatches.map(row => row.entryId))
		const extraIds = [...new Set([...definitionIds, ...inflectionIds])]

		const extraIdFilter = extraIds.length > 0
			? sql`OR ${lexicon.id} IN (${sql.join(extraIds.map(id => sql`${id}`), sql`, `)})`
			: sql``

		const inflectionRelevanceCheck = inflectionIds.size > 0
			? sql`${lexicon.id} IN (${sql.join([...inflectionIds].map(id => sql`${id}`), sql`, `)})`
			: sql`false`

		return db
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
						WHEN LOWER(${lexicon.word}) = LOWER(${q}) THEN 5
						WHEN ${inflectionRelevanceCheck} THEN 4
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
					sql`(
						LOWER(${lexicon.word}) = LOWER(${q})
						OR LOWER(${lexicon.word}) LIKE LOWER(${q + '%'})
						OR ${lexicon.word} % ${q}
						OR lexicon.search_vector @@ websearch_to_tsquery('english', ${q})
						${extraIdFilter}
					)`,
					...(conditions.length > 0 ? conditions : []),
				),
			)
			.orderBy(sql`relevance DESC`, asc(lexicon.word))
			.limit(params.limit)
			.offset(params.offset ?? 0)
	}

	return db
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
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(asc(lexicon.word))
		.limit(params.limit)
		.offset(params.offset ?? 0)
}
