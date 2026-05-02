import type { PageServerLoad } from './$types.js'
import { getMediaDetail } from '$lib/server/services/media.js'

export const load: PageServerLoad = async ({ params }) => {
	const filename = decodeURIComponent(params.filename)
	return getMediaDetail(filename)
}
