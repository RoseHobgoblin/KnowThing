import type { PageServerLoad } from './$types.js'
import {
	listBodiesForRegistry,
	listStarsForRegistry,
	listSystemsForRegistry,
} from '$lib/feature/rodder/server/registry.server.js'
import { listSectorsForRegistry } from '$lib/feature/rodder/server/sectors.server.js'

export const load: PageServerLoad = async () => {
	const [systems, stars, bodies, sectors] = await Promise.all([
		listSystemsForRegistry(),
		listStarsForRegistry(),
		listBodiesForRegistry(),
		listSectorsForRegistry(),
	])

	return { systems, stars, bodies, sectors }
}
