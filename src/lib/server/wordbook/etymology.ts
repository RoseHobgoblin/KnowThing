import { db } from '$lib/server/db/index.js';
import { lexicon, lexiconRelations, languages } from '$lib/server/db/schema.js';
import { eq, sql, and, inArray } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────

export interface RelatedEntry {
	id: number;
	relationId: number;
	word: string;
	definition: string;
	pronunciation: string | null;
	partOfSpeech: string | null;
	languageName: string;
	languageSlug: string;
	languageFamily: string | null;
	languageColor: string | null;
	relationNotes: string | null;
}

export interface DirectRelations {
	derivedFrom: RelatedEntry[];
	loanFrom: RelatedEntry[];
	compoundOf: RelatedEntry[];
	derivedWords: RelatedEntry[];
	loanedTo: RelatedEntry[];
	compoundsUsing: RelatedEntry[];
}

export interface CognateLanguage {
	name: string;
	slug: string;
	words: Array<{
		id: number;
		word: string;
		definition: string;
		pronunciation: string | null;
	}>;
}

export interface CognateGroup {
	family: string;
	languages: CognateLanguage[];
}

export interface EtymologyStep {
	id: number;
	word: string;
	definition: string;
	languageName: string;
	languageSlug: string;
	relation: string | null; // null for the root
}

// ── Direct Relations ────────────────────────────────────────────────

/** Get all direct relations for an entry (both directions) */
export async function getDirectRelations(entryId: number): Promise<DirectRelations> {
	// Relations where this entry is the source (this word comes FROM target)
	const outgoing = await db
		.select({
			id: lexicon.id,
			relationId: lexiconRelations.id,
			word: lexicon.word,
			definition: lexicon.definition,
			pronunciation: lexicon.pronunciation,
			partOfSpeech: lexicon.partOfSpeech,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageFamily: languages.family,
			languageColor: languages.color,
			relationType: lexiconRelations.relationType,
			relationNotes: lexiconRelations.notes
		})
		.from(lexiconRelations)
		.innerJoin(lexicon, eq(lexiconRelations.targetId, lexicon.id))
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexiconRelations.sourceId, entryId));

	// Relations where this entry is the target (other words come FROM this)
	const incoming = await db
		.select({
			id: lexicon.id,
			relationId: lexiconRelations.id,
			word: lexicon.word,
			definition: lexicon.definition,
			pronunciation: lexicon.pronunciation,
			partOfSpeech: lexicon.partOfSpeech,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageFamily: languages.family,
			languageColor: languages.color,
			relationType: lexiconRelations.relationType,
			relationNotes: lexiconRelations.notes
		})
		.from(lexiconRelations)
		.innerJoin(lexicon, eq(lexiconRelations.sourceId, lexicon.id))
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexiconRelations.targetId, entryId));

	const toRelated = (r: typeof outgoing[0]): RelatedEntry => ({
		id: r.id,
		relationId: r.relationId,
		word: r.word,
		definition: r.definition,
		pronunciation: r.pronunciation,
		partOfSpeech: r.partOfSpeech,
		languageName: r.languageName,
		languageSlug: r.languageSlug,
		languageFamily: r.languageFamily,
		languageColor: r.languageColor,
		relationNotes: r.relationNotes
	});

	return {
		// Outgoing: this word's sources
		derivedFrom: outgoing.filter((r) => r.relationType === 'derived_from').map(toRelated),
		loanFrom: outgoing.filter((r) => r.relationType === 'loan_from').map(toRelated),
		compoundOf: outgoing.filter((r) => r.relationType === 'compound_of').map(toRelated),
		// Incoming: words derived from this
		derivedWords: incoming.filter((r) => r.relationType === 'derived_from').map(toRelated),
		loanedTo: incoming.filter((r) => r.relationType === 'loan_from').map(toRelated),
		compoundsUsing: incoming.filter((r) => r.relationType === 'compound_of').map(toRelated)
	};
}

// ── Ancestry / Root Finding ─────────────────────────────────────────

/** Find root ancestor(s) by walking up derived_from/loan_from chains */
export async function findRoots(entryId: number): Promise<number[]> {
	const result = await db.execute(sql`
		WITH RECURSIVE ancestors AS (
			-- Start: direct parents of the entry
			SELECT target_id AS id, 1 AS depth
			FROM lexicon_relations
			WHERE source_id = ${entryId}
			  AND relation_type IN ('derived_from', 'loan_from')
			UNION ALL
			-- Recurse: parents of parents
			SELECT lr.target_id, a.depth + 1
			FROM ancestors a
			JOIN lexicon_relations lr ON lr.source_id = a.id
			WHERE lr.relation_type IN ('derived_from', 'loan_from')
			  AND a.depth < 20
		)
		-- Roots are ancestors that have no parents themselves
		SELECT DISTINCT a.id FROM ancestors a
		WHERE NOT EXISTS (
			SELECT 1 FROM lexicon_relations lr2
			WHERE lr2.source_id = a.id
			  AND lr2.relation_type IN ('derived_from', 'loan_from')
		)
	`);

	const ids = (result as any[]).map((r: any) => r.id as number);

	// If no ancestors found, this entry itself is the root
	if (ids.length === 0) return [entryId];
	return ids;
}

