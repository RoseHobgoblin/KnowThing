import type { Reroute } from '@sveltejs/kit'

/**
 * Universal reroute hook (runs both server- and client-side, BEFORE routing).
 *
 * The Wordbook section's canonical URL is TitleCase `/Wordbook/...`, but the
 * route filesystem lives at lowercase `src/routes/wordbook/`. On Linux prod,
 * SvelteKit's routing is case-sensitive and would 404 on `/Wordbook/...` —
 * this rewrite makes incoming TitleCase requests match the lowercase route
 * without changing the URL the browser sees.
 *
 * The complementary `handle` hook in `hooks.server.ts` 308-redirects legacy
 * lowercase `/wordbook/...` requests to the TitleCase canonical URL.
 */
export const reroute: Reroute = ({ url }) => {
	if (url.pathname === '/Wordbook' || url.pathname.startsWith('/Wordbook/')) {
		return '/wordbook' + url.pathname.slice('/Wordbook'.length)
	}
}
