import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole } from '$lib/server/auth.js'
import { createRegistrationCode } from '$lib/server/services/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { createRegistrationCodeSchema } from '$lib/server/http/auth/schemas.js'

/** POST /api/registration-codes — generate a new invite code */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'admin')

	const data = await parseBody(event.request, createRegistrationCodeSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		const code = await createRegistrationCode({
			createdBy: user.id,
			role: data.role,
			expiresInHours: data.expiresInHours,
			creatorRole: user.role,
		})
		return json({ code }, { status: 201 })
	})
}
