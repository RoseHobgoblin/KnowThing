import { requestJson } from '$lib/transport/json.js'
import type { UnifiedSearchResponse } from './search-contracts.js'

export function searchSuggestions(query: string, limit = 8) {
	return requestJson<UnifiedSearchResponse>('GET', `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

export function searchPageSuggestions(query: string, limit = 8) {
	return requestJson<UnifiedSearchResponse>('GET', `/api/search?q=${encodeURIComponent(query)}&scope=pages&limit=${limit}`)
}
