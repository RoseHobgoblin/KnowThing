import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createDialectSchema } from '$lib/server/http/languages/schemas.js'
import { createDialect, listDialects } from '$lib/server/services/dialects.js'

/** GET /api/languages/:slug/dialects */
export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await listDialects(params.slug)))
}

/** POST /api/languages/:slug/dialects */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createDialectSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createDialect(event.params.slug, data), { status: 201 }))
}
