import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createCelestialFromPreset } from '$lib/server/services/celestial-bodies.js'

const seedPresetSchema = z.object({ preset: z.string().min(1) })

/**
 * POST /api/celestial/preset — seed a whole preset system (system, stars,
 * bodies, moons) in one transaction. Body: { preset: <preset label> }.
 */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'editor')

	const data = await parseBody(event.request, seedPresetSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const created = await createCelestialFromPreset(data.preset)
		return json(created, { status: 201 })
	})
}
