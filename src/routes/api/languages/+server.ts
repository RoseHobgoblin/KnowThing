import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createLanguageSchema } from '$lib/feature/wordbook/server/language-schemas.server.js'
import { createLanguage, listLanguages } from '$lib/feature/wordbook/server/languages.server.js'

/** GET /api/languages — list all languages with word counts, inheriting family from ancestors */
export const GET: RequestHandler = async () => {
	return json(await listLanguages())
}

/** POST /api/languages — create a language */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, createLanguageSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createLanguage(data), { status: 201 }))
}
