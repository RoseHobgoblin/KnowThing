export type UnifiedSearchScope = 'all' | 'pages' | 'wordbook' | 'media'

export type UnifiedSearchSort = 'relevance' | 'newest' | 'oldest' | 'name' | 'size' | 'usage'

export interface UnifiedSearchFilters {
	language?: string
	tag?: string
	pos?: string
	mediaCategory?: string
	unused?: boolean
	sort?: UnifiedSearchSort
}

export interface UnifiedSearchParams {
	q: string
	scope: UnifiedSearchScope
	filters: UnifiedSearchFilters
	limit: number
	offset: number
}

export interface UnifiedSearchResult {
	kind: 'page' | 'word' | 'media'
	title: string
	href: string
	badge: 'Page' | 'Word' | 'Media'
	snippet: string
	meta: string[]
	rank: number
	thumbnailUrl?: string
}

export interface UnifiedSearchResponse {
	query: UnifiedSearchParams
	results: UnifiedSearchResult[]
	countsByScope: Record<'pages' | 'wordbook' | 'media', number>
	pagination: {
		page: number
		pageSize: number
		totalResults: number
		totalPages: number
		hasPreviousPage: boolean
		hasNextPage: boolean
	}
}

export type SearchQuery = UnifiedSearchParams
export type SearchResult = UnifiedSearchResult

export interface SearchProvider {
	scope: Exclude<UnifiedSearchScope, 'all'>
	search(query: SearchQuery): Promise<SearchResult[]>
	count(query: SearchQuery): Promise<number>
}
