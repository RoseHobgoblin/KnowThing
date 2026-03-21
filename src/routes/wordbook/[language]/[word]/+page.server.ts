import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages, lexiconVariants, languageDialects, paradigmClasses } from '$lib/server/db/schema.js'
import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js'
import { getInflectionTable } from '$lib/server/wordbook/inflection.js'

function groupBy<T>(items: T[], keyFn: (item: T) => number): Map<number, T[]> {
	const map = new Map<number, T[]>()
	for (const item of items) {
		const key = keyFn(item)
		if (!map.has(key)) map.set(key, [])
		map.get(key)!.push(item)
	}
	return map
}

export const load: PageServerLoad = async ({ params }) => {
	const word = decodeURIComponent(params.word).normalize('NFC')

	const [lang] = await db
		.select()
		.from(languages)
		.where(eq(languages.slug, params.language))

	if (!lang) error(404, 'Language not found')

	// Get ALL homograph entries for this word+language
	const entries = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			etymology: lexicon.etymology,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			homographNumber: lexicon.homographNumber,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt,
		})
		.from(lexicon)
		.where(and(
			sql`LOWER(${lexicon.word}) = LOWER(${word})`,
			eq(lexicon.languageId, lang.id),
		))
		.orderBy(asc(lexicon.homographNumber))

	if (entries.length === 0) error(404, `No entry for "${word}" in ${lang.name}`)

	// Canonical redirect: URL must match stored word casing exactly
	const storedWord = entries[0].word
	if (decodeURIComponent(params.word) !== storedWord) {
		redirect(301, `/wordbook/${params.language}/${encodeURIComponent(storedWord)}`)
	}

	const entryIds = entries.map(e => e.id)

	// Batch load definitions and variants for ALL homographs in 2 queries instead of 2N
	const [allDefs, allVariants, allInflections, ...etymologyResults] = await Promise.all([
		db.select()
			.from(definitions)
			.where(inArray(definitions.entryId, entryIds))
			.orderBy(asc(definitions.entryId), asc(definitions.senseNumber)),
		db.select({
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
			.where(inArray(lexiconVariants.entryId, entryIds)),
		// Inflection tables still need per-entry calls (paradigm rule application)
		Promise.all(entryIds.map(id => getInflectionTable(id))),
		// Etymology still needs per-entry calls (graph traversal)
		...entryIds.map(id => Promise.all([
			getDirectRelations(id),
			computeCognates(id, lang.id),
			getEtymologyChain(id),
		])),
	])

	const defsByEntry = groupBy(allDefs, d => d.entryId)
	const variantsByEntry = groupBy(allVariants, v => v.entryId)

	const homographs = entries.map((entry, index) => ({
		entry,
		definitions: defsByEntry.get(entry.id) || [],
		variants: variantsByEntry.get(entry.id) || [],
		inflection: allInflections[index],
		relations: {
			direct: etymologyResults[index][0],
			cognates: etymologyResults[index][1],
			etymologyChain: etymologyResults[index][2],
		},
	}))

	// Load available paradigm classes for this language (for inflection assignment)
	const availableClasses = await db
		.select({ id: paradigmClasses.id, name: paradigmClasses.name, partOfSpeech: paradigmClasses.partOfSpeech })
		.from(paradigmClasses)
		.where(eq(paradigmClasses.languageId, lang.id))
		.orderBy(asc(paradigmClasses.partOfSpeech), asc(paradigmClasses.name))

	return {
		word: entries[0].word,
		language: lang,
		homographs,
		isMultipleHomographs: entries.length > 1,
		availableClasses,
	}
}
