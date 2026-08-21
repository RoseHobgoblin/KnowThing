import type { PageServerLoad } from './$types.js'
import {
	listBodiesForRegistry,
	listStarsForRegistry,
	listSystemsForRegistry,
} from '$lib/feature/rodder/public/server/registry.server.js'

export const load: PageServerLoad = async () => {
	const [systems, stars, bodies] = await Promise.all([
		listSystemsForRegistry(),
		listStarsForRegistry(),
		listBodiesForRegistry(),
	])
	return { systems, stars, bodies }
}
