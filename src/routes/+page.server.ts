import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages, revisions, lexicon, languages, media, calendars, users } from '$lib/server/db/schema.js'
import { desc, eq, sql, count } from 'drizzle-orm'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'

export const load: PageServerLoad = async () => {
	const [
		recentEdits,
		articleCount,
		wordCount,
		languageCount,
		mediaCount,
		userCount,
		featuredArticle,
		randomWord,
		primaryCalendarRows,
	] = await Promise.all([
		// Recent edits (last 8)
		db
			.select({
				pageSlug: revisions.pageSlug,
				title: revisions.title,
				editSummary: revisions.editSummary,
				createdAt: revisions.createdAt,
				userId: revisions.userId,
			})
			.from(revisions)
			.orderBy(desc(revisions.createdAt))
			.limit(8),

		// Counts
		db.select({ value: count() }).from(pages),
		db.select({ value: count() }).from(lexicon),
		db.select({ value: count() }).from(languages),
		db.select({ value: count() }).from(media),
		db.select({ value: count() }).from(users),

		// Featured: most recently updated article with decent content
		db
			.select({ slug: pages.slug, title: pages.title, content: pages.content })
			.from(pages)
			.where(sql`LENGTH(${pages.content}) > 200`)
			.orderBy(desc(pages.updatedAt))
			.limit(1),

		// Random word with definition
		db
			.select({
				word: lexicon.word,
				languageName: languages.name,
				languageSlug: languages.slug,
				pronunciation: lexicon.pronunciation,
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.orderBy(sql`RANDOM()`)
			.limit(1),

		// Primary calendar
		db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1),
	])

	// Resolve calendar date
	let calendarInfo: { name: string, dayName: string, day: number, monthName: string, yearDisplay: string, seasonName: string } | null = null
	if (primaryCalendarRows.length > 0) {
		const row = primaryCalendarRows[0]
		const config: CalendarConfig = {
			name: row.name,
			description: row.description || '',
			primary: true,
			static_data: {
				first_week_day: 0, weekdays: [], months: [], leap_days: [],
				moons: [], eras: [], seasons: [], display_moons: false,
				year_offset: 0, epoch_offset: 0,
				...(row.staticData as Partial<StaticCalendarData>),
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

	// Extract first paragraph for featured article summary
	let featuredSummary = ''
	if (featuredArticle[0]) {
		const lines = featuredArticle[0].content.split('\n')
		let insideTemplate = false
		for (const line of lines) {
			const trimmed = line.trim()
			// Track multi-line templates (infoboxes)
			if (trimmed.startsWith('{{')) insideTemplate = true
			if (insideTemplate) {
				if (trimmed.includes('}}') && !trimmed.startsWith('{{')) insideTemplate = false
				continue
			}
			if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('[[Category:') || trimmed.startsWith('[[File:') || trimmed.startsWith('{|') || trimmed.startsWith('|}') || trimmed.startsWith('|') || trimmed.startsWith('!') || trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith(':') || trimmed.startsWith(';') || trimmed === '}}') continue
			featuredSummary = trimmed
				.replaceAll(/'{2,3}/g, '')
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

	// Get first definition for random word
	let randomWordDef = ''
	if (randomWord[0]) {
		const [def] = await db
			.select({ definition: sql<string>`definition` })
			.from(sql`definitions`)
			.where(sql`entry_id = (SELECT id FROM lexicon WHERE word = ${randomWord[0].word} AND language_id = (SELECT id FROM languages WHERE slug = ${randomWord[0].languageSlug}) LIMIT 1)`)
			.limit(1)
		randomWordDef = def?.definition ?? ''
	}

	return {
		stats: {
			articles: articleCount[0]?.value ?? 0,
			words: wordCount[0]?.value ?? 0,
			languages: languageCount[0]?.value ?? 0,
			media: mediaCount[0]?.value ?? 0,
			users: userCount[0]?.value ?? 0,
		},
		recentEdits,
		featured: featuredArticle[0] ? {
			slug: featuredArticle[0].slug,
			title: featuredArticle[0].title,
			summary: featuredSummary,
		} : null,
		randomWord: randomWord[0] ? {
			...randomWord[0],
			definition: randomWordDef,
		} : null,
		calendarInfo,
	}
}
