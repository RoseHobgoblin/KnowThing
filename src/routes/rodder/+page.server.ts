import type { PageServerLoad } from './$types.js'
import {
	listBodiesForRegistry,
	listStarsForRegistry,
	listSystemsForRegistry,
} from '$lib/server/services/rodder-registry.js'
import { listSectorsForRegistry } from '$lib/server/services/rodder-sectors.js'

export const load: PageServerLoad = async () => {
	const [systems, stars, bodies, sectors] = await Promise.all([
		listSystemsForRegistry(),
		listStarsForRegistry(),
		listBodiesForRegistry(),
		listSectorsForRegistry(),
	])

	return { systems, stars, bodies, sectors }
}
