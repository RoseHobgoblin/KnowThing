import type { Handle } from '@sveltejs/kit';
import { getSessionToken, resolveSession } from '$lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	const token = getSessionToken(event);
	if (token) {
		event.locals.user = await resolveSession(token);
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
