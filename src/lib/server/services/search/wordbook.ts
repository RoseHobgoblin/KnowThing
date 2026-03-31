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

function buildWordbookConditions(params: WordbookSearchParams) {
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

	return conditions
}

async function resolveWordbookMatchIds(query: string) {
	const [definitionMatches, inflectionMatches] = await Promise.all([
		db.selectDistinct({ entryId: definitions.entryId })
			.from(definitions)
			.where(sql`search_vector @@ websearch_to_tsquery('english', ${query})`),
		db.selectDistinct({ entryId: inflectedForms.entryId })
			.from(inflectedForms)
			.where(sql`LOWER(${inflectedForms.form}) = LOWER(${query})`),
	])

	const definitionIds = definitionMatches.map(row => row.entryId)
	const inflectionIds = inflectionMatches.map(row => row.entryId)

	return {
		extraIds: [...new Set([...definitionIds, ...inflectionIds])],
		inflectionIds,
	}
}

function buildWordbookQueryFilter(query: string, extraIds: number[]) {
	const extraIdFilter = extraIds.length > 0
		? sql`OR ${lexicon.id} IN (${sql.join(extraIds.map(id => sql`${id}`), sql`, `)})`
		: sql``

	return sql`(
		LOWER(${lexicon.word}) = LOWER(${query})
		OR LOWER(${lexicon.word}) LIKE LOWER(${query + '%'})
		OR ${lexicon.word} % ${query}
		OR lexicon.search_vector @@ websearch_to_tsquery('english', ${query})
		${extraIdFilter}
	)`
}

export async function searchWordbookEntries(params: WordbookSearchParams) {
	const query = params.query?.trim()
	const conditions = buildWordbookConditions(params)

	if (!query) {
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
				relevance: sql<number>`0`.as('relevance'),
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(lexicon.word))
			.limit(params.limit)
			.offset(params.offset ?? 0)
	}

	const { extraIds, inflectionIds } = await resolveWordbookMatchIds(query)
	const inflectionIdSet = new Set(inflectionIds)
	const inflectionRelevanceCheck = inflectionIdSet.size > 0
		? sql`${lexicon.id} IN (${sql.join([...inflectionIdSet].map(id => sql`${id}`), sql`, `)})`
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
					WHEN LOWER(${lexicon.word}) = LOWER(${query}) THEN 5
					WHEN ${inflectionRelevanceCheck} THEN 4
					WHEN LOWER(${lexicon.word}) LIKE LOWER(${query + '%'}) THEN 3
					WHEN ${lexicon.word} % ${query} THEN 2
					ELSE 1
				END
			`.as('relevance'),
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(
			and(
				buildWordbookQueryFilter(query, extraIds),
				...(conditions.length > 0 ? conditions : []),
			),
		)
		.orderBy(sql`relevance DESC`, asc(lexicon.word))
		.limit(params.limit)
		.offset(params.offset ?? 0)
}

export async function countWordbookSearchResults(params: Omit<WordbookSearchParams, 'limit' | 'offset'>) {
	const query = params.query?.trim()
	const conditions = buildWordbookConditions({ ...params, limit: 1 })

	if (!query) {
		const [{ count }] = await db
			.select({ count: sql<number>`COUNT(*)::int` })
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)

		return Number(count ?? 0)
	}

	const { extraIds } = await resolveWordbookMatchIds(query)
	const [{ count }] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(
			and(
				buildWordbookQueryFilter(query, extraIds),
				...(conditions.length > 0 ? conditions : []),
			),
		)

	return Number(count ?? 0)
}
