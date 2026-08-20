import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { updateCountrySchema } from '$lib/feature/worldmap/schema.js'
import { deleteCountry, getCountryBySlug, updateCountry } from '$lib/feature/worldmap/server/countries.server.js'

export const GET: RequestHandler = async ({ params }) => {
	return handleServiceCall(async () => json(await getCountryBySlug(params.slug)))
}

export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, updateCountrySchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await updateCountry(event.params.slug, data)))
}

export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	return handleServiceCall(async () => json(await deleteCountry(event.params.slug)))
}
