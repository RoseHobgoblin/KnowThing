import { fail, isHttpError, redirect } from '@sveltejs/kit'
import { superValidate, message, type ErrorStatus } from 'sveltekit-superforms'
import { zod4 } from 'sveltekit-superforms/adapters'
import type { Actions, PageServerLoad } from './$types.js'
import { setSessionCookie } from '$lib/server/auth.js'
import { hasAnyUser, registerUser } from '$lib/server/services/auth.js'
import { registerSchema } from '$lib/auth/form-schemas.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
	return {
		requireCode: await hasAnyUser(),
		form: await superValidate(zod4(registerSchema)),
	}
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(registerSchema))
		if (!form.valid) return fail(400, { form })

		try {
			const result = await registerUser({
				username: form.data.username,
				password: form.data.password,
				code: form.data.code,
			})
			setSessionCookie(event, result.token)
		} catch (error: unknown) {
			if (isHttpError(error)) return message(form, error.body?.message ?? 'Request failed', { status: error.status as ErrorStatus })
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			if (errorMessage.includes('Registration code was just used')) return message(form, errorMessage, { status: 409 })
			if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) return message(form, 'Username already taken', { status: 409 })
			return message(form, 'Registration failed', { status: 500 })
		}

		throw redirect(302, '/')
	},
}
