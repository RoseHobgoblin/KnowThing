import { sequence } from '@sveltejs/kit/hooks'
import type { Handle } from '@sveltejs/kit'
import { building } from '$app/environment'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { auth, authTrustedOrigins } from '$lib/server/better-auth.js'
import { toAuthUser } from '$lib/server/auth.js'
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

const rateLimit: Handle = async ({ event, resolve }) => {
	const isWrite = event.request.method !== 'GET' && event.request.method !== 'HEAD'
	const shouldLimit = isWrite || event.url.pathname.startsWith('/api/')
	const isCredentialSubmission = isWrite && (
		event.url.pathname === '/auth/login'
		|| event.url.pathname === '/auth/register'
	)
	const allowed = !shouldLimit || await checkRateLimit(
		event.getClientAddress(),
		isWrite,
		isCredentialSubmission ? { scope: 'credentials', limit: 5 } : undefined,
	)
	if (!allowed) {
		return new Response('Too many requests', { status: 429 })
	}
	return resolve(event)
}

const betterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers })
	event.locals.user = session ? toAuthUser(session.user) : null

	return svelteKitHandler({ event, resolve, auth, building })
}

// Locale is resolved client-side from localStorage (see `$lib/i18n.svelte.ts`),
// so there's no Paraglide server middleware here — SSR renders the base locale
// and the client applies the stored one after mount.
export const handle = sequence(canonicalizeUrl, verifyRequestOrigin, rateLimit, betterAuth)
