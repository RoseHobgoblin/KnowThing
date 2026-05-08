import { sequence } from '@sveltejs/kit/hooks'
import type { Handle } from '@sveltejs/kit'
import { getSessionToken, resolveSession } from '$lib/server/auth.js'
import { checkRateLimit } from '$lib/server/rate-limit.js'

/**
 * Canonicalise legacy URLs to their post-namespace-flip forms. Runs first so
 * the redirect happens before any DB lookup.
 *
 *   /wordbook/...  → 308 → /Wordbook/...   (TitleCase canonical)
 *
 * Celestial and calendar legacy URLs are handled by the route loaders in
 * `routes/celestial/[...path]` and `routes/calendar/[...path]` because they
 * need to resolve the input slug to its canonical form first.
 */
const canonicalizeUrl: Handle = async ({ event, resolve }) => {
	const p = event.url.pathname
	if (p === '/wordbook' || p.startsWith('/wordbook/')) {
		const target = '/Wordbook' + p.slice('/wordbook'.length) + event.url.search
		return new Response(null, { status: 308, headers: { location: target } })
	}
	return resolve(event)
}

const rateLimitAndAuth: Handle = async ({ event, resolve }) => {
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

export const handle = sequence(canonicalizeUrl, rateLimitAndAuth)
