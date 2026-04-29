import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createCountrySchema } from '$lib/worldmap/schema.js'
import { createCountry, listCountries } from '$lib/server/services/countries.js'

export const GET: RequestHandler = async () => {
	return json(await listCountries())
}

export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const data = await parseBody(event.request, createCountrySchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => json(await createCountry(data), { status: 201 }))
}
