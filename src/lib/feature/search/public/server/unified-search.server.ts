import type { SearchProvider, UnifiedSearchParams, UnifiedSearchResponse, UnifiedSearchResult } from '../search-contracts.js'

const SCOPES = ['pages', 'wordbook', 'media'] as const

export async function searchUnified(params: UnifiedSearchParams, providers: ReadonlyMap<string, SearchProvider>): Promise<UnifiedSearchResponse> {
	if (!params.q) return response(params, [], { pages: 0, wordbook: 0, media: 0 }, 0)
	if (params.scope !== 'all') {
		const provider = providers.get(params.scope)
		if (!provider) return response(params, [], { pages: 0, wordbook: 0, media: 0 }, 0)
		const [results, total] = await Promise.all([safe(() => provider.search(params), []), safe(() => provider.count(params), 0)])
		return response(params, results, { pages: 0, wordbook: 0, media: 0, [params.scope]: total }, total)
	}

	const fetchLimit = Math.max(params.offset + params.limit, 24)
	const query = { ...params, limit: fetchLimit, offset: 0 }
	const resolved = await Promise.all(SCOPES.map(async (scope) => {
		const provider = providers.get(scope)
		if (!provider) return { scope, results: [] as UnifiedSearchResult[], count: 0 }
		const [results, count] = await Promise.all([safe(() => provider.search(query), []), safe(() => provider.count(query), 0)])
		return { scope, results, count }
	}))
	const counts = { pages: 0, wordbook: 0, media: 0 }
	const byHref = new Map<string, UnifiedSearchResult>()
	let duplicates = 0
	for (const providerResult of resolved) {
		counts[providerResult.scope] = providerResult.count
		for (const result of providerResult.results) {
			const key = result.href.toLowerCase()
			const existing = byHref.get(key)
			if (existing) {
				duplicates++
				existing.rank = Math.max(existing.rank, result.rank)
			} else {
				byHref.set(key, result)
			}
		}
	}
	const merged = [...byHref.values()].toSorted((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
	const total = Math.max(merged.length, counts.pages + counts.wordbook + counts.media - duplicates)
	return response(params, merged.slice(params.offset, params.offset + params.limit), counts, total)
}

async function safe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await operation()
	} catch {
		return fallback
	}
}

function response(query: UnifiedSearchParams, results: UnifiedSearchResult[], countsByScope: Record<'pages' | 'wordbook' | 'media', number>, totalResults: number): UnifiedSearchResponse {
	const page = Math.floor(query.offset / query.limit) + 1
	const totalPages = Math.max(1, Math.ceil(totalResults / query.limit))
	return {
		query, results, countsByScope,
		pagination: { page, pageSize: query.limit, totalResults, totalPages, hasPreviousPage: page > 1, hasNextPage: query.offset + query.limit < totalResults },
	}
}
