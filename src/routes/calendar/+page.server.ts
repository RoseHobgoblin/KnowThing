import type { PageServerLoad } from './$types.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import {
	type Calendar,
	listAllCalendars,
} from '$lib/server/services/calendar.js'

export const load: PageServerLoad = async () => {
	const allCalendars = await listAllCalendars()

	const configs = allCalendars.map(cal => ({
		...cal,
		config: buildCalendarConfig(cal),
	}))

	const primary = configs.find(c => c.isPrimary) ?? null

	return { mode: 'hub' as const, calendars: configs, primary }
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
