import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { verifyCredentials, createSession, setSessionCookie } from '$lib/server/auth.js'

const loginSchema = z.object({
	username: z.string().min(1, 'Username is required'),
	password: z.string().min(1, 'Password is required'),
})

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
}

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData()
		const parsed = loginSchema.safeParse({
			username: formData.get('username')?.toString()?.trim(),
			password: formData.get('password')?.toString(),
		})
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, username: formData.get('username')?.toString()?.trim() })
		}
		const { username, password } = parsed.data

		const user = await verifyCredentials(username, password)
		if (!user) {
			return fail(401, { error: 'Invalid username or password', username })
		}

		const token = await createSession(user.id)
		setSessionCookie(event, token)

		throw redirect(302, '/')
	},
}
