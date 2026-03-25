import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { lexicon, definitions, languages, languageDialects, inflectionDimensions, paradigmClasses } from '$lib/server/db/schema.js'
import { eq, sql, asc, and } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'
import { getAncestryChain, getChildren } from '$lib/server/wordbook/language-tree.js'

export const load: PageServerLoad = async ({ params, url }) => {
	// Fetch language with inherited family from ancestors
	const langResult = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, family, parent_language_id, 0 AS depth
			FROM languages
			WHERE LOWER(slug) = LOWER(${params.language})
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
			(SELECT COUNT(*)::int FROM lexicon WHERE language_id = l.id) AS "wordCount"
		FROM languages l
		WHERE LOWER(l.slug) = LOWER(${params.language})
	`) as any[]

	const langWithCount = langResult[0]
	if (!langWithCount) error(404, 'Language not found')
	const lang = langWithCount

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
