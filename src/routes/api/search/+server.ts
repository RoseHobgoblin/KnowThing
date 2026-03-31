import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { searchContent } from '$lib/server/services/search.js'

/** GET /api/search?q=...&limit=20 — full-text search across all content */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '20'), 100)

	if (!q) {
		return json([])
	}

	const result = await searchContent(q, {
		limit,
		headlineMaxWords: 40,
		headlineMinWords: 20,
	})

	return json(result)
}
