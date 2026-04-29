import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateLanguageSchema } from '$lib/server/http/languages/schemas.js'
import { getLanguageBySlug, updateLanguage } from '$lib/server/services/languages.js'

/** GET /api/languages/:slug — with inherited family from ancestors */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getLanguageBySlug(params.slug)))
}

/** PUT /api/languages/:slug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, updateLanguageSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateLanguage(event.params.slug, data)))
}
