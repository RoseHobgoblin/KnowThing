import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { calendars } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { CalendarConfig } from '$lib/calendar/types.js';

export const load: PageServerLoad = async () => {
	const allCalendars = await db
		.select()
		.from(calendars)
		.orderBy(calendars.name);

	// Convert DB rows to CalendarConfig format
	const configs: CalendarConfig[] = allCalendars.map((cal) => ({
		name: cal.name,
		description: '',
		primary: cal.isPrimary,
		static_data: (cal.staticData as CalendarConfig['static_data']) ?? {
			first_week_day: 0,
			weekdays: [],
			months: [],
			leap_days: [],
			moons: [],
			eras: [],
			seasons: [],
			display_moons: true,
			year_offset: 0
		},
		current_date: (cal.calendarDate as CalendarConfig['current_date']) ?? {
			year: 1,
			month: 1,
			day: 1
		},
		auto_advance: null
	}));

	const primary = configs.find((c) => c.primary) ?? null;

	return { calendars: configs, primary };
};
