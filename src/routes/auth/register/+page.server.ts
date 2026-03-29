import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { createUser, createSession, setSessionCookie } from '$lib/server/auth.js'

const registerSchema = z.object({
	username: z.string().min(3, 'Username must be at least 3 characters'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	confirm: z.string(),
})

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
}

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData()
		const parsed = registerSchema.safeParse({
			username: formData.get('username')?.toString()?.trim(),
			password: formData.get('password')?.toString(),
			confirm: formData.get('confirm')?.toString(),
		})
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, username: formData.get('username')?.toString()?.trim() })
		}
		const { username, password, confirm } = parsed.data

		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match', username })
		}

		try {
			const user = await createUser(username, password)
			const token = await createSession(user.id)
			setSessionCookie(event, token)
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
