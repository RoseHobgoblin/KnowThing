import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateDialectSchema } from '$lib/feature/wordbook/public/server/language-schemas.server.js'
import { deleteDialect, updateDialect } from '$lib/feature/wordbook/public/server/dialects.server.js'

/** PUT /api/languages/:slug/dialects/:dialectSlug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateDialectSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () =>
		json(await updateDialect(event.params.slug, event.params.dialectSlug, data)),
	)
}

/** DELETE /api/languages/:slug/dialects/:dialectSlug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () =>
		json(await deleteDialect(event.params.slug, event.params.dialectSlug)),
	)
}
