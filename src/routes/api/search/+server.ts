import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { parseUnifiedSearchParams } from '$lib/feature/search/server/query.server.js'
import { searchUnified } from '$lib/feature/search/server/index.server.js'

/** GET /api/search?q=...&scope=all|pages|wordbook|media — unified search */
export const GET: RequestHandler = async ({ url }) => {
	const params = parseUnifiedSearchParams(url, { scope: 'all', limit: 20, offset: 0 })
	return json(await searchUnified(params))
}
