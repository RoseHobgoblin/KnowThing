import { redirect } from '@sveltejs/kit'
import type { Actions } from './$types.js'
import { getSessionToken, clearSessionCookie } from '$lib/server/auth.js'
import { logoutSession } from '$lib/server/services/auth.js'

export const actions: Actions = {
	default: async (event) => {
		const token = getSessionToken(event)
		await logoutSession(token)
		clearSessionCookie(event)
		throw redirect(302, '/')
	},
}
