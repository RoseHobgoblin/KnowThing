import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { parseWikitext } from '$lib/parser/index.js'
import { hasRole } from '$lib/server/auth.js'
import { requireEditor } from '$lib/server/guards.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import {
	type Calendar,
	findCalendarBySlugCaseInsensitive,
	listAllCalendars,
	loadCalendarContent,
	saveCalendarContent,
} from '$lib/server/services/calendar.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const pathSegments = (params.path || '').split('/').filter(Boolean)

	if (pathSegments.length === 0) {
		const allCalendars = await listAllCalendars()

		const configs = allCalendars.map(cal => ({
			...cal,
			config: buildCalendarConfig(cal),
		}))

		const primary = configs.find(c => c.isPrimary) ?? null

		return { mode: 'hub' as const, calendars: configs, primary }
	}

	const isConfigure = pathSegments.at(-1) === 'configure'
	if (isConfigure) pathSegments.pop()

	const slug = pathSegments[0]

	if (isConfigure) {
		if (!locals.user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(`/calendar/${params.path}`)}`)
		}
		if (!hasRole(locals.user.role, 'editor')) {
			throw redirect(302, `/calendar/${slug}`)
		}
	}

	const cal = await findCalendarBySlugCaseInsensitive(slug)
	if (!cal) throw error(404, 'Calendar not found')

	if (cal.slug !== slug && !isConfigure) throw redirect(301, `/calendar/${cal.slug}`)

	const config = buildCalendarConfig(cal)
	const resolved = resolveDisplay(config)

	const loaded = await loadCalendarContent(cal.contentRecordId)
	const ast = (loaded.ast as import('$lib/parser/types.js').WikiNode | null)
		?? (loaded.wikiContent ? parseWikitext(loaded.wikiContent) : null)

	return {
		mode: (isConfigure ? 'configure' : 'detail') as 'configure' | 'detail',
		calendar: cal,
		config,
		resolved,
		wikiContent: loaded.wikiContent,
		ast,
		contentRecordId: loaded.contentRecordId,
	}
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const contentRecordId = Number(formData.get('contentRecordId'))
		const content = formData.get('content')?.toString() || ''
		const editSummary = formData.get('summary')?.toString() || ''

		if (!contentRecordId) return fail(400, { error: 'Missing content record ID' })

		try {
			const result = await saveCalendarContent({ contentRecordId, content, editSummary, userId: user.id })
			if (!result.ok) return fail(result.status, { error: result.error })
		} catch {
			return fail(500, { error: 'Failed to save article changes' })
		}

		const viewPath = event.url.pathname.replace(/\/configure$/, '')
		throw redirect(302, viewPath)
	},
}

function buildCalendarConfig(cal: Calendar): CalendarConfig {
	return {
		name: cal.name,
		description: cal.description || '',
		primary: cal.isPrimary,
		static_data: {
			first_week_day: 0,
			weekdays: [],
			months: [],
			leap_days: [],
			moons: [],
			eras: [],
			seasons: [],
			display_moons: false,
			year_offset: 0,
			epoch_offset: 0,
			...(cal.staticData as Partial<StaticCalendarData>),
		},
	}
}
