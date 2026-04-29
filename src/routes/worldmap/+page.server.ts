import type { PageServerLoad } from './$types.js'
import { listKnowPageOptions, listMapsForIndex } from '$lib/server/services/maps.js'

export const load: PageServerLoad = async () => {
	const [maps, knowPages] = await Promise.all([
		listMapsForIndex(),
		listKnowPageOptions(),
	])

	return { maps, knowPages }
}
