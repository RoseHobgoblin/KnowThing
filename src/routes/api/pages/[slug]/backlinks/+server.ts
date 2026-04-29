import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { getBacklinks } from '$lib/server/services/pages.js'

/** GET /api/pages/:slug/backlinks — content that links to this page */
export const GET: RequestHandler = async ({ params }) => {
	return json(await getBacklinks(params.slug))
}
