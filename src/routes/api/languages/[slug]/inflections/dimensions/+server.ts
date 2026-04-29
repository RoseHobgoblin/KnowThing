import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createDimensionSchema } from '$lib/server/http/languages/schemas.js'
import { createDimension } from '$lib/server/services/inflections.js'

/** POST /api/languages/:slug/inflections/dimensions — add a dimension */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createDimensionSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createDimension(event.params.slug, data), { status: 201 }))
}
