import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars } from '$lib/server/db/schema.js'
import type { CalendarConfig } from '$lib/calendar/types.js'
import { fromTimestamp } from '$lib/calendar/know-date.js'

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
	const dateParam = url.searchParams.get('date')
	const yearParam = url.searchParams.get('year')
	const monthParam = url.searchParams.get('month')

	let initialYear: number | null = yearParam ? Number.parseInt(yearParam) : null
	let initialMonth: number | null = monthParam ? Number.parseInt(monthParam) : null

	// ?date=<unix_ts> takes priority — resolve timestamp to calendar year/month
	if (dateParam && primary) {
		const ts = Number.parseInt(dateParam)
		if (!Number.isNaN(ts)) {
			const resolved = fromTimestamp(ts, primary)
			initialYear = resolved.year
			initialMonth = resolved.month_index + 1
		}
	}

	return {
		calendars: configs,
		primary,
		initialYear,
		initialMonth,
	}
}
