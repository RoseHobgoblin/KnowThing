import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireAuth } from '$lib/server/auth.js'
import { auth } from '$lib/server/better-auth.js'
import { deleteOwnAccount, revokeAllUserSessions } from '$lib/server/services/auth.js'
import { parseBody, handleServiceCall } from '$lib/server/utils.js'
import { changePasswordSchema } from '$lib/server/http/account/schemas.js'

/** PUT /api/account — change password */
export const PUT: RequestHandler = async (event) => {
	const user = requireAuth(event)

	const data = await parseBody(event.request, changePasswordSchema)
	if (data instanceof Response) return data

	return handleServiceCall(async () => {
		await auth.api.changePassword({
			body: {
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
				revokeOtherSessions: true,
			},
			headers: event.request.headers,
		})
		await auth.api.signOut({ headers: event.request.headers })
		await revokeAllUserSessions(user.id)
		return json({ success: true, message: 'Password changed. Please log in again.' })
	})
}

/** DELETE /api/account — delete own account */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event)

	return handleServiceCall(async () => {
		await auth.api.signOut({ headers: event.request.headers })
		await deleteOwnAccount(user)
		return json({ success: true })
	})
}
