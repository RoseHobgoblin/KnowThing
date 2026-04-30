import type { PageServerLoad } from './$types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { extractSummaryFromAst, parseWikitext } from '$lib/parser/index.js'
import type { WikiNode } from '$lib/parser/types.js'
import {
	getFeaturedArticle,
	getHomepageCounts,
	getPrimaryCalendarRow,
	getRandomWord,
	getRecentEdits,
} from '$lib/server/services/homepage.js'

export const load: PageServerLoad = async () => {
	const [recentEdits, stats, featured, randomWord, primaryCalendar] = await Promise.all([
		getRecentEdits(8),
		getHomepageCounts(),
		getFeaturedArticle(),
		getRandomWord(),
		getPrimaryCalendarRow(),
	])

	let calendarInfo: { name: string, dayName: string, day: number, monthName: string, yearDisplay: string, seasonName: string } | null = null
	if (primaryCalendar) {
		const config: CalendarConfig = {
			name: primaryCalendar.name,
			description: primaryCalendar.description || '',
			primary: true,
			static_data: {
				first_week_day: 0, weekdays: [], months: [], leap_days: [],
				moons: [], eras: [], seasons: [], display_moons: false,
				year_offset: 0, epoch_offset: 0,
				...(primaryCalendar.staticData as Partial<StaticCalendarData>),
			},
		}
		const resolved = resolveDisplay(config)
		calendarInfo = {
			name: config.name,
			dayName: resolved.day_of_week_name,
			day: resolved.day,
			monthName: resolved.month_name,
			yearDisplay: resolved.year_display,
			seasonName: resolved.season_name,
		}
	}

	const featuredSummary = featured
		? extractSummaryFromAst(
			(featured.parsedAst as WikiNode | null) ?? parseWikitext(featured.content),
			{ maxLength: 250 },
		)
		: ''

	return {
		stats,
		recentEdits,
		featured: featured ? {
			slug: featured.slug,
			title: featured.title,
			summary: featuredSummary,
		} : null,
		randomWord,
		calendarInfo,
	}
}
