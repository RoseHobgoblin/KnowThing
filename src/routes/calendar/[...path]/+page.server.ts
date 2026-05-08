import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { hasRole } from '$lib/server/auth.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import {
	type Calendar,
	findCalendarBySlugCaseInsensitive,
	listAllCalendars,
} from '$lib/server/services/calendar.js'
import { loadArticlePage } from '$lib/server/services/article-loader.js'
import { articleSaveAction } from '$lib/server/services/article-actions.js'

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

	const article = await loadArticlePage({
		domain: 'calendar',
		slug: cal.slug,
		title: cal.name,
	})

	return {
		mode: (isConfigure ? 'configure' : 'detail') as 'configure' | 'detail',
		calendar: cal,
		config,
		resolved,
		wikiContent: article.wikiContent,
		ast: article.ast,
		contentRecordId: article.contentRecordId,
		resolvedLinks: article.resolvedLinks,
	}
}

export const actions: Actions = {
	default: articleSaveAction({ editSuffix: /\/configure$/ }),
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
