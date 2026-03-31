import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { parseUnifiedSearchParams } from '$lib/server/services/search/query.js'
import { searchUnified } from '$lib/server/services/search/index.js'

/** GET /api/search?q=...&scope=all|pages|wordbook|media — unified search */
export const GET: RequestHandler = async ({ url }) => {
	const params = parseUnifiedSearchParams(url, { scope: 'all', limit: 20, offset: 0 })
	return json(await searchUnified(params))
}
