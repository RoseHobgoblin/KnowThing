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

export async function deleteWordbookEntry(entryId: number) {
	const [deleted] = await db.delete(lexicon).where(eq(lexicon.id, entryId)).returning()
	if (!deleted) throw error(404, 'Entry not found')
	return { success: true }
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
	return db
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
		.limit(limit)
}

export async function getTotalWordCount() {
	const [{ total }] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(lexicon)
	return Number(total)
}

export async function listLanguageEntries(languageId: number, letter: string | null) {
	const conditions = [eq(lexicon.languageId, languageId)]
	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`)
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
		.where(and(...conditions))
		.orderBy(asc(lexicon.word))
		.limit(500)
}

export async function listActiveLetters(languageId: number) {
	const rows = await db
		.select({
			letter: sql<string>`DISTINCT UPPER(LEFT(${lexicon.word}, 1))`.as('letter'),
		})
		.from(lexicon)
		.where(eq(lexicon.languageId, languageId))
		.orderBy(sql`letter`)
	return rows.map(r => r.letter)
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

async function getEntry(entryId: number) {
	const [entry] = await db.select().from(lexicon).where(eq(lexicon.id, entryId))
	return entry ?? null
}

async function assertEntry(entryId: number) {
	const entry = await getEntry(entryId)
	if (!entry) throw error(404, 'Entry not found')
	return entry
}

async function snapshotEntry(entryId: number, userId: number, summary: string) {
	const entry = await assertEntry(entryId)
	const entryDefinitions = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, entryId))
		.orderBy(asc(definitions.senseNumber))

	await db.insert(lexiconRevisions).values({
		entryId,
		snapshot: { ...entry, definitions: entryDefinitions },
		editSummary: summary,
		userId,
	})
}

export async function createWordbookEntry(input: CreateWordbookEntryInput) {
	const word = input.word.trim()
	const normalizedDefinitions = normalizeDefinitions(input.defs, input.definition)
	const normalizedTags = normalizeTags(input.tags) ?? []

	const existing = await db
		.select({ id: lexicon.id, homographNumber: lexicon.homographNumber })
		.from(lexicon)
		.where(and(sql`LOWER(${lexicon.word}) = LOWER(${word})`, eq(lexicon.languageId, input.languageId)))

	let homographNumber = 1
	if (existing.length > 0) {
		if (!input.isHomograph) {
			const [language] = await db
				.select({ name: languages.name })
				.from(languages)
				.where(eq(languages.id, input.languageId))

			throw error(409, `"${word}" already exists in ${language?.name || 'this language'}. Add a definition to the existing entry, or set isHomograph: true to create a separate homograph.`)
		}

		homographNumber = Math.max(...existing.map(entry => entry.homographNumber)) + 1
	}

	return db.transaction(async (tx) => {
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

		for (let index = 0; index < normalizedDefinitions.length; index++) {
			const definition = normalizedDefinitions[index]
			await tx.insert(definitions).values({
				entryId: entry.id,
				senseNumber: index + 1,
				partOfSpeech: definition.partOfSpeech,
				definition: definition.definition,
				usageExample: definition.usageExample,
				usageTranslation: definition.usageTranslation,
			})
		}

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entry.id))

		const validRelations = (input.relations || []).filter(relation =>
			relation.targetId && VALID_RELATION_TYPES.has(relation.relationType),
		)

		if (validRelations.length > 0) {
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
	await assertEntry(entryId)
	await snapshotEntry(entryId, userId, 'Headword updated')

	const normalizedTags = normalizeTags(updates.tags)

	const [updated] = await db
		.update(lexicon)
		.set({
			...(updates.word !== undefined && { word: updates.word.trim() }),
			...(updates.languageId !== undefined && { languageId: updates.languageId }),
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
}

export async function replaceEntryDefinitions(entryId: number, defs: WordbookDefinitionInput[], userId: number) {
	await assertEntry(entryId)
	const normalizedDefinitions = normalizeDefinitions(defs)
	await snapshotEntry(entryId, userId, 'Definitions updated')

	await db.transaction(async (tx) => {
		await tx.delete(definitions).where(eq(definitions.entryId, entryId))

		for (let index = 0; index < normalizedDefinitions.length; index++) {
			const definition = normalizedDefinitions[index]
			await tx.insert(definitions).values({
				entryId,
				senseNumber: index + 1,
				partOfSpeech: definition.partOfSpeech,
				definition: definition.definition,
				usageExample: definition.usageExample,
				usageTranslation: definition.usageTranslation,
			})
		}

		await tx.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	})

	return { success: true, count: normalizedDefinitions.length }
}

export async function addEntryDefinition(entryId: number, definition: WordbookDefinitionInput) {
	await assertEntry(entryId)
	if (!definition.definition?.trim()) {
		throw error(400, 'Definition is required')
	}

	const [{ max }] = await db
		.select({ max: sql<number>`COALESCE(MAX(sense_number), 0)` })
		.from(definitions)
		.where(eq(definitions.entryId, entryId))

	const [created] = await db
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

	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	return created
}

export async function updateEntryDefinition(
	entryId: number,
	definitionId: number,
	updates: Partial<WordbookDefinitionInput>,
	userId: number,
) {
	await assertEntry(entryId)
	await snapshotEntry(entryId, userId, 'Definition updated')

	const [updated] = await db
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

	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	return updated
}

export async function deleteEntryDefinition(entryId: number, definitionId: number, userId: number) {
	await assertEntry(entryId)

	const entryDefinitions = await db
		.select({ id: definitions.id })
		.from(definitions)
		.where(eq(definitions.entryId, entryId))
		.orderBy(asc(definitions.senseNumber))

	if (entryDefinitions.length <= 1) {
		throw error(400, 'Cannot delete the last definition. Delete the entire entry instead.')
	}

	await snapshotEntry(entryId, userId, 'Definition deleted')

	await db.transaction(async (tx) => {
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
) {
	await assertEntry(entryId)

	if (!relation.targetId || !relation.relationType) {
		throw error(400, 'targetId and relationType are required')
	}
	if (!VALID_RELATION_TYPES.has(relation.relationType)) {
		throw error(400, `Invalid relation type. Must be one of: ${[...VALID_RELATION_TYPES].join(', ')}`)
	}
	if (relation.targetId === entryId) {
		throw error(400, 'Cannot relate an entry to itself')
	}

	const target = await getEntry(relation.targetId)
	if (!target) throw error(404, 'Target entry not found')

	const [created] = await db
		.insert(lexiconRelations)
		.values({
			sourceId: entryId,
			targetId: relation.targetId,
			relationType: relation.relationType,
			notes: relation.notes?.trim() || null,
		})
		.returning()

	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	return created
}

export async function deleteEntryRelation(entryId: number, relationId: number) {
	await assertEntry(entryId)

	const [deleted] = await db
		.delete(lexiconRelations)
		.where(and(eq(lexiconRelations.id, relationId), eq(lexiconRelations.sourceId, entryId)))
		.returning()

	if (!deleted) throw error(404, 'Relation not found')
	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
}

export async function addEntryVariant(
	entryId: number,
	variant: { dialectId: number, pronunciation?: string, spelling?: string, notes?: string },
) {
	await assertEntry(entryId)

	if (!variant.dialectId) throw error(400, 'dialectId is required')
	if (!variant.pronunciation?.trim() && !variant.spelling?.trim()) {
		throw error(400, 'At least pronunciation or spelling is required')
	}

	const [dialect] = await db
		.select({ id: languageDialects.id })
		.from(languageDialects)
		.where(eq(languageDialects.id, variant.dialectId))
	if (!dialect) throw error(404, 'Dialect not found')

	const [existing] = await db
		.select({ id: lexiconVariants.id })
		.from(lexiconVariants)
		.where(and(eq(lexiconVariants.entryId, entryId), eq(lexiconVariants.dialectId, variant.dialectId)))

	if (existing) {
		throw error(409, 'A variant for this dialect already exists. Edit it instead.')
	}

	const [created] = await db
		.insert(lexiconVariants)
		.values({
			entryId,
			dialectId: variant.dialectId,
			pronunciation: variant.pronunciation?.trim() || null,
			spelling: variant.spelling?.trim() || null,
			notes: variant.notes?.trim() || null,
		})
		.returning()

	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	return created
}

export async function deleteEntryVariant(entryId: number, variantId: number) {
	await assertEntry(entryId)

	const [deleted] = await db
		.delete(lexiconVariants)
		.where(and(eq(lexiconVariants.id, variantId), eq(lexiconVariants.entryId, entryId)))
		.returning()

	if (!deleted) throw error(404, 'Variant not found')
	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
}

export async function updateEntryInflection(
	entryId: number,
	updates: { classId?: number | null, stem?: string, overrides?: Record<string, string> },
) {
	await assertEntry(entryId)

	const [existing] = await db
		.select()
		.from(lexiconInflections)
		.where(eq(lexiconInflections.entryId, entryId))

	if (existing) {
		await db
			.update(lexiconInflections)
			.set({
				...(updates.classId !== undefined && { classId: updates.classId || null }),
				...(updates.stem !== undefined && { stem: updates.stem?.trim() || null }),
				...(updates.overrides !== undefined && { overrides: updates.overrides }),
			})
			.where(eq(lexiconInflections.entryId, entryId))
	} else {
		await db.insert(lexiconInflections).values({
			entryId,
			classId: updates.classId || null,
			stem: updates.stem?.trim() || null,
			overrides: updates.overrides || {},
		})
	}

	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entryId))
	await rebuildInflectedForms(entryId)
	return getInflectionTable(entryId)
}
