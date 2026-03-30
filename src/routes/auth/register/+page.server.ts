import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { createUser, createSession, setSessionCookie, consumeRegistrationCode, deleteUser } from '$lib/server/auth.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'

const registerSchema = z.object({
	username: z.string().min(3, 'Username must be at least 3 characters'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	confirm: z.string(),
	code: z.string().optional(),
})

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')

	// Check if any users exist — first user doesn't need a code
	const existing = await db.select({ id: users.id }).from(users).limit(1)
	return { requireCode: existing.length > 0 }
}

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData()
		const parsed = registerSchema.safeParse({
			username: formData.get('username')?.toString()?.trim(),
			password: formData.get('password')?.toString(),
			confirm: formData.get('confirm')?.toString(),
			code: formData.get('code')?.toString()?.trim(),
		})
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, username: formData.get('username')?.toString()?.trim() })
		}
		const { username, password, confirm, code } = parsed.data

		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match', username })
		}

		const existing = await db.select({ id: users.id }).from(users).limit(1)
		const isFirstUser = existing.length === 0

		try {
			if (isFirstUser) {
				const user = await createUser(username, password, 'owner')
				const token = await createSession(user.id)
				setSessionCookie(event, token)
			} else {
				if (!code) {
					return fail(400, { error: 'Registration code is required', username })
				}

				const user = await createUser(username, password, 'editor')
				const grantedRole = await consumeRegistrationCode(code, user.id)

				if (!grantedRole) {
					await deleteUser(user.id)
					return fail(400, { error: 'Invalid or expired registration code', username })
				}

				if (grantedRole !== 'editor') {
					await db.update(users).set({ role: grantedRole }).where(eq(users.id, user.id))
				}

				const token = await createSession(user.id)
				setSessionCookie(event, token)
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'Username already taken', username })
			}
			return fail(500, { error: 'Registration failed', username })
		}

		throw redirect(302, '/')
	},
}
