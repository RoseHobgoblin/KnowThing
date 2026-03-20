import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, categories, lexicon, languages } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { parseWikitext, extractCategories } from '$lib/parser/index.js'

export const load: PageServerLoad = async ({ params }) => {
	const [page] = await db
		.select()
		.from(pages)
		.where(eq(pages.slug, params.slug))
		.limit(1)

	if (!page) {
		return {
			notFound: true,
			slug: params.slug,
			title: params.slug.replaceAll('_', ' '),
			ast: null,
			categories: [],
		}
	}

	const ast = parseWikitext(page.content)
	const cats = extractCategories(page.content)

	// Check if this page title matches a word in the wordbook
	const wordbookMatches = await db
		.select({
			word: lexicon.word,
			languageSlug: languages.slug,
			languageName: languages.name,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(sql`LOWER(${lexicon.word}) = LOWER(${page.title.replaceAll(' ', '_')}) OR LOWER(${lexicon.word}) = LOWER(${page.title})`)
		.limit(1)

	return {
		notFound: false,
		slug: page.slug,
		title: page.title,
		content: page.content,
		ast,
		categories: cats,
		updatedAt: page.updatedAt,
		wordbookMatch: wordbookMatches[0] || null,
	}
}
