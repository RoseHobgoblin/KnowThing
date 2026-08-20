import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { resolveRodderCanonicalSlug } from '$lib/feature/rodder/server/registry.server.js'

const TRAILING = new Set(['edit', 'configure', 'history', 'move'])

/**
 * Legacy `/rodder/[...path]` route: 308-redirects to the canonical
 * `/Rodder:<slug>` URL. Handles both flat (`/rodder/therne`) and
 * parent-path (`/rodder/sunly/therne`) input forms — the trailing path
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
	if (!slug) throw error(404, 'No rodder slug in path')

	const canonical = await resolveRodderCanonicalSlug(slug)
	if (!canonical) throw error(404, 'Rodder body not found')

	throw redirect(308, `/Rodder:${canonical}${trailing}`)
}
