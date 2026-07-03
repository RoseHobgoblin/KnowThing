import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { hasRole } from '$lib/server/auth.js'
import {
	listBodiesForRegistry,
	listStarsForRegistry,
	listSystemsForRegistry,
} from '$lib/server/services/celestial-registry.js'

export const load: PageServerLoad = async ({ locals }) => {
	// Management is editor-only; readers stay on the atlas.
	if (!locals.user || !hasRole(locals.user.role, 'editor')) {
		throw redirect(302, '/celestial')
	}

	const [systems, stars, bodies] = await Promise.all([
		listSystemsForRegistry(),
		listStarsForRegistry(),
		listBodiesForRegistry(),
	])

	return { systems, stars, bodies }
}
