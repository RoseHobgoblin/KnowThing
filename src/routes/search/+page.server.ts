import type { PageServerLoad } from './$types.js'
import { parseUnifiedSearchParams } from '$lib/feature/search/server/query.server.js'
import { searchUnified } from '$lib/feature/search/server/index.server.js'
import { loadSearchFilterOptions } from '$lib/feature/search/server/options.server.js'

export const load: PageServerLoad = async ({ url }) => {
	const [search, filterOptions] = await Promise.all([
		searchUnified(parseUnifiedSearchParams(url, { scope: 'all', limit: 50, offset: 0 })),
		loadSearchFilterOptions(),
	])
	return { ...search, filterOptions }
}
