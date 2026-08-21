import { mediaSearchProvider } from '$lib/feature/media/public/server/search.server.js'
import { pageSearchProvider } from '$lib/feature/search/public/server/page-search-provider.server.js'
import type { SearchProvider } from '$lib/feature/search/public/search-contracts.js'
import { wordbookSearchProvider } from '$lib/feature/wordbook/public/server/search.server.js'
import { createScopedProviderMap } from './provider-map.js'

export const SEARCH_PROVIDERS: ReadonlyMap<string, SearchProvider> = createScopedProviderMap([
	pageSearchProvider,
	wordbookSearchProvider,
	mediaSearchProvider,
])
