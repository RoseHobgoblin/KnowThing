import { db } from '$lib/server/db/index.js'
import { lexicon, lexiconRelations, languages } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────

export interface RelatedEntry {
	id: number
	relationId: number
	word: string
	definition: string
	pronunciation: string | null
	partOfSpeech: string | null
	languageName: string
	languageSlug: string
	languageFamily: string | null
	languageColor: string | null
	relationNotes: string | null
}

export interface DirectRelations {
	derivedFrom: RelatedEntry[]
	loanFrom: RelatedEntry[]
	compoundOf: RelatedEntry[]
	derivedWords: RelatedEntry[]
	loanedTo: RelatedEntry[]
	compoundsUsing: RelatedEntry[]
}

export interface CognateLanguage {
	name: string
	slug: string
	words: Array<{
		id: number
		word: string
		definition: string
		pronunciation: string | null
	}>
}

export interface CognateGroup {
	family: string
	languages: CognateLanguage[]
}

export interface EtymologyStep {
	id: number
	word: string
	definition: string
	languageName: string
	languageSlug: string
	relation: string | null
}

// Helper: subquery for first definition of a lexicon entry
const firstDefSql = (entryRef: any) => sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${entryRef} ORDER BY sense_number LIMIT 1)`
const firstPosSql = (entryRef: any) => sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${entryRef} ORDER BY sense_number LIMIT 1)`

// ── Direct Relations ────────────────────────────────────────────────

export async function getDirectRelations(entryId: number): Promise<DirectRelations> {
	const outgoing = await db
		.select({
			id: lexicon.id,
			relationId: lexiconRelations.id,
			word: lexicon.word,
			definition: firstDefSql(lexicon.id).as('definition'),
			pronunciation: lexicon.pronunciation,
			partOfSpeech: firstPosSql(lexicon.id).as('part_of_speech'),
			languageName: languages.name,
			languageSlug: languages.slug,
			languageFamily: languages.family,
			languageColor: languages.color,
			relationType: lexiconRelations.relationType,
			relationNotes: lexiconRelations.notes,
		})
		.from(lexiconRelations)
		.innerJoin(lexicon, eq(lexiconRelations.targetId, lexicon.id))
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexiconRelations.sourceId, entryId))

	const incoming = await db
		.select({
			id: lexicon.id,
			relationId: lexiconRelations.id,
			word: lexicon.word,
			definition: firstDefSql(lexicon.id).as('definition'),
			pronunciation: lexicon.pronunciation,
			partOfSpeech: firstPosSql(lexicon.id).as('part_of_speech'),
			languageName: languages.name,
			languageSlug: languages.slug,
			languageFamily: languages.family,
			languageColor: languages.color,
			relationType: lexiconRelations.relationType,
			relationNotes: lexiconRelations.notes,
		})
		.from(lexiconRelations)
		.innerJoin(lexicon, eq(lexiconRelations.sourceId, lexicon.id))
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexiconRelations.targetId, entryId))

	const toRelated = (r: typeof outgoing[0]): RelatedEntry => ({
		id: r.id,
		relationId: r.relationId,
		word: r.word,
		definition: r.definition || '',
		pronunciation: r.pronunciation,
		partOfSpeech: r.partOfSpeech,
		languageName: r.languageName,
		languageSlug: r.languageSlug,
		languageFamily: r.languageFamily,
		languageColor: r.languageColor,
		relationNotes: r.relationNotes,
	})

	return {
		derivedFrom: outgoing.filter(r => r.relationType === 'derived_from').map(toRelated),
		loanFrom: outgoing.filter(r => r.relationType === 'loan_from').map(toRelated),
		compoundOf: outgoing.filter(r => r.relationType === 'compound_of').map(toRelated),
		derivedWords: incoming.filter(r => r.relationType === 'derived_from').map(toRelated),
		loanedTo: incoming.filter(r => r.relationType === 'loan_from').map(toRelated),
		compoundsUsing: incoming.filter(r => r.relationType === 'compound_of').map(toRelated),
	}
}

