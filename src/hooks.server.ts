import { sequence } from '@sveltejs/kit/hooks'
import type { Handle } from '@sveltejs/kit'
import { building } from '$app/environment'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { auth, authTrustedOrigins } from '$lib/server/better-auth.js'
import { toAuthUser } from '$lib/server/auth.js'
import { applyRateLimitHeaders, enforceRateLimit, rateLimitedResponse } from '$lib/server/rate-limit.js'
import { normalizeApiErrorResponse } from '$lib/server/http/json-endpoint.js'

/**
 * Canonicalise legacy URLs to their post-namespace-flip forms. Runs first so
 * the redirect happens before any DB lookup.
 *
 *   /wordbook/...  → 308 → /Wordbook/...   (TitleCase canonical)
 *
 * Rodder and calendar legacy URLs are handled by the route loaders in
 * `routes/rodder/[...path]` and `routes/calendar/[...path]` because they
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

/** Protect every cookie-authenticated mutation, including plugin endpoints. */
const verifyRequestOrigin: Handle = async ({ event, resolve }) => {
	const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)
	if (isSafeMethod) return resolve(event)

	const origin = event.request.headers.get('origin')
	const referer = event.request.headers.get('referer')
	const fetchSite = event.request.headers.get('sec-fetch-site')
	let requestOrigin: string | null

	try {
		const originSource = origin ?? referer
		requestOrigin = originSource ? new URL(originSource).origin : null
	} catch {
		return new Response('Invalid request origin', { status: 403 })
	}

	if ((requestOrigin && !authTrustedOrigins.has(requestOrigin)) || fetchSite === 'cross-site') {
		return new Response('Untrusted request origin', { status: 403 })
	}

	return resolve(event)
}

/** Per-client request budgets. Policy lives in `$lib/server/rate-limit.js`. */
const rateLimit: Handle = async ({ event, resolve }) => {
	const decision = await enforceRateLimit(event)
	if (decision && !decision.allowed) return rateLimitedResponse(event, decision)

	const response = await resolve(event)
	if (decision) {
		try {
			applyRateLimitHeaders(response.headers, decision)
		} catch {
			// A route that returns a `fetch()` response verbatim hands back
			// immutable headers. Reporting the budget is a courtesy; losing it
			// is not worth failing the request over.
		}
	}
	return response
}

const betterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers })
	event.locals.user = session ? toAuthUser(session.user) : null

	return svelteKitHandler({ event, resolve, auth, building })
}

const normalizeJsonApiErrors: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)
	return event.url.pathname.startsWith('/api/') ? normalizeApiErrorResponse(response) : response
}

// Locale is resolved client-side from localStorage (see `$lib/i18n.svelte.ts`),
// so there's no Paraglide server middleware here — SSR renders the base locale
// and the client applies the stored one after mount.
// Keep transport normalization outermost so failures produced by security,
// rate-limit, auth, and route handlers all share the same API contract.
export const handle = sequence(normalizeJsonApiErrors, canonicalizeUrl, verifyRequestOrigin, rateLimit, betterAuth)
