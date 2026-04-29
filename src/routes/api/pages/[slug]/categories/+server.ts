import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { getCategories } from '$lib/server/services/pages.js'

/** GET /api/pages/:slug/categories?domain=know */
export const GET: RequestHandler = async ({ params, url }) => {
	const domain = url.searchParams.get('domain') || 'know'
	return json(await getCategories(domain, params.slug))
}
