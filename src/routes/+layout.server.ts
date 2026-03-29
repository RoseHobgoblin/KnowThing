import type { LayoutServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, calendars } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import type { CalendarConfig, ResolvedDate, StaticCalendarData } from '$lib/calendar/types.js'
import { getSiteConfig } from '$lib/server/settings.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	const [allContent, primaryCalendarRows, siteConfig] = await Promise.all([
		db.select({ domain: contentRecords.domain, slug: contentRecords.slug }).from(contentRecords),
		db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1),
		getSiteConfig(),
	])

	let calendarDate: ResolvedDate | null = null
	if (primaryCalendarRows.length > 0) {
		const row = primaryCalendarRows[0]
		const config: CalendarConfig = {
			name: row.name,
			description: row.description || '',
			primary: true,
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
				...(row.staticData as Partial<StaticCalendarData>),
			},
		}
		calendarDate = resolveDisplay(config)
	}

	return {
		user: locals.user,
		isAdmin: locals.user?.role === 'admin' ?? false,
		existingPages: allContent.filter(c => c.domain === 'know').map(c => c.slug.toLowerCase()),
		existingContent: allContent.map(c => ({ domain: c.domain, slug: c.slug.toLowerCase() })),
		calendarDate,
		siteConfig,
	}
}
