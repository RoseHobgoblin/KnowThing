import type { PageServerLoad } from './$types.js'
import { searchContent } from '$lib/server/services/search.js'

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() || ''

	if (!q) return { query: '', results: [] }

	const results = await searchContent(q, {
		limit: 50,
		headlineMaxWords: 50,
		headlineMinWords: 25,
	})

	return { query: q, results }
}
