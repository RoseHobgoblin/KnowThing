import type { PageServerLoad } from './$types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
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

	let featuredSummary = ''
	if (featured) {
		const lines = featured.content.split('\n')
		let insideTemplate = false
		for (const line of lines) {
			const trimmed = line.trim()
			if (trimmed.startsWith('{{')) insideTemplate = true
			if (insideTemplate) {
				if (trimmed.includes('}}') && !trimmed.startsWith('{{')) insideTemplate = false
				continue
			}
			if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('[[Category:') || trimmed.startsWith('[[File:') || trimmed.startsWith('{|') || trimmed.startsWith('|}') || trimmed.startsWith('|') || trimmed.startsWith('!') || trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith(':') || trimmed.startsWith(';') || trimmed === '}}') continue
			featuredSummary = trimmed
				.replaceAll(/'{2,3}/g, '')
				.replaceAll(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
				.replaceAll(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
				.replaceAll(/\{\{[^}]*\}\}/g, '')
				.replaceAll(/<ref[^>]*>[\S\s]*?<\/ref>/gi, '')
				.replaceAll(/<ref[^>]*\/>/gi, '')
				.replaceAll(/<[^>]+>/g, '')
				.replaceAll(/\s+/g, ' ')
				.trim()
			break
		}
		if (featuredSummary.length > 250) {
			const cut = featuredSummary.slice(0, 250)
			featuredSummary = cut.slice(0, cut.lastIndexOf(' ')) + '...'
		}
	}

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
