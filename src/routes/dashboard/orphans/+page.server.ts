import type { PageServerLoad } from './$types.js'
import { listOrphanedPages } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async () => {
	return { orphans: await listOrphanedPages() }
}
