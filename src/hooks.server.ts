import type { Handle } from '@sveltejs/kit'
import { getSessionToken, resolveSession } from '$lib/server/auth.js'
import { checkRateLimit } from '$lib/server/rate-limit.js'

export const handle: Handle = async ({ event, resolve }) => {
	// Rate limiting
	const ip = event.getClientAddress()
	const isWrite = event.request.method !== 'GET' && event.request.method !== 'HEAD'
	if (!checkRateLimit(ip, isWrite)) {
		return new Response('Too many requests', { status: 429 })
	}

	// Session resolution
	const token = getSessionToken(event)
	if (token) {
		event.locals.user = await resolveSession(token)
	} else {
		event.locals.user = null
	}

	return resolve(event)
}
