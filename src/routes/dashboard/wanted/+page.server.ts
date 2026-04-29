import type { PageServerLoad } from './$types.js'
import { listWantedPages } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async () => {
	return { wanted: await listWantedPages() }
}
