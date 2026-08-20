import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateLanguageSchema } from '$lib/feature/wordbook/server/language-schemas.server.js'
import { deleteLanguage, getLanguageBySlug, updateLanguage } from '$lib/feature/wordbook/server/languages.server.js'

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

/** DELETE /api/languages/:slug — refuses while entries or descendants exist */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteLanguage(event.params.slug)))
}
