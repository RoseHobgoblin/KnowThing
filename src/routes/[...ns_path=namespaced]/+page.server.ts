import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { splitNamespaceTarget, type NamespaceKey } from '$lib/namespaces/registry.js'

/**
 * Phase 3 catch-all for `/Namespace:Identifier` URLs.
 *
 * For now, this route 302-redirects to the legacy route serving each domain
 * (`/celestial/<slug>`, `/calendar/<slug>`, etc.). Phase 4–7 cutovers replace
 * each redirect with a direct-serving loader that reads from the row's `body`
 * field.
 *
 * Wordbook does NOT pass through here — it lives at /Wordbook/Lang/Word
 * (slash-path section, not colon-namespace).
 */
export const load: PageServerLoad = async ({ params }) => {
	const raw = params.ns_path

	// Peel off trailing /edit, /configure, /history, /move so they can be
	// re-attached to the redirect target.
	const trailing = peelTrailingMode(raw)
	const head = trailing ? raw.slice(0, raw.length - trailing.length - 1) : raw

	const split = splitNamespaceTarget(head)
	if (!split) throw error(404, 'Unknown namespace')

	const { ns, identifier } = split
	const suffix = trailing ? `/${trailing}` : ''
	const legacy = legacyHref(ns, identifier)
	if (!legacy) throw error(404, `${ns} pages don't have a legacy route yet — added in a later phase.`)

	throw redirect(302, `${legacy}${suffix}`)
}

const TRAILING_MODES = new Set(['edit', 'configure', 'history', 'move'])

function peelTrailingMode(path: string): string | null {
	const last = path.split('/').at(-1)
	if (last && TRAILING_MODES.has(last.toLowerCase())) return last
	return null
}

/**
 * Map a (Namespace, Identifier) pair to its existing legacy URL. Returns null
 * for namespaces that don't have a legacy route (Category, Country, Map,
 * CarveCraft) — those serve here directly once their cutover phase lands.
 */
function legacyHref(ns: NamespaceKey, identifier: string): string | null {
	const safe = encodeURI(identifier).replaceAll('%2F', '/')
	switch (ns) {
		case 'Celestial': return `/celestial/${safe}`
		case 'Calendar':  return `/calendar/${safe}`
		case 'Map':       return `/worldmap/${safe}`
		case 'Country':   return null // No top-level /countries route exists.
		case 'Category':  return null // Phase 7 wires this up.
		case 'CarveCraft': return null // Phase 8 greenfield.
		case 'Template':  return `/know/Template:${safe}`
		case 'File':
		case 'Image':     return `/media/${safe}`
		case 'Special':   return `/special/${safe}`
	}
}
