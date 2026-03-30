import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { requireAuth, changePassword, deleteUser, deleteSession, getSessionToken, clearSessionCookie } from '$lib/server/auth.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { z } from 'zod'

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

	// Verify current password
	const [dbUser] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, user.id))

	if (!dbUser) return json({ error: 'User not found' }, { status: 404 })

	const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash)
	if (!valid) {
		return json({ error: 'Current password is incorrect' }, { status: 401 })
	}

	await changePassword(user.id, parsed.data.newPassword)

	// Clear current session cookie (user needs to re-login)
	clearSessionCookie(event)

	return json({ success: true, message: 'Password changed. Please log in again.' })
}

/** DELETE /api/account — delete own account */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event)

	// Owner cannot delete themselves
	if (user.role === 'owner') {
		return json({ error: 'The site owner cannot delete their own account' }, { status: 400 })
	}

	await deleteUser(user.id)
	clearSessionCookie(event)

	return json({ success: true })
}
