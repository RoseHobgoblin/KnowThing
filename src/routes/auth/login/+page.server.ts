import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { verifyCredentials, createSession, setSessionCookie } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
}

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData()
		const username = formData.get('username')?.toString()?.trim()
		const password = formData.get('password')?.toString()

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required', username })
		}

		const user = await verifyCredentials(username, password)
		if (!user) {
			return fail(401, { error: 'Invalid username or password', username })
		}

		const token = await createSession(user.id)
		setSessionCookie(event, token)

		throw redirect(302, '/')
	},
}
