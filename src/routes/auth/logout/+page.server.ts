import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { getSessionToken, deleteSession, clearSessionCookie } from '$lib/server/auth.js';

export const actions: Actions = {
	default: async (event) => {
		const token = getSessionToken(event);
		if (token) {
			await deleteSession(token);
			clearSessionCookie(event);
		}
		throw redirect(302, '/');
	}
};
