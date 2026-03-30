import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireRole, generateRegistrationCode } from '$lib/server/auth.js'
import { z } from 'zod'

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

	// Only owners can create admin codes
	if (parsed.data.role === 'admin' && user.role !== 'owner') {
		return json({ error: 'Only the owner can create admin invite codes' }, { status: 403 })
	}

	const code = await generateRegistrationCode(user.id, parsed.data.role, parsed.data.expiresInHours)

	return json({ code }, { status: 201 })
}
