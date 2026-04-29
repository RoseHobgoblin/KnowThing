import type { PageServerLoad } from './$types.js'
import { listRecentEdits } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async ({ url }) => {
	const page = Number.parseInt(url.searchParams.get('page') ?? '1')
	const perPage = 20
	const edits = await listRecentEdits({ page, perPage })
	return { edits, page, perPage }
}
