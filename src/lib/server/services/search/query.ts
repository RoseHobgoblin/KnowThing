import type { UnifiedSearchFilters, UnifiedSearchParams, UnifiedSearchScope, UnifiedSearchSort } from './types.js'

const validScopes = new Set<UnifiedSearchScope>(['all', 'pages', 'wordbook', 'media'])
const validSorts = new Set<UnifiedSearchSort>(['relevance', 'newest', 'oldest', 'name', 'size', 'usage'])

export function parseUnifiedSearchParams(url: URL, defaults?: Partial<UnifiedSearchParams>): UnifiedSearchParams {
	const scopeValue = url.searchParams.get('scope')?.trim() ?? defaults?.scope ?? 'all'
	const sortValue = url.searchParams.get('sort')?.trim()
	const limit = clampInt(url.searchParams.get('limit'), defaults?.limit ?? 20, 1, 100)
	const page = clampInt(url.searchParams.get('page'), 1, 1, 1000)
	const explicitOffset = url.searchParams.get('offset')
	const offset = explicitOffset != null
		? clampInt(explicitOffset, defaults?.offset ?? 0, 0, 10_000)
		: (page - 1) * limit

	const filters: UnifiedSearchFilters = {
		language: normalizeString(url.searchParams.get('language')),
		tag: normalizeString(url.searchParams.get('tag')),
		pos: normalizeString(url.searchParams.get('pos')),
		mediaCategory: normalizeString(url.searchParams.get('mediaCategory') ?? url.searchParams.get('category')),
		unused: url.searchParams.get('unused') === 'true',
		sort: validSorts.has(sortValue as UnifiedSearchSort) ? sortValue as UnifiedSearchSort : undefined,
	}

	return {
		q: normalizeString(url.searchParams.get('q')) ?? defaults?.q ?? '',
		scope: validScopes.has(scopeValue as UnifiedSearchScope) ? scopeValue as UnifiedSearchScope : 'all',
		filters,
		limit,
		offset,
	}
}

function normalizeString(value: string | null | undefined) {
	const trimmed = value?.trim()
	return trimmed ? trimmed : undefined
}

function clampInt(value: string | null | undefined, fallback: number, min: number, max: number) {
	const parsed = Number.parseInt(value ?? '', 10)
	if (Number.isNaN(parsed)) return fallback
	return Math.min(Math.max(parsed, min), max)
}
