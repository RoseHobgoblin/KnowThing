import { fail, isHttpError, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types.js'
import { auth } from '$lib/server/better-auth.js'
import { hasAnyUser, registerUser } from '$lib/server/services/auth.js'
import { refundCredentialAttempt, spendCredentialAttempt } from '$lib/server/rate-limit.js'

const registerSchema = z.object({
	username: z.string()
		.min(3, 'Username must be at least 3 characters')
		.max(64, 'Username must be at most 64 characters')
		.regex(/^[^@\s]+$/u, 'Username cannot contain spaces or @'),
	password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
	confirm: z.string(),
	code: z.string().optional(),
})

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
	return { requireCode: await hasAnyUser() }
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

		// Registration codes are guessable in principle, so attempts are metered
		// from the same budget as sign-in.
		const limited = await spendCredentialAttempt(event)
		if (limited) return fail(429, { error: limited, username })

		try {
			await registerUser({ username, password, code })
			await auth.api.signInUsername({
				body: { username, password },
				headers: event.request.headers,
			})
			await refundCredentialAttempt(event)
		} catch (error: unknown) {
			if (isHttpError(error)) {
				return fail(error.status, { error: error.body?.message ?? 'Request failed', username })
			}
			if (error instanceof APIError) {
				return fail(error.statusCode, { error: error.message, username })
			}
			const message = error instanceof Error ? error.message : 'Unknown error'
			if (message.includes('Registration code was just used')) {
				return fail(409, { error: message, username })
			}
			if (message.includes('unique') || message.includes('duplicate')) {
				return fail(409, { error: 'Username already taken', username })
			}
			// eslint-disable-next-line local/no-console-server -- preserve the private server-side cause
			console.error('register failed', error)
			return fail(500, { error: 'Registration failed', username })
		}

		throw redirect(302, '/')
	},
}
