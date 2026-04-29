import type { PageServerLoad } from './$types.js'
import { getSiteStats } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async () => {
	return { stats: await getSiteStats() }
}