/** Get the full etymology chain from root to this entry */
export async function getEtymologyChain(entryId: number): Promise<EtymologyStep[]> {
	const result = await db.execute(sql`
		WITH RECURSIVE chain AS (
			-- Start at the entry itself
			SELECT
				l.id, l.word, l.definition,
				lang.name AS language_name, lang.slug AS language_slug,
				CAST(NULL AS TEXT) AS relation,
				0 AS depth
			FROM lexicon l
			JOIN languages lang ON l.language_id = lang.id
			WHERE l.id = ${entryId}
			UNION ALL
			-- Walk up to parents
			SELECT
				l.id, l.word, l.definition,
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
	`);

	const steps = (result as any[]).map((r: any) => ({
		id: r.id as number,
		word: r.word as string,
		definition: r.definition as string,
		languageName: r.language_name as string,
		languageSlug: r.language_slug as string,
		relation: r.relation as string | null
	}));

	// Reverse so root is first
	return steps.sort((a, b) => {
		// Root (no relation) first, then by depth
		if (a.relation === null && b.relation !== null) return -1;
		if (a.relation !== null && b.relation === null) return 1;
		return 0;
	});
}

// ── Cognate Computation ─────────────────────────────────────────────

/** Compute cognates: find root, find all descendants, group by family */
export async function computeCognates(
	entryId: number,
	currentLanguageId: number
): Promise<CognateGroup[]> {
	// 1. Find roots
	const roots = await findRoots(entryId);

	// 2. Find all descendants of each root
	const allDescendants = new Map<number, { word: string; definition: string; pronunciation: string | null; languageName: string; languageSlug: string; languageFamily: string | null; languageId: number }>();

	for (const rootId of roots) {
		const result = await db.execute(sql`
			WITH RECURSIVE descendants AS (
				-- Start at root
				SELECT ${rootId}::integer AS id, 0 AS depth
				UNION ALL
				-- Walk down to children
				SELECT lr.source_id, d.depth + 1
				FROM descendants d
				JOIN lexicon_relations lr ON lr.target_id = d.id
				WHERE lr.relation_type IN ('derived_from', 'loan_from')
				  AND d.depth < 20
			)
			SELECT DISTINCT
				l.id, l.word, l.definition, l.pronunciation, l.language_id,
				lang.name AS language_name, lang.slug AS language_slug, lang.family AS language_family
			FROM descendants d
			JOIN lexicon l ON l.id = d.id
			JOIN languages lang ON l.language_id = lang.id
			WHERE l.id != ${entryId}
		`);

		for (const r of result as any[]) {
			allDescendants.set(r.id, {
				word: r.word,
				definition: r.definition,
				pronunciation: r.pronunciation,
				languageName: r.language_name,
				languageSlug: r.language_slug,
				languageFamily: r.language_family,
				languageId: r.language_id
			});
		}
	}

	if (allDescendants.size === 0) return [];

	// 3. Get current language's family for sorting
	const [currentLang] = await db
		.select({ family: languages.family })
		.from(languages)
		.where(eq(languages.id, currentLanguageId));
	const currentFamily = currentLang?.family || null;

	// 4. Group by family → language
	const familyMap = new Map<string, Map<string, CognateLanguage>>();

	for (const [id, entry] of allDescendants) {
		const family = entry.languageFamily || 'Other';
		if (!familyMap.has(family)) familyMap.set(family, new Map());
		const langMap = familyMap.get(family)!;

		if (!langMap.has(entry.languageSlug)) {
			langMap.set(entry.languageSlug, {
				name: entry.languageName,
				slug: entry.languageSlug,
				words: []
			});
		}

		langMap.get(entry.languageSlug)!.words.push({
			id,
			word: entry.word,
			definition: entry.definition,
			pronunciation: entry.pronunciation
		});
	}

	// 5. Convert to sorted array — current family first
	const groups: CognateGroup[] = [];

	for (const [family, langMap] of familyMap) {
		groups.push({
			family,
			languages: Array.from(langMap.values()).sort((a, b) => a.name.localeCompare(b.name))
		});
	}

	groups.sort((a, b) => {
		if (currentFamily) {
			if (a.family === currentFamily && b.family !== currentFamily) return -1;
			if (a.family !== currentFamily && b.family === currentFamily) return 1;
		}
		return a.family.localeCompare(b.family);
	});

	return groups;
}
