import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireAuth, clearSessionCookie } from '$lib/server/auth.js'
import { z } from 'zod'
import { changeOwnPassword, deleteOwnAccount } from '$lib/server/services/auth.js'

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

/** PUT /api/account — change password */
export const PUT: RequestHandler = async (event) => {
	const user = requireAuth(event)

	const body = await event.request.json()
	const parsed = changePasswordSchema.safeParse(body)
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 })
	}

	try {
		await changeOwnPassword({
			userId: user.id,
			currentPassword: parsed.data.currentPassword,
			newPassword: parsed.data.newPassword,
		})
		clearSessionCookie(event)
		return json({ success: true, message: 'Password changed. Please log in again.' })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? 'Request failed' }, { status: err.status })
		}
		throw err
	}
}

/** DELETE /api/account — delete own account */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event)

	try {
		await deleteOwnAccount(user)
		clearSessionCookie(event)
		return json({ success: true })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? 'Request failed' }, { status: err.status })
		}
		throw err
	}
}
