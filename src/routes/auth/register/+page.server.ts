import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { createUser, createSession, setSessionCookie } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
}

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData()
		const username = formData.get('username')?.toString()?.trim()
		const password = formData.get('password')?.toString()
		const confirm = formData.get('confirm')?.toString()

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required', username })
		}

		if (username.length < 3) {
			return fail(400, { error: 'Username must be at least 3 characters', username })
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', username })
		}

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
