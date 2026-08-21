import type { PageServerLoad } from './$types.js'
import { listSystemsForRegistry } from '$lib/feature/rodder/public/server/registry.server.js'
import { listSectorsForRegistry } from '$lib/feature/rodder/public/server/sectors.server.js'

export const load: PageServerLoad = async () => {
	const [sectors, systems] = await Promise.all([
		listSectorsForRegistry(),
		listSystemsForRegistry(),
	])
	return { sectors, systems }
}
