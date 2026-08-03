import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { auth } from '$lib/server/better-auth.js'
import { sanitizeRedirectTarget, upgradeLegacyPassword } from '$lib/server/services/auth.js'

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
			await auth.api.signInUsername({
				body: { username, password },
				headers: event.request.headers,
			})
			await upgradeLegacyPassword(username, password)
		} catch (error: unknown) {
			if (error instanceof APIError) {
				return fail(error.statusCode, { error: error.message, username })
			}
			throw error
		}

		throw redirect(302, sanitizeRedirectTarget(event.url.searchParams.get('redirect')))
	},
}
