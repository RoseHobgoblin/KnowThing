import type { PageServerLoad } from './$types.js'
import { getMediaDetail } from '$lib/feature/media/server/service.server.js'

export const load: PageServerLoad = async ({ params }) => {
	const filename = decodeURIComponent(params.filename)
	return getMediaDetail(filename)
}
