import type { PageServerLoad } from './$types.js'
import { listSystemsForRegistry } from '$lib/server/services/rodder-registry.js'
import { listSectorsForRegistry } from '$lib/server/services/rodder-sectors.js'

export const load: PageServerLoad = async () => {
	const [sectors, systems] = await Promise.all([
		listSectorsForRegistry(),
		listSystemsForRegistry(),
	])
	return { sectors, systems }
}
