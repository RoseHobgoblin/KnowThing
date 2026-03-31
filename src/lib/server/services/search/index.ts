import { countPageSearchResults, searchPagesRaw } from './pages.js'
import { countWordbookSearchResults, searchWordbookEntries } from './wordbook.js'
import { searchMediaUnified } from './media.js'
import type { UnifiedSearchParams, UnifiedSearchResponse, UnifiedSearchResult } from './types.js'

export async function searchUnified(params: UnifiedSearchParams): Promise<UnifiedSearchResponse> {
	if (!params.q) {
		return {
			query: params,
			results: [],
			countsByScope: { pages: 0, wordbook: 0, media: 0 },
			pagination: buildPagination(params.offset, params.limit, 0),
		}
	}

	switch (params.scope) {
		case 'pages': {
			const [pageResults, total] = await Promise.all([
				searchPages(params),
				countPageSearchResults(params.q),
			])
			return {
				query: params,
				results: pageResults,
				countsByScope: { pages: total, wordbook: 0, media: 0 },
				pagination: buildPagination(params.offset, params.limit, total),
			}
		}
		case 'wordbook': {
			const [wordResults, total] = await Promise.all([
				searchWords(params),
				countWordbookSearchResults({
					query: params.q,
					language: params.filters.language,
					tag: params.filters.tag,
					pos: params.filters.pos,
				}),
			])
			return {
				query: params,
				results: wordResults,
				countsByScope: { pages: 0, wordbook: total, media: 0 },
				pagination: buildPagination(params.offset, params.limit, total),
			}
		}
		case 'media': {
			const mediaResults = await searchMedia(params)
			return {
				query: params,
				results: mediaResults.results,
				countsByScope: { pages: 0, wordbook: 0, media: mediaResults.total },
				pagination: buildPagination(params.offset, params.limit, mediaResults.total),
			}
		}
		default: {
			const fetchLimit = Math.max(params.offset + params.limit, 24)
			const [pagesTotal, wordsTotal, mediaResults, pageResults, wordResults] = await Promise.all([
				countPageSearchResults(params.q),
				countWordbookSearchResults({
					query: params.q,
					language: params.filters.language,
					tag: params.filters.tag,
					pos: params.filters.pos,
				}),
				searchMedia({ ...params, limit: fetchLimit, offset: 0 }),
				searchPages({ ...params, limit: fetchLimit, offset: 0 }),
				searchWords({ ...params, limit: fetchLimit, offset: 0 }),
			])
			const merged = [...pageResults, ...wordResults, ...mediaResults.results]
				.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
			const total = pagesTotal + wordsTotal + mediaResults.total

			return {
				query: params,
				results: merged.slice(params.offset, params.offset + params.limit),
				countsByScope: {
					pages: pagesTotal,
					wordbook: wordsTotal,
					media: mediaResults.total,
				},
				pagination: buildPagination(params.offset, params.limit, total),
			}
		}
	}
}

async function searchPages(params: UnifiedSearchParams): Promise<UnifiedSearchResult[]> {
	const results = await searchPagesRaw(params.q, {
		limit: params.limit,
		offset: params.offset,
		headlineMaxWords: 40,
		headlineMinWords: 20,
	})

	return results.map((result) => ({
		kind: 'page',
		title: result.title,
		href: result.domain === 'know'
			? `/know/${result.slug}`
			: result.parentPath
				? `/${result.domain}/${result.parentPath}/${result.slug}`
				: `/${result.domain}/${result.slug}`,
		badge: 'Page',
		snippet: String(result.snippet ?? ''),
		meta: [domainLabel(result.domain)],
		rank: normalizePageRank(result.title, params.q, Number(result.rank)),
	}))
}

async function searchWords(params: UnifiedSearchParams): Promise<UnifiedSearchResult[]> {
	const results = await searchWordbookEntries({
		query: params.q,
		language: params.filters.language,
		tag: params.filters.tag,
		pos: params.filters.pos,
		limit: params.limit,
		offset: params.offset,
	})

	return results.map((result) => ({
		kind: 'word',
		title: result.word,
		href: `/wordbook/${result.languageSlug}/${encodeURIComponent(result.word)}`,
		badge: 'Word',
		snippet: result.definition ?? '',
		meta: [result.languageName, result.partOfSpeech].filter(Boolean) as string[],
		rank: normalizeWordRank(result.word, params.q, result.relevance ?? 1),
	}))
}

async function searchMedia(params: UnifiedSearchParams) {
	return searchMediaUnified({
		q: params.q,
		category: params.filters.mediaCategory,
		unused: params.filters.unused,
		sort: params.filters.sort ?? (params.scope === 'media' ? 'newest' : 'relevance'),
		limit: params.limit,
		offset: params.offset,
	})
}

function domainLabel(domain: string) {
	switch (domain) {
		case 'know':
			return 'Wiki'
		case 'wordbook':
			return 'Wordbook'
		case 'calendar':
			return 'Calendar'
		case 'celestial':
			return 'Celestial'
		default:
			return domain
	}
}

function normalizePageRank(title: string, query: string, rank: number) {
	const normalizedTitle = title.toLowerCase()
	const normalizedQuery = query.toLowerCase()
	if (normalizedTitle === normalizedQuery) return 1200 + rank * 10
	if (normalizedTitle.startsWith(normalizedQuery)) return 950 + rank * 10
	if (normalizedTitle.includes(normalizedQuery)) return 800 + rank * 10
	return 500 + rank * 10
}

function normalizeWordRank(word: string, query: string, relevance: number) {
	const normalizedWord = word.toLowerCase()
	const normalizedQuery = query.toLowerCase()
	if (normalizedWord === normalizedQuery) return 1600 + relevance * 20
	if (normalizedWord.startsWith(normalizedQuery)) return 1350 + relevance * 20
	return 1000 + relevance * 20
}

function buildPagination(offset: number, limit: number, totalResults: number) {
	const page = Math.floor(offset / limit) + 1
	const totalPages = Math.max(1, Math.ceil(totalResults / limit))

	return {
		page,
		pageSize: limit,
		totalResults,
		totalPages,
		hasPreviousPage: page > 1,
		hasNextPage: offset + limit < totalResults,
	}
}
