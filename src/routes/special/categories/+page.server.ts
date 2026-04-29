import type { PageServerLoad } from './$types.js'
import { listAllCategories } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async () => {
	return { categories: await listAllCategories() }
}
