import type { PageServerLoad } from './$types.js'
import { asc } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import { searchWordbook } from '$lib/server/services/wordbook-search.js'

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() || ''
	const language = url.searchParams.get('language') || ''
	const tag = url.searchParams.get('tag') || ''
	const pos = url.searchParams.get('pos') || ''

	const results = q || tag || language || pos
		? await searchWordbook({ query: q, language, tag, pos, limit: 100 })
		: []

	const langs = await db
		.select({ name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name))

	return { results, query: q, language, tag, pos, languages: langs }
}
