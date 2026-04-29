import type { PageServerLoad } from './$types.js'
import { getSiteSettings } from '$lib/server/services/settings.js'

export const load: PageServerLoad = async () => {
	return { settings: await getSiteSettings() }
}
