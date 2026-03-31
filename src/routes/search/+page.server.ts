import type { PageServerLoad } from './$types.js'
import { parseUnifiedSearchParams } from '$lib/server/services/search/query.js'
import { searchUnified } from '$lib/server/services/search/index.js'
import { loadSearchFilterOptions } from '$lib/server/services/search/options.js'

export const load: PageServerLoad = async ({ url }) => {
	const [search, filterOptions] = await Promise.all([
		searchUnified(parseUnifiedSearchParams(url, { scope: 'all', limit: 50, offset: 0 })),
		loadSearchFilterOptions(),
	])
	return { ...search, filterOptions }
}
