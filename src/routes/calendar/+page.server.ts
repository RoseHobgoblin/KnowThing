import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import type { CalendarConfig } from '$lib/calendar/types.js'

export const load: PageServerLoad = async ({ url }) => {
	const allCalendars = await db
		.select()
		.from(calendars)
		.orderBy(calendars.name)

	const configs: CalendarConfig[] = allCalendars.map(cal => ({
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
			display_moons: true,
			year_offset: 0,
			epoch_offset: 0,
			...(cal.staticData as Record<string, unknown>),
		},
	}))

	const primary = configs.find(c => c.primary) ?? null

	// Read optional query params for initial navigation
	const yearParam = url.searchParams.get('year')
	const monthParam = url.searchParams.get('month')

	return {
		calendars: configs,
		primary,
		initialYear: yearParam ? Number.parseInt(yearParam) : null,
		initialMonth: monthParam ? Number.parseInt(monthParam) : null,
	}
}
