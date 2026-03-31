import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { z } from 'zod'
import { createRegistrationCode } from '$lib/server/services/auth.js'

const createCodeSchema = z.object({
	role: z.enum(['viewer', 'editor', 'admin']).default('editor'),
	expiresInHours: z.number().positive().optional(),
})

/** POST /api/registration-codes — generate a new invite code */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'admin')

	const body = await event.request.json()
	const parsed = createCodeSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	try {
		const code = await createRegistrationCode({
			createdBy: user.id,
			role: parsed.data.role,
			expiresInHours: parsed.data.expiresInHours,
			creatorRole: user.role,
		})
		return json({ code }, { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? err.message }, { status: err.status })
		}
		throw err
	}
}
