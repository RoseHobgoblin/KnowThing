import { redirect } from '@sveltejs/kit'
import type { Actions } from './$types.js'
import { auth } from '$lib/server/better-auth.js'

export const actions: Actions = {
	default: async (event) => {
		await auth.api.signOut({ headers: event.request.headers })
		throw redirect(302, '/')
	},
}
