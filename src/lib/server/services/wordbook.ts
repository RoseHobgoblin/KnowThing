import { error } from '@sveltejs/kit'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	definitions,
	languageDialects,
	languages,
	lexicon,
	lexiconInflections,
	lexiconRelations,
	lexiconRevisions,
	lexiconVariants,
	users,
} from '$lib/server/db/schema.js'
import { getInflectionTable, rebuildInflectedForms } from '$lib/server/wordbook/inflection.js'

const VALID_RELATION_TYPES = new Set(['derived_from', 'loan_from', 'compound_of'])

export interface WordbookDefinitionInput {
	partOfSpeech?: string
	definition: string
	usageExample?: string
	usageTranslation?: string
}

export interface CreateWordbookEntryInput {
	word: string
	languageId: number
	pronunciation?: string
	etymology?: string
	notes?: string
	pageSlug?: string
	tags?: string[]
	defs?: WordbookDefinitionInput[]
	definition?: string
	isHomograph?: boolean
	relations?: Array<{ targetId: number, relationType: string, notes?: string }>
	userId: number
}

function normalizeTags(tags?: string[]): string[] | undefined {
	if (!tags) return undefined
	return tags
		.map(tag => tag.trim().toLowerCase())
		.filter((tag, index, all) => tag && all.indexOf(tag) === index)
}

function normalizeDefinition(definition: WordbookDefinitionInput) {
	return {
		partOfSpeech: definition.partOfSpeech?.trim() || null,
		definition: definition.definition.trim(),
		usageExample: definition.usageExample?.trim() || null,
		usageTranslation: definition.usageTranslation?.trim() || null,
	}
}

function normalizeDefinitions(defs?: WordbookDefinitionInput[], fallback?: string) {
	const normalized = (defs || [])
		.filter(definition => definition.definition?.trim())
		.map(definition => normalizeDefinition(definition))

	if (normalized.length > 0) return normalized
	if (fallback?.trim()) return [normalizeDefinition({ definition: fallback })]

	throw error(400, 'At least one definition is required')
}

export async function getWordbookEntry(entryId: number) {
	const [entry] = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			etymology: lexicon.etymology,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt,
			languageId: lexicon.languageId,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexicon.id, entryId))

	if (!entry) throw error(404, 'Entry not found')

	const defs = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, entryId))
		.orderBy(asc(definitions.senseNumber))

	return { ...entry, definitions: defs }
}

export async function deleteWordbookEntry(entryId: number, userId: number) {
	return db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		// Final snapshot survives the delete: lexicon_revisions.entry_id is
		// ON DELETE SET NULL (migration 0036), so the audit trail outlives the entry.
		await snapshotEntry(entryId, userId, 'Entry deleted', tx)
		const [deleted] = await tx.delete(lexicon).where(eq(lexicon.id, entryId)).returning()
		if (!deleted) throw error(404, 'Entry not found')
		return { success: true }
	})
}

export async function listWordbookTags() {
	return db.execute(sql`
		SELECT tag, COUNT(*) as count
		FROM lexicon, UNNEST(tags) AS tag
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`)
}

export async function getEntryLanguageId(entryId: number) {
	const [entry] = await db
		.select({ languageId: lexicon.languageId })
		.from(lexicon)
		.where(eq(lexicon.id, entryId))
	if (!entry) throw error(404, 'Entry not found')
	return entry.languageId
}

type LanguageWithFamily = {
	id: number
	name: string
	slug: string
	nativeName: string | null
	script: string | null
	family: string | null
	color: string | null
	description: string | null
	pageSlug?: string | null
	parentLanguageId?: number | null
	languageType?: string | null
	body?: string
	bodyParsedAst?: unknown
	wordCount: number
}

export async function listLanguagesWithFamily() {
	const rows = await db.execute(sql`
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
	`)
	return rows as unknown as LanguageWithFamily[]
}

