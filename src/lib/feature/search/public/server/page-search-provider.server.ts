import { buildHref } from '$lib/server/resolved-links.js'
import type { SearchProvider } from '../search-contracts.js'
import { countPageSearchResults, searchPagesRaw } from './pages.server.js'

export const pageSearchProvider: SearchProvider = {
	scope: 'pages',
	async search(query) {
		const results = await searchPagesRaw(query.q, { limit: query.limit, offset: query.offset, headlineMaxWords: 40, headlineMinWords: 20 })
		return results.map((result) => {
			const slug = result.domain === 'wordbook' && result.parentPath ? `${result.parentPath}/${result.slug}` : result.slug
			return {
				kind: 'page' as const, title: result.title,
				href: buildHref(result.domain, slug, result.domain === 'wordbook' ? null : result.parentPath),
				badge: 'Page' as const, snippet: String(result.snippet ?? ''), meta: [domainLabel(result.domain)],
				rank: normalizeRank(result.title, query.q, Number(result.rank)),
			}
		})
	},
	count(query) { return countPageSearchResults(query.q) },
}

function domainLabel(domain: string) {
	return ({ know: 'Wiki', wordbook: 'Wordbook', calendar: 'Calendar', rodder: 'Rodder' } as Record<string, string>)[domain] ?? domain
}

function normalizeRank(title: string, query: string, rank: number) {
	const normalizedTitle = title.toLowerCase()
	const normalizedQuery = query.toLowerCase()
	if (normalizedTitle === normalizedQuery) return 1200 + rank * 10
	if (normalizedTitle.startsWith(normalizedQuery)) return 950 + rank * 10
	if (normalizedTitle.includes(normalizedQuery)) return 800 + rank * 10
	return 500 + rank * 10
}
