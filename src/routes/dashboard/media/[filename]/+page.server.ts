import type { PageServerLoad } from './$types.js'
import { redirect } from '@sveltejs/kit'
import { getMediaDetail } from '$lib/server/services/media.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const filename = decodeURIComponent(params.filename)
	return getMediaDetail(filename)
}
