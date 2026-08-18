import type { PageServerLoad } from './$types.js'
import {
	listBodiesForRegistry,
	listStarsForRegistry,
	listSystemsForRegistry,
} from '$lib/server/services/celestial-registry.js'

export const load: PageServerLoad = async () => {
	const [systems, stars, bodies] = await Promise.all([
		listSystemsForRegistry(),
		listStarsForRegistry(),
		listBodiesForRegistry(),
	])
	return { systems, stars, bodies }
}
