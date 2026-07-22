import { fail, isHttpError, redirect } from '@sveltejs/kit'
import { superValidate, message, type ErrorStatus } from 'sveltekit-superforms'
import { zod4 } from 'sveltekit-superforms/adapters'
import type { Actions, PageServerLoad } from './$types.js'
import { setSessionCookie } from '$lib/server/auth.js'
import { loginUser } from '$lib/server/services/auth.js'
import { loginSchema } from '$lib/auth/form-schemas.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/')
	return { form: await superValidate(zod4(loginSchema)) }
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(loginSchema))
		if (!form.valid) return fail(400, { form })

		let result
		try {
			result = await loginUser({
				username: form.data.username,
				password: form.data.password,
				ip: event.getClientAddress(),
				redirectTo: event.url.searchParams.get('redirect'),
			})
		} catch (error: unknown) {
			if (isHttpError(error)) return message(form, error.body?.message ?? 'Request failed', { status: error.status as ErrorStatus })
			throw error
		}

		setSessionCookie(event, result.token)
		throw redirect(302, result.redirectTo)
	},
}
