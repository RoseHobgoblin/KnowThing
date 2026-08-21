import type { PageServerLoad } from './$types.js'
import { parseUnifiedSearchParams } from '$lib/feature/search/public/server/query.server.js'
import { searchUnified } from '$lib/feature/search/public/server/unified-search.server.js'
import { SEARCH_PROVIDERS } from '$lib/composition/search-providers.server.js'
import { loadSearchFilterOptions } from '$lib/feature/search/public/server/options.server.js'

export const load: PageServerLoad = async ({ url }) => {
	const [search, filterOptions] = await Promise.all([
		searchUnified(parseUnifiedSearchParams(url, { scope: 'all', limit: 50, offset: 0 }), SEARCH_PROVIDERS),
		loadSearchFilterOptions(),
	])
	return { ...search, filterOptions }
}