// ── Ancestry / Root Finding ─────────────────────────────────────────

/**
 * NOTE on `compound_of`: deliberately excluded from ancestry/cognate/chain
 * recursion here and below. A compound has multiple parents, so following it
 * would make every word sharing one compound member a "cognate" — linguistic
 * nonsense. Compound links surface only as direct relations
 * (compoundOf / compoundsUsing in getDirectRelations above).
 */
export async function findRoots(entryId: number): Promise<number[]> {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestors AS (
			SELECT target_id AS id, 1 AS depth
			FROM lexicon_relations
			WHERE source_id = ${entryId}
			  AND relation_type IN ('derived_from', 'loan_from')
			UNION ALL
			SELECT lr.target_id, a.depth + 1
			FROM ancestors a
			JOIN lexicon_relations lr ON lr.source_id = a.id
			WHERE lr.relation_type IN ('derived_from', 'loan_from')
			  AND a.depth < 20
		)
		SELECT DISTINCT a.id FROM ancestors a
		WHERE NOT EXISTS (
			SELECT 1 FROM lexicon_relations lr2
			WHERE lr2.source_id = a.id
			  AND lr2.relation_type IN ('derived_from', 'loan_from')
		)
	`)

	const ids = (result as any[]).map((r: any) => r.id as number)
	if (ids.length === 0) return [entryId]
	return ids
}

export async function getEtymologyChain(entryId: number): Promise<EtymologyStep[]> {
	const result = await db.execute(sql`
		WITH RECURSIVE chain AS (
			SELECT
				l.id, l.word,
				(SELECT definition FROM definitions WHERE entry_id = l.id ORDER BY sense_number LIMIT 1) AS definition,
				lang.name AS language_name, lang.slug AS language_slug,
				CAST(NULL AS TEXT) AS relation,
				0 AS depth
			FROM lexicon l
			JOIN languages lang ON l.language_id = lang.id
			WHERE l.id = ${entryId}
			UNION ALL
			SELECT
				l.id, l.word,
				(SELECT definition FROM definitions WHERE entry_id = l.id ORDER BY sense_number LIMIT 1) AS definition,
				lang.name AS language_name, lang.slug AS language_slug,
				lr.relation_type AS relation,
				c.depth + 1
			FROM chain c
			JOIN lexicon_relations lr ON lr.source_id = c.id
			JOIN lexicon l ON l.id = lr.target_id
			JOIN languages lang ON l.language_id = lang.id
			WHERE lr.relation_type IN ('derived_from', 'loan_from')
			  AND c.depth < 20
		)
		SELECT DISTINCT ON (id) id, word, definition, language_name, language_slug, relation, depth
		FROM chain
		ORDER BY id, depth DESC
	`)

	const steps = (result as any[]).map((r: any) => ({
		id: r.id as number,
		word: r.word as string,
		definition: (r.definition || '') as string,
		languageName: r.language_name as string,
		languageSlug: r.language_slug as string,
		relation: r.relation as string | null,
	}))

	return steps.toSorted((a, b) => {
		if (a.relation === null && b.relation !== null) return -1
		if (a.relation !== null && b.relation === null) return 1
		return 0
	})
}

// ── Cognate Computation ─────────────────────────────────────────────

export async function computeCognates(
	entryId: number,
	currentLanguageId: number,
): Promise<CognateGroup[]> {
	const roots = await findRoots(entryId)

	// Exclude the current entry's whole origin and daughter branches. Cognates are
	// sibling branches descending from a shared root, never a word's ancestors or
	// descendants.
	const ancestorResult = await db.execute(sql`
		WITH RECURSIVE ancestors AS (
			SELECT ${entryId}::integer AS id, 0 AS depth
			UNION ALL
			SELECT lr.target_id, a.depth + 1
			FROM ancestors a
			JOIN lexicon_relations lr ON lr.source_id = a.id
			WHERE lr.relation_type IN ('derived_from', 'loan_from')
			  AND a.depth < 20
		)
		SELECT DISTINCT id FROM ancestors
	`)
	const ancestorIds = new Set((ancestorResult as any[]).map((r: any) => r.id as number))
	const descendantResult = await db.execute(sql`
		WITH RECURSIVE descendants AS (
			SELECT ${entryId}::integer AS id, 0 AS depth
			UNION ALL
			SELECT lr.source_id, d.depth + 1
			FROM descendants d
			JOIN lexicon_relations lr ON lr.target_id = d.id
			WHERE lr.relation_type IN ('derived_from', 'loan_from')
			  AND d.depth < 20
		)
		SELECT DISTINCT id FROM descendants
	`)
	const descendantIds = new Set((descendantResult as any[]).map((r: any) => r.id as number))

	const allDescendants = new Map<number, { word: string, definition: string, pronunciation: string | null, languageName: string, languageSlug: string, languageFamily: string | null, languageId: number }>()

	if (roots.length === 0) return []

	for (const rootId of roots) {
		const result = await db.execute(sql`
			WITH RECURSIVE descendants AS (
				SELECT ${rootId}::integer AS id, 0 AS depth
				UNION ALL
				SELECT lr.source_id, d.depth + 1
				FROM descendants d
				JOIN lexicon_relations lr ON lr.target_id = d.id
				WHERE lr.relation_type IN ('derived_from', 'loan_from')
				  AND d.depth < 20
			)
			SELECT DISTINCT
				l.id, l.word,
				(SELECT definition FROM definitions WHERE entry_id = l.id ORDER BY sense_number LIMIT 1) AS definition,
				l.pronunciation, l.language_id,
				lang.name AS language_name, lang.slug AS language_slug, lang.family AS language_family
			FROM descendants d
			JOIN lexicon l ON l.id = d.id
			JOIN languages lang ON l.language_id = lang.id
			WHERE l.id != ${entryId}
			LIMIT 200
		`)

		for (const r of result as any[]) {
			if (ancestorIds.has(r.id) || descendantIds.has(r.id)) continue
			allDescendants.set(r.id, {
				word: r.word,
				definition: r.definition || '',
				pronunciation: r.pronunciation,
				languageName: r.language_name,
				languageSlug: r.language_slug,
				languageFamily: r.language_family,
				languageId: r.language_id,
			})
		}
	}

	if (allDescendants.size === 0) return []

	const [currentLang] = await db
		.select({ family: languages.family })
		.from(languages)
		.where(eq(languages.id, currentLanguageId))
	const currentFamily = currentLang?.family || null

	const familyMap = new Map<string, Map<string, CognateLanguage>>()

	for (const [id, entry] of allDescendants) {
		const family = entry.languageFamily || 'Other'
		if (!familyMap.has(family)) familyMap.set(family, new Map())
		const langMap = familyMap.get(family)!

		if (!langMap.has(entry.languageSlug)) {
			langMap.set(entry.languageSlug, {
				name: entry.languageName,
				slug: entry.languageSlug,
				words: [],
			})
		}

		langMap.get(entry.languageSlug)!.words.push({
			id,
			word: entry.word,
			definition: entry.definition,
			pronunciation: entry.pronunciation,
		})
	}

	const groups: CognateGroup[] = []
	for (const [family, langMap] of familyMap) {
		groups.push({
			family,
			languages: [...langMap.values()].toSorted((a, b) => a.name.localeCompare(b.name)),
		})
	}

	return groups.toSorted((a, b) => {
		if (currentFamily) {
			if (a.family === currentFamily && b.family !== currentFamily) return -1
			if (a.family !== currentFamily && b.family === currentFamily) return 1
		}
		return a.family.localeCompare(b.family)
	})
}
