import { fail, isHttpError, redirect } from '@sveltejs/kit'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { setSessionCookie } from '$lib/server/auth.js'
import { loginUser } from '$lib/server/services/auth.js'

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

		try {
			const result = await loginUser({
				username,
				password,
				ip: event.getClientAddress(),
				redirectTo: event.url.searchParams.get('redirect'),
			})
			setSessionCookie(event, result.token)
			throw redirect(302, result.redirectTo)
		} catch (err: unknown) {
			if (isHttpError(err)) {
				return fail(err.status, { error: err.body?.message ?? err.message, username })
			}
			throw err
		}
	},
}
