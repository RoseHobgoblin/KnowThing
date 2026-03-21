import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages, languageDialects, inflectionDimensions, paradigmClasses } from '$lib/server/db/schema.js'
import { eq, sql, asc, and } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain, getChildren } from '$lib/server/wordbook/language-tree.js'

export const load: PageServerLoad = async ({ params, url }) => {
	const langResult = await db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			script: languages.script,
			family: languages.family,
			color: languages.color,
			description: languages.description,
			pageSlug: languages.pageSlug,
		})
		.from(languages)
		.where(sql`LOWER(${languages.slug}) = LOWER(${params.language})`)

	const lang = langResult[0]
	if (!lang) error(404, 'Language not found')

	const [{ count: wordCount }] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(lexicon)
		.where(eq(lexicon.languageId, lang.id))

	const langWithCount = { ...lang, wordCount }

	// Canonical redirect if casing doesn't match
	if (lang.slug !== params.language) {
		const query = url.searchParams.toString()
		redirect(301, `/wordbook/${lang.slug}${query ? `?${query}` : ''}`)
	}

	// Load ancestry, children, dialects, inflection setup
	const [ancestryChain, children, dialects, dimensions, classes] = await Promise.all([
		getAncestryChain(lang.id),
		getChildren(lang.id),
		db.select().from(languageDialects).where(eq(languageDialects.languageId, lang.id)).orderBy(asc(languageDialects.name)),
		db.select().from(inflectionDimensions).where(eq(inflectionDimensions.languageId, lang.id)).orderBy(asc(inflectionDimensions.partOfSpeech), asc(inflectionDimensions.sortOrder)),
		db.select().from(paradigmClasses).where(eq(paradigmClasses.languageId, lang.id)).orderBy(asc(paradigmClasses.partOfSpeech), asc(paradigmClasses.name)),
	])

	const letter = url.searchParams.get('letter') || ''
	const conditions = [eq(lexicon.languageId, lang.id)]
	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`)
	}

	const entries = await db
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

	const activeLettersResult = await db
		.select({
			letter: sql<string>`DISTINCT UPPER(LEFT(${lexicon.word}, 1))`.as('letter'),
		})
		.from(lexicon)
		.where(eq(lexicon.languageId, lang.id))
		.orderBy(sql`letter`)

	return {
		language: langWithCount,
		entries,
		ancestryChain,
		children,
		dialects,
		inflectionDimensions: dimensions,
		paradigmClasses: classes,
		activeLetters: activeLettersResult.map(r => r.letter),
		currentLetter: letter,
	}
}
