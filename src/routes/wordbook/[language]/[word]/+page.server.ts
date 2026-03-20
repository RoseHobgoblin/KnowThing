import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages, lexiconVariants, languageDialects } from '$lib/server/db/schema.js'
import { eq, and, asc, sql } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js'
import { getInflectionTable } from '$lib/server/wordbook/inflection.js'

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

	// For each homograph, load definitions, variants, and relations
	const homographs = await Promise.all(entries.map(async (entry) => {
		const [defs, variants, inflection, direct, cognates, etymologyChain] = await Promise.all([
			db.select()
				.from(definitions)
				.where(eq(definitions.entryId, entry.id))
				.orderBy(asc(definitions.senseNumber)),
			db.select({
				id: lexiconVariants.id,
				pronunciation: lexiconVariants.pronunciation,
				spelling: lexiconVariants.spelling,
				notes: lexiconVariants.notes,
				dialectName: languageDialects.name,
				dialectSlug: languageDialects.slug,
				dialectRegion: languageDialects.region,
			})
				.from(lexiconVariants)
				.innerJoin(languageDialects, eq(lexiconVariants.dialectId, languageDialects.id))
				.where(eq(lexiconVariants.entryId, entry.id)),
			getInflectionTable(entry.id),
			getDirectRelations(entry.id),
			computeCognates(entry.id, lang.id),
			getEtymologyChain(entry.id),
		])

		return {
			entry,
			definitions: defs,
			variants,
			inflection,
			relations: { direct, cognates, etymologyChain },
		}
	}))

	return {
		word: entries[0].word,
		language: lang,
		homographs,
		isMultipleHomographs: entries.length > 1,
	}
}
