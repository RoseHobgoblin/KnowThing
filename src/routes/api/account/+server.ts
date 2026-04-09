import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireAuth, clearSessionCookie } from '$lib/server/auth.js'
import { z } from 'zod'
import { changeOwnPassword, deleteOwnAccount } from '$lib/server/services/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

/** PUT /api/account — change password */
export const PUT: RequestHandler = async (event) => {
	const user = requireAuth(event)

	const data = await parseBody(event.request, changePasswordSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		await changeOwnPassword({
			userId: user.id,
			currentPassword: data.currentPassword,
			newPassword: data.newPassword,
		})
		clearSessionCookie(event)
		return json({ success: true, message: 'Password changed. Please log in again.' })
	})
}

/** DELETE /api/account — delete own account */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event)

	return handleServiceCall(async () => {
		await deleteOwnAccount(user)
		clearSessionCookie(event)
		return json({ success: true })
	})
}
