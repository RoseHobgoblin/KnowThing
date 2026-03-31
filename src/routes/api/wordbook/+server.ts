import { isHttpError, json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages, inflectedForms } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, sql, asc, and } from 'drizzle-orm'
import { createWordbookEntry } from '$lib/server/services/wordbook.js'

const createWordSchema = z.object({
	word: z.string().min(1, 'Word is required'),
	languageId: z.number({ error: 'Language is required' }),
	pronunciation: z.string().optional(),
	etymology: z.string().optional(),
	notes: z.string().optional(),
	pageSlug: z.string().optional(),
	tags: z.array(z.string()).optional(),
	defs: z.array(z.object({
		partOfSpeech: z.string().optional(),
		definition: z.string(),
		usageExample: z.string().optional(),
		usageTranslation: z.string().optional(),
	})).optional(),
	relations: z.array(z.object({
		targetId: z.number(),
		relationType: z.string(),
	})).optional(),
	definition: z.string().optional(),
	isHomograph: z.boolean().optional(),
})

/** GET /api/wordbook — search and browse */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const language = url.searchParams.get('language')
	const tag = url.searchParams.get('tag')
	const letter = url.searchParams.get('letter')
	const pos = url.searchParams.get('pos')
	const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50'), 200)
	const offset = Number.parseInt(url.searchParams.get('offset') || '0')

	const conditions = []

	if (language) {
		conditions.push(eq(languages.slug, language))
	}
	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`)
	}
	if (tag) {
		conditions.push(sql`LOWER(${tag}) = ANY(${lexicon.tags})`)
	}
	if (pos) {
		conditions.push(sql`EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.part_of_speech = ${pos})`)
	}

	if (q) {
		// Pre-fetch entry IDs from expensive sources (avoids per-row EXISTS subqueries)
		const [defMatches, inflMatches] = await Promise.all([
			db.selectDistinct({ entryId: definitions.entryId })
				.from(definitions)
				.where(sql`search_vector @@ plainto_tsquery('english', ${q})`),
			db.selectDistinct({ entryId: inflectedForms.entryId })
				.from(inflectedForms)
				.where(sql`LOWER(${inflectedForms.form}) = LOWER(${q})`),
		])

		const defIds = new Set(defMatches.map(r => r.entryId))
		const inflIds = new Set(inflMatches.map(r => r.entryId))
		const allExtraIds = [...new Set([...defIds, ...inflIds])]

		const extraIdFilter = allExtraIds.length > 0
			? sql`OR ${lexicon.id} IN (${sql.join(allExtraIds.map(id => sql`${id}`), sql`, `)})`
			: sql``

		const inflRelevanceCheck = inflIds.size > 0
			? sql`${lexicon.id} IN (${sql.join([...inflIds].map(id => sql`${id}`), sql`, `)})`
			: sql`false`

		const results = await db
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
						WHEN ${inflRelevanceCheck} THEN 4
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
						OR lexicon.search_vector @@ plainto_tsquery('english', ${q})
						${extraIdFilter}
					)`,
					...(conditions.length > 0 ? conditions : []),
				),
			)
			.orderBy(sql`relevance DESC`, asc(lexicon.word))
			.limit(limit)
			.offset(offset)

		return json(results)
	}

	// Browse mode
	const results = await db
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
		.limit(limit)
		.offset(offset)

	return json(results)
}

/** POST /api/wordbook — create entry with definitions */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const body = await event.request.json()
	const parsed = createWordSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	try {
		const entry = await createWordbookEntry({ ...parsed.data, userId: user.id })
		return json(entry, { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
