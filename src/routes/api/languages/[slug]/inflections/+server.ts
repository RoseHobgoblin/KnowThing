import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { handleServiceCall } from '$lib/server/utils.js'
import { getInflectionsForLanguage } from '$lib/feature/wordbook/server/inflections.server.js'

/** GET /api/languages/:slug/inflections — all dimensions + classes for a language */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getInflectionsForLanguage(params.slug)))
}
