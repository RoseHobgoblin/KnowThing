import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { resolveCelestialCanonicalSlug } from '$lib/server/services/celestial-registry.js'

const TRAILING = new Set(['edit', 'configure', 'history', 'move'])

/**
 * Legacy `/celestial/[...path]` route: 308-redirects to the canonical
 * `/Celestial:<slug>` URL. Handles both flat (`/celestial/therne`) and
 * parent-path (`/celestial/sunly/therne`) input forms — the trailing path
 * segment is the entity slug, anything before it is parent-path noise.
 */
export const load: PageServerLoad = async ({ params }) => {
	const segs = params.path.split('/').filter(Boolean)
	let trailing = ''
	const last = segs.at(-1)?.toLowerCase()
	if (last && TRAILING.has(last)) {
		trailing = `/${last}`
		segs.pop()
	}
	const slug = segs.at(-1)
	if (!slug) throw error(404, 'No celestial slug in path')

	const canonical = await resolveCelestialCanonicalSlug(slug)
	if (!canonical) throw error(404, 'Celestial body not found')

	throw redirect(308, `/Celestial:${canonical}${trailing}`)
}
