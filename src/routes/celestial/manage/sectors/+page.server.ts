import type { PageServerLoad } from './$types.js'
import { listSystemsForRegistry } from '$lib/server/services/celestial-registry.js'
import { listSectorsForRegistry } from '$lib/server/services/celestial-sectors.js'

export const load: PageServerLoad = async () => {
	const [sectors, systems] = await Promise.all([
		listSectorsForRegistry(),
		listSystemsForRegistry(),
	])
	return { sectors, systems }
}