export async function getLanguageWithFamily(slug: string) {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, family, parent_language_id, 0 AS depth
			FROM languages
			WHERE LOWER(slug) = LOWER(${slug})
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
			l.parent_language_id AS "parentLanguageId",
			l.language_type AS "languageType",
			l.body, l.body_parsed_ast AS "bodyParsedAst",
			(SELECT COUNT(*)::int FROM lexicon WHERE language_id = l.id) AS "wordCount"
		FROM languages l
		WHERE LOWER(l.slug) = LOWER(${slug})
	`) as unknown as LanguageWithFamily[]
	return result[0] ?? null
}

export async function listRecentEntries(limit: number) {
	// LATERAL replaces the two correlated first-definition subqueries per row.
	const rows = await db.execute(sql`
		SELECT l.id, l.word, l.pronunciation,
			fd.definition, fd.part_of_speech AS "partOfSpeech",
			lang.name AS "languageName", lang.slug AS "languageSlug", lang.color AS "languageColor"
		FROM lexicon l
		JOIN languages lang ON lang.id = l.language_id
		LEFT JOIN LATERAL (
			SELECT definition, part_of_speech FROM definitions d
			WHERE d.entry_id = l.id ORDER BY sense_number LIMIT 1
		) fd ON true
		ORDER BY l.created_at DESC
		LIMIT ${limit}
	`)
	return rows as unknown as Array<{
		id: number, word: string, pronunciation: string | null
		definition: string | null, partOfSpeech: string | null
		languageName: string, languageSlug: string, languageColor: string | null
	}>
}

export async function getTotalWordCount() {
	const [{ total }] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(lexicon)
	return Number(total)
}

/** Accent-folded first-letter bucket: "é" → E; non-alphabetic → '#'. */
const LETTER_BUCKET_SQL = sql`
  CASE WHEN UPPER(LEFT(unaccent(l.word), 1)) ~ '[[:alpha:]]'
  	THEN UPPER(LEFT(unaccent(l.word), 1))
  	ELSE '#'
  END
`

export interface LanguageEntriesPage {
	entries: Array<{
		id: number, word: string, pronunciation: string | null, tags: string[] | null
		languageName: string, languageSlug: string, languageColor: string | null
		definition: string | null, partOfSpeech: string | null
	}>
	total: number
}

export async function listLanguageEntries(
	languageId: number,
	letter: string | null,
	pagination: { limit: number, offset: number } = { limit: 200, offset: 0 },
): Promise<LanguageEntriesPage> {
	const letterClause = letter
		? sql`AND ${LETTER_BUCKET_SQL} = ${letter.toUpperCase()}`
		: sql``

	const rows = await db.execute(sql`
		SELECT l.id, l.word, l.pronunciation, l.tags,
			lang.name AS "languageName", lang.slug AS "languageSlug", lang.color AS "languageColor",
			fd.definition, fd.part_of_speech AS "partOfSpeech",
			COUNT(*) OVER()::int AS __total
		FROM lexicon l
		JOIN languages lang ON lang.id = l.language_id
		LEFT JOIN LATERAL (
			SELECT definition, part_of_speech FROM definitions d
			WHERE d.entry_id = l.id ORDER BY sense_number LIMIT 1
		) fd ON true
		WHERE l.language_id = ${languageId} ${letterClause}
		ORDER BY l.word COLLATE "und-x-icu", l.homograph_number
		LIMIT ${pagination.limit} OFFSET ${pagination.offset}
	`) as unknown as Array<LanguageEntriesPage['entries'][number] & { __total: number }>

	const total = rows.length > 0 ? Number(rows[0].__total) : 0
	return { entries: rows.map(({ __total, ...entry }) => entry), total }
}

export async function listActiveLetters(languageId: number) {
	const rows = await db.execute(sql`
		SELECT DISTINCT ${LETTER_BUCKET_SQL} AS letter
		FROM lexicon l
		WHERE l.language_id = ${languageId}
		ORDER BY letter
	`)
	return (rows as unknown as Array<{ letter: string }>).map(r => r.letter)
}

export async function getLanguageBySlug(slug: string) {
	const [lang] = await db.select().from(languages).where(eq(languages.slug, slug))
	return lang ?? null
}

export async function getEntryWithDefinitions(entryId: number) {
	const [entry] = await db.select().from(lexicon).where(eq(lexicon.id, entryId))
	if (!entry) throw error(404, 'Entry not found')

	const defs = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, entryId))
		.orderBy(asc(definitions.senseNumber))

	return { entry, definitions: defs }
}

export async function listHomographs(languageId: number, word: string) {
	return db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			etymology: lexicon.etymology,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			homographNumber: lexicon.homographNumber,
			body: lexicon.body,
			bodyParsedAst: lexicon.bodyParsedAst,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt,
		})
		.from(lexicon)
		.where(and(
			sql`LOWER(${lexicon.word}) = LOWER(${word})`,
			eq(lexicon.languageId, languageId),
		))
		.orderBy(asc(lexicon.homographNumber))
}

export async function listDefinitionsForEntries(entryIds: number[]) {
	return db
		.select()
		.from(definitions)
		.where(inArray(definitions.entryId, entryIds))
		.orderBy(asc(definitions.entryId), asc(definitions.senseNumber))
}

export async function listVariantsForEntries(entryIds: number[]) {
	return db
		.select({
			id: lexiconVariants.id,
			entryId: lexiconVariants.entryId,
			dialectId: lexiconVariants.dialectId,
			pronunciation: lexiconVariants.pronunciation,
			spelling: lexiconVariants.spelling,
			notes: lexiconVariants.notes,
			dialectName: languageDialects.name,
			dialectSlug: languageDialects.slug,
			dialectRegion: languageDialects.region,
		})
		.from(lexiconVariants)
		.innerJoin(languageDialects, eq(lexiconVariants.dialectId, languageDialects.id))
		.where(inArray(lexiconVariants.entryId, entryIds))
}

export async function findWordbookMatchByTitle(title: string) {
	const matches = await db
		.select({
			word: lexicon.word,
			languageSlug: languages.slug,
			languageName: languages.name,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(sql`LOWER(${lexicon.word}) = LOWER(${title.replaceAll(' ', '_')}) OR LOWER(${lexicon.word}) = LOWER(${title})`)
		.limit(1)
	return matches[0] ?? null
}

/**
 * If a Know article's slug matches a language row's `page_slug` (i.e. this
 * Know article *is* the language's encyclopedia article), return that
 * language's wordbook ref so KnowArticle can show a "Wordbook" tag linking
 * back to the dictionary entry.
 */
export async function findLanguageMatchByPageSlug(slug: string) {
	const [match] = await db
		.select({
			languageSlug: languages.slug,
			languageName: languages.name,
		})
		.from(languages)
		.where(sql`LOWER(${languages.pageSlug}) = LOWER(${slug})`)
		.limit(1)
	return match ?? null
}

export async function listEntryVariants(entryId: number) {
	return db
		.select({
			id: lexiconVariants.id,
			pronunciation: lexiconVariants.pronunciation,
			spelling: lexiconVariants.spelling,
			notes: lexiconVariants.notes,
			dialectId: lexiconVariants.dialectId,
			dialectName: languageDialects.name,
			dialectSlug: languageDialects.slug,
			dialectRegion: languageDialects.region,
		})
		.from(lexiconVariants)
		.innerJoin(languageDialects, eq(lexiconVariants.dialectId, languageDialects.id))
		.where(eq(lexiconVariants.entryId, entryId))
}

/** Either the root db or a transaction — snapshot/assert helpers accept both. */
type DatabaseExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>

async function getEntry(entryId: number, executor: DatabaseExecutor = db) {
	const [entry] = await executor.select().from(lexicon).where(eq(lexicon.id, entryId))
	return entry ?? null
}

async function assertEntry(entryId: number, executor: DatabaseExecutor = db) {
	const entry = await getEntry(entryId, executor)
	if (!entry) throw error(404, 'Entry not found')
	return entry
}

/**
 * Write a full revision snapshot of an entry: headword row + definitions +
 * variants + relations + inflection assignment. Runs on the caller's executor
 * so it commits (or rolls back) atomically with the mutation it precedes.
 */
async function snapshotEntry(entryId: number, userId: number, summary: string, executor: DatabaseExecutor = db) {
	const entry = await assertEntry(entryId, executor)
	const [entryDefinitions, entryVariants, entryRelations, [entryInflection]] = await Promise.all([
		executor
			.select()
			.from(definitions)
			.where(eq(definitions.entryId, entryId))
			.orderBy(asc(definitions.senseNumber)),
		executor
			.select()
			.from(lexiconVariants)
			.where(eq(lexiconVariants.entryId, entryId)),
		executor
			.select()
			.from(lexiconRelations)
			.where(eq(lexiconRelations.sourceId, entryId)),
		executor
			.select()
			.from(lexiconInflections)
			.where(eq(lexiconInflections.entryId, entryId)),
	])

	// Strip the trigger-maintained tsvector — recomputed on restore, dead weight in JSON.
	const { searchVector: _searchVector, ...entrySnapshot } = entry
	await executor.insert(lexiconRevisions).values({
		entryId,
		snapshot: {
			...entrySnapshot,
			definitions: entryDefinitions.map(({ searchVector: _dv, ...rest }) => rest),
			variants: entryVariants,
			relations: entryRelations,
			inflection: entryInflection ?? null,
		},
		editSummary: summary,
		userId,
	})
}

/**
 * Compute the homograph number for (word, languageId), excluding `excludeId`.
 * MUST run inside the caller's transaction; the CI unique index
 * (migration 0036) backstops races.
 */
async function resolveHomographNumber(
	tx: DatabaseExecutor,
	word: string,
	languageId: number,
	isHomograph: boolean | undefined,
	excludeId?: number,
): Promise<number> {
	const conditions = [
		sql`LOWER(${lexicon.word}) = LOWER(${word})`,
		eq(lexicon.languageId, languageId),
	]
	if (excludeId !== undefined) conditions.push(sql`${lexicon.id} <> ${excludeId}`)

	const existing = await tx
		.select({ id: lexicon.id, homographNumber: lexicon.homographNumber })
		.from(lexicon)
		.where(and(...conditions))

	if (existing.length === 0) return 1

	if (!isHomograph) {
		const [language] = await tx
			.select({ name: languages.name })
			.from(languages)
			.where(eq(languages.id, languageId))

		throw error(409, `"${word}" already exists in ${language?.name || 'this language'}. Add a definition to the existing entry, or set isHomograph: true to create a separate homograph.`)
	}

	return Math.max(...existing.map(entry => entry.homographNumber)) + 1
}

export async function createWordbookEntry(input: CreateWordbookEntryInput) {
	const word = input.word.trim()
	const normalizedDefinitions = normalizeDefinitions(input.defs, input.definition)
	const normalizedTags = normalizeTags(input.tags) ?? []

	return db.transaction(async (tx) => {
		const homographNumber = await resolveHomographNumber(tx, word, input.languageId, input.isHomograph)

		const [entry] = await tx
			.insert(lexicon)
			.values({
				word,
				languageId: input.languageId,
				pronunciation: input.pronunciation?.trim() || null,
				etymology: input.etymology?.trim() || null,
				notes: input.notes?.trim() || null,
				pageSlug: input.pageSlug?.trim() || null,
				tags: normalizedTags,
				homographNumber,
			})
			.returning()

		if (normalizedDefinitions.length > 0) {
			await tx.insert(definitions).values(
				normalizedDefinitions.map((definition, index) => ({
					entryId: entry.id,
					senseNumber: index + 1,
					partOfSpeech: definition.partOfSpeech,
					definition: definition.definition,
					usageExample: definition.usageExample,
					usageTranslation: definition.usageTranslation,
				})),
			)
		}

		const validRelations = (input.relations || []).filter(relation =>
			relation.targetId && VALID_RELATION_TYPES.has(relation.relationType),
		)

		if (validRelations.length > 0) {
			// Validate targets exist up front → clean 400 instead of an FK 500.
			const targetIds = [...new Set(validRelations.map(relation => relation.targetId))]
			const found = await tx
				.select({ id: lexicon.id })
				.from(lexicon)
				.where(inArray(lexicon.id, targetIds))
			if (found.length !== targetIds.length) {
				const foundIds = new Set(found.map(row => row.id))
				const missing = targetIds.filter(id => !foundIds.has(id))
				throw error(400, `Relation target(s) not found: ${missing.join(', ')}`)
			}

			await tx.insert(lexiconRelations).values(
				validRelations.map(relation => ({
					sourceId: entry.id,
					targetId: relation.targetId,
					relationType: relation.relationType,
					notes: relation.notes?.trim() || null,
				})),
			).onConflictDoNothing()
		}

		return entry
	})
}

export async function updateWordbookEntry(
	entryId: number,
	updates: {
		word?: string
		languageId?: number
		pronunciation?: string
		etymology?: string
		notes?: string
		pageSlug?: string
		tags?: string[]
	},
	userId: number,
) {
	const normalizedTags = normalizeTags(updates.tags)

	return db.transaction(async (tx) => {
		const current = await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Headword updated', tx)

		// Renaming or moving language re-runs homograph resolution so the
		// create-time guard can't be bypassed via update.
		const nextWord = updates.word === undefined ? current.word : updates.word.trim()
		const nextLanguageId = updates.languageId ?? current.languageId
		const identityChanged = nextWord.toLowerCase() !== current.word.toLowerCase()
			|| nextLanguageId !== current.languageId

		let homographNumber = current.homographNumber
		if (identityChanged) {
			homographNumber = await resolveHomographNumber(tx, nextWord, nextLanguageId, false, entryId)
		}

		const [updated] = await tx
			.update(lexicon)
			.set({
				...(updates.word !== undefined && { word: nextWord }),
				...(updates.languageId !== undefined && { languageId: nextLanguageId }),
				...(identityChanged && { homographNumber }),
				...(updates.pronunciation !== undefined && { pronunciation: updates.pronunciation?.trim() || null }),
				...(updates.etymology !== undefined && { etymology: updates.etymology?.trim() || null }),
				...(updates.notes !== undefined && { notes: updates.notes?.trim() || null }),
				...(updates.pageSlug !== undefined && { pageSlug: updates.pageSlug?.trim() || null }),
				...(normalizedTags !== undefined && { tags: normalizedTags }),
				updatedAt: new Date(),
			})
			.where(eq(lexicon.id, entryId))
			.returning()

		return updated
	})
}

export async function replaceEntryDefinitions(entryId: number, defs: WordbookDefinitionInput[], userId: number) {
	const normalizedDefinitions = normalizeDefinitions(defs)

	await db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Definitions updated', tx)
		await tx.delete(definitions).where(eq(definitions.entryId, entryId))

		await tx.insert(definitions).values(
			normalizedDefinitions.map((definition, index) => ({
				entryId,
				senseNumber: index + 1,
				partOfSpeech: definition.partOfSpeech,
				definition: definition.definition,
				usageExample: definition.usageExample,
				usageTranslation: definition.usageTranslation,
			})),
		)

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})

	return { success: true, count: normalizedDefinitions.length }
}

export async function addEntryDefinition(entryId: number, definition: WordbookDefinitionInput, userId: number) {
	if (!definition.definition?.trim()) {
		throw error(400, 'Definition is required')
	}

	return db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Definition added', tx)

		const [{ max }] = await tx
			.select({ max: sql<number>`COALESCE(MAX(sense_number), 0)` })
			.from(definitions)
			.where(eq(definitions.entryId, entryId))

		const [created] = await tx
			.insert(definitions)
			.values({
				entryId,
				senseNumber: Number(max) + 1,
				partOfSpeech: definition.partOfSpeech?.trim() || null,
				definition: definition.definition.trim(),
				usageExample: definition.usageExample?.trim() || null,
				usageTranslation: definition.usageTranslation?.trim() || null,
			})
			.returning()

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
		return created
	})
}

export async function updateEntryDefinition(
	entryId: number,
	definitionId: number,
	updates: Partial<WordbookDefinitionInput>,
	userId: number,
) {
	return db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Definition updated', tx)

		const [updated] = await tx
			.update(definitions)
			.set({
				...(updates.partOfSpeech !== undefined && { partOfSpeech: updates.partOfSpeech?.trim() || null }),
				...(updates.definition !== undefined && { definition: updates.definition.trim() }),
				...(updates.usageExample !== undefined && { usageExample: updates.usageExample?.trim() || null }),
				...(updates.usageTranslation !== undefined && { usageTranslation: updates.usageTranslation?.trim() || null }),
			})
			.where(and(eq(definitions.id, definitionId), eq(definitions.entryId, entryId)))
			.returning()

		if (!updated) throw error(404, 'Definition not found')

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
		return updated
	})
}

export async function deleteEntryDefinition(entryId: number, definitionId: number, userId: number) {
	await db.transaction(async (tx) => {
		await assertEntry(entryId, tx)

		const entryDefinitions = await tx
			.select({ id: definitions.id })
			.from(definitions)
			.where(eq(definitions.entryId, entryId))
			.orderBy(asc(definitions.senseNumber))

		if (entryDefinitions.length <= 1) {
			throw error(400, 'Cannot delete the last definition. Delete the entire entry instead.')
		}

		await snapshotEntry(entryId, userId, 'Definition deleted', tx)

		const [deleted] = await tx
			.delete(definitions)
			.where(and(eq(definitions.id, definitionId), eq(definitions.entryId, entryId)))
			.returning()

		if (!deleted) throw error(404, 'Definition not found')

		const remaining = await tx
			.select({ id: definitions.id })
			.from(definitions)
			.where(eq(definitions.entryId, entryId))
			.orderBy(asc(definitions.senseNumber))

		for (let index = 0; index < remaining.length; index++) {
			await tx
				.update(definitions)
				.set({ senseNumber: index + 1 })
				.where(eq(definitions.id, remaining[index].id))
		}

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})
}

export async function addEntryRelation(
	entryId: number,
	relation: { targetId: number, relationType: string, notes?: string },
	userId: number,
) {
	if (!relation.targetId || !relation.relationType) {
		throw error(400, 'targetId and relationType are required')
	}
	if (!VALID_RELATION_TYPES.has(relation.relationType)) {
		throw error(400, `Invalid relation type. Must be one of: ${[...VALID_RELATION_TYPES].join(', ')}`)
	}
	if (relation.targetId === entryId) {
		throw error(400, 'Cannot relate an entry to itself')
	}

	return db.transaction(async (tx) => {
		await assertEntry(entryId, tx)

		const target = await getEntry(relation.targetId, tx)
		if (!target) throw error(404, 'Target entry not found')

		const [duplicate] = await tx
			.select({ id: lexiconRelations.id })
			.from(lexiconRelations)
			.where(and(
				eq(lexiconRelations.sourceId, entryId),
				eq(lexiconRelations.targetId, relation.targetId),
				eq(lexiconRelations.relationType, relation.relationType),
			))
		if (duplicate) throw error(409, 'This relation already exists')

		await snapshotEntry(entryId, userId, 'Relation added', tx)

		const [created] = await tx
			.insert(lexiconRelations)
			.values({
				sourceId: entryId,
				targetId: relation.targetId,
				relationType: relation.relationType,
				notes: relation.notes?.trim() || null,
			})
			.returning()

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
		return created
	})
}

export async function deleteEntryRelation(entryId: number, relationId: number, userId: number) {
	await db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Relation removed', tx)

		const [deleted] = await tx
			.delete(lexiconRelations)
			.where(and(eq(lexiconRelations.id, relationId), eq(lexiconRelations.sourceId, entryId)))
			.returning()

		if (!deleted) throw error(404, 'Relation not found')
		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})
}

export async function addEntryVariant(
	entryId: number,
	variant: { dialectId: number, pronunciation?: string, spelling?: string, notes?: string },
	userId: number,
) {
	if (!variant.dialectId) throw error(400, 'dialectId is required')
	if (!variant.pronunciation?.trim() && !variant.spelling?.trim()) {
		throw error(400, 'At least pronunciation or spelling is required')
	}

	return db.transaction(async (tx) => {
		const entry = await assertEntry(entryId, tx)

		const [dialect] = await tx
			.select({ id: languageDialects.id, languageId: languageDialects.languageId })
			.from(languageDialects)
			.where(eq(languageDialects.id, variant.dialectId))
		if (!dialect) throw error(404, 'Dialect not found')
		if (dialect.languageId !== entry.languageId) {
			throw error(400, 'Dialect belongs to a different language than this entry')
		}

		const [existing] = await tx
			.select({ id: lexiconVariants.id })
			.from(lexiconVariants)
			.where(and(eq(lexiconVariants.entryId, entryId), eq(lexiconVariants.dialectId, variant.dialectId)))

		if (existing) {
			throw error(409, 'A variant for this dialect already exists. Edit it instead.')
		}

		await snapshotEntry(entryId, userId, 'Variant added', tx)

		const [created] = await tx
			.insert(lexiconVariants)
			.values({
				entryId,
				dialectId: variant.dialectId,
				pronunciation: variant.pronunciation?.trim() || null,
				spelling: variant.spelling?.trim() || null,
				notes: variant.notes?.trim() || null,
			})
			.returning()

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
		return created
	})
}

export async function deleteEntryVariant(entryId: number, variantId: number, userId: number) {
	await db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Variant removed', tx)

		const [deleted] = await tx
			.delete(lexiconVariants)
			.where(and(eq(lexiconVariants.id, variantId), eq(lexiconVariants.entryId, entryId)))
			.returning()

		if (!deleted) throw error(404, 'Variant not found')
		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})
}

export async function updateEntryInflection(
	entryId: number,
	updates: { classId?: number | null, stem?: string | null, overrides?: Record<string, string> },
	userId: number,
) {
	await db.transaction(async (tx) => {
		await assertEntry(entryId, tx)
		await snapshotEntry(entryId, userId, 'Inflection updated', tx)

		const [existing] = await tx
			.select()
			.from(lexiconInflections)
			.where(eq(lexiconInflections.entryId, entryId))

		if (existing) {
			await tx
				.update(lexiconInflections)
				.set({
					...(updates.classId !== undefined && { classId: updates.classId || null }),
					...(updates.stem !== undefined && { stem: updates.stem?.trim() || null }),
					...(updates.overrides !== undefined && { overrides: updates.overrides }),
				})
				.where(eq(lexiconInflections.entryId, entryId))
		} else {
			await tx.insert(lexiconInflections).values({
				entryId,
				classId: updates.classId || null,
				stem: updates.stem?.trim() || null,
				overrides: updates.overrides || {},
			})
		}

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
		await rebuildInflectedForms(entryId, tx)
	})

	return getInflectionTable(entryId)
}

// ── Revision history ────────────────────────────────────────────

/** List an entry's revisions, newest first (metadata only, no snapshots). */
export async function listEntryRevisions(entryId: number) {
	await assertEntry(entryId)
	return db
		.select({
			id: lexiconRevisions.id,
			editSummary: lexiconRevisions.editSummary,
			createdAt: lexiconRevisions.createdAt,
			userId: lexiconRevisions.userId,
			username: users.username,
		})
		.from(lexiconRevisions)
		.leftJoin(users, eq(lexiconRevisions.userId, users.id))
		.where(eq(lexiconRevisions.entryId, entryId))
		.orderBy(desc(lexiconRevisions.createdAt), desc(lexiconRevisions.id))
}

/** Fetch one revision with its full snapshot. */
export async function getEntryRevision(entryId: number, revisionId: number) {
	const [revision] = await db
		.select()
		.from(lexiconRevisions)
		.where(and(eq(lexiconRevisions.id, revisionId), eq(lexiconRevisions.entryId, entryId)))
	if (!revision) throw error(404, 'Revision not found')
	return revision
}

type RevisionSnapshot = {
	word?: string
	languageId?: number
	pronunciation?: string | null
	etymology?: string | null
	notes?: string | null
	pageSlug?: string | null
	tags?: string[] | null
	definitions?: Array<{
		senseNumber?: number
		partOfSpeech?: string | null
		definition: string
		usageExample?: string | null
		usageTranslation?: string | null
		dialectId?: number | null
	}>
	variants?: Array<{ dialectId: number, pronunciation?: string | null, spelling?: string | null, notes?: string | null }>
	relations?: Array<{ targetId: number, relationType: string, notes?: string | null }>
	inflection?: { classId?: number | null, stem?: string | null, overrides?: Record<string, string> } | null
}

/**
 * Restore an entry to a prior revision. The current state is snapshotted
 * first ("Restored to revision N" then appears in history with the pre-restore
 * state one step back). Old-style snapshots without variants/relations/
 * inflection leave those aspects untouched. Relations/variants whose targets
 * or dialects no longer exist are silently dropped.
 */
export async function restoreEntryRevision(entryId: number, revisionId: number, userId: number) {
	return db.transaction(async (tx) => {
		const current = await assertEntry(entryId, tx)
		const revision = await getEntryRevision(entryId, revisionId)
		const snapshot = revision.snapshot as RevisionSnapshot

		await snapshotEntry(entryId, userId, `Restored to revision ${revisionId}`, tx)

		// Headword fields — homograph identity re-resolved if word/language differ.
		const nextWord = (snapshot.word ?? current.word).trim()
		const nextLanguageId = snapshot.languageId ?? current.languageId
		const identityChanged = nextWord.toLowerCase() !== current.word.toLowerCase()
			|| nextLanguageId !== current.languageId
		const homographNumber = identityChanged
			? await resolveHomographNumber(tx, nextWord, nextLanguageId, false, entryId)
			: current.homographNumber

		await tx
			.update(lexicon)
			.set({
				word: nextWord,
				languageId: nextLanguageId,
				homographNumber,
				pronunciation: snapshot.pronunciation ?? null,
				etymology: snapshot.etymology ?? null,
				notes: snapshot.notes ?? null,
				pageSlug: snapshot.pageSlug ?? null,
				tags: snapshot.tags ?? [],
				updatedAt: new Date(),
			})
			.where(eq(lexicon.id, entryId))

		// Definitions — full replace from snapshot.
		if (snapshot.definitions && snapshot.definitions.length > 0) {
			await tx.delete(definitions).where(eq(definitions.entryId, entryId))
			await tx.insert(definitions).values(
				snapshot.definitions.map((definition, index) => ({
					entryId,
					senseNumber: index + 1,
					partOfSpeech: definition.partOfSpeech ?? null,
					definition: definition.definition,
					usageExample: definition.usageExample ?? null,
					usageTranslation: definition.usageTranslation ?? null,
				})),
			)
		}

		// Variants — only in new-style snapshots; filter to still-existing dialects.
		if (snapshot.variants) {
			await tx.delete(lexiconVariants).where(eq(lexiconVariants.entryId, entryId))
			const dialectIds = [...new Set(snapshot.variants.map(variant => variant.dialectId))]
			if (dialectIds.length > 0) {
				const alive = await tx
					.select({ id: languageDialects.id })
					.from(languageDialects)
					.where(inArray(languageDialects.id, dialectIds))
				const aliveIds = new Set(alive.map(dialect => dialect.id))
				const rows = snapshot.variants.filter(variant => aliveIds.has(variant.dialectId))
				if (rows.length > 0) {
					await tx.insert(lexiconVariants).values(rows.map(variant => ({
						entryId,
						dialectId: variant.dialectId,
						pronunciation: variant.pronunciation ?? null,
						spelling: variant.spelling ?? null,
						notes: variant.notes ?? null,
					})))
				}
			}
		}

		// Relations — only in new-style snapshots; filter to still-existing targets.
		if (snapshot.relations) {
			await tx.delete(lexiconRelations).where(eq(lexiconRelations.sourceId, entryId))
			const targetIds = [...new Set(snapshot.relations.map(relation => relation.targetId))]
			if (targetIds.length > 0) {
				const alive = await tx
					.select({ id: lexicon.id })
					.from(lexicon)
					.where(inArray(lexicon.id, targetIds))
				const aliveIds = new Set(alive.map(target => target.id))
				const rows = snapshot.relations.filter(relation =>
					aliveIds.has(relation.targetId) && VALID_RELATION_TYPES.has(relation.relationType))
				if (rows.length > 0) {
					await tx.insert(lexiconRelations).values(rows.map(relation => ({
						sourceId: entryId,
						targetId: relation.targetId,
						relationType: relation.relationType,
						notes: relation.notes ?? null,
					}))).onConflictDoNothing()
				}
			}
		}

		// Inflection — only in new-style snapshots (null means "had none").
		if (snapshot.inflection !== undefined) {
			await tx.delete(lexiconInflections).where(eq(lexiconInflections.entryId, entryId))
			if (snapshot.inflection) {
				await tx.insert(lexiconInflections).values({
					entryId,
					classId: snapshot.inflection.classId ?? null,
					stem: snapshot.inflection.stem ?? null,
					overrides: snapshot.inflection.overrides ?? {},
				})
			}
			await rebuildInflectedForms(entryId, tx)
		}

		return { success: true, restoredFrom: revisionId }
	})
}
