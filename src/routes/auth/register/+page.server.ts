import { fail, isHttpError, redirect } from '@sveltejs/kit'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { setSessionCookie } from '$lib/server/auth.js'
import { db } from '$lib/server/db/index.js'
import { users } from '$lib/server/db/schema.js'
import { registerUser } from '$lib/server/services/auth.js'

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

		try {
			const result = await registerUser({ username, password, code })
			setSessionCookie(event, result.token)
		} catch (error: unknown) {
			if (isHttpError(error)) {
				return fail(error.status, { error: error.body?.message ?? error.message, username })
			}
			const message = error instanceof Error ? error.message : 'Unknown error'
			if (message.includes('Registration code was just used')) {
				return fail(409, { error: message, username })
			}
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'Username already taken', username })
			}
			console.error('register failed', error)
			return fail(500, { error: 'Registration failed', username })
		}

		throw redirect(302, '/')
	},
}
