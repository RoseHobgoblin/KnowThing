import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { findCalendarBySlugCaseInsensitive } from '$lib/server/services/calendar.js'

const TRAILING = new Set(['configure', 'history'])

/**
 * Legacy `/calendar/[...path]` route — 308-redirects to canonical
 * `/Calendar:<slug>`. Hub at `/calendar` lives in `../+page.*`.
 */
export const load: PageServerLoad = async ({ params }) => {
	const segs = (params.path || '').split('/').filter(Boolean)
	if (segs.length === 0) throw redirect(308, '/calendar')

	let trailing = ''
	const last = segs.at(-1)?.toLowerCase()
	if (last && TRAILING.has(last)) {
		trailing = `/${last}`
		segs.pop()
	}
	const slug = segs[0]
	if (!slug) throw error(404)

	const cal = await findCalendarBySlugCaseInsensitive(slug)
	if (!cal) throw error(404, 'Calendar not found')

	throw redirect(308, `/Calendar:${cal.slug}${trailing}`)
}
