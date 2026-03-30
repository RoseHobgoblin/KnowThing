import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, sql, asc } from 'drizzle-orm'
import { parseWikitext } from '$lib/parser/index.js'
import { requireAuth } from '$lib/server/auth.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const pathSegments = (params.path || '').split('/').filter(Boolean)

	// Empty path → hub mode
	if (pathSegments.length === 0) {
		const allCalendars = await db
			.select()
			.from(calendars)
			.orderBy(asc(calendars.name))

		const configs = allCalendars.map(cal => ({
			...cal,
			config: buildCalendarConfig(cal),
		}))

		const primary = configs.find(c => c.isPrimary) ?? null

		return { mode: 'hub' as const, calendars: configs, primary }
	}

	// Detect configure mode
	const isConfigure = pathSegments.at(-1) === 'configure'
	if (isConfigure) pathSegments.pop()

	const slug = pathSegments[0]

	if (isConfigure && !locals.user) {
		redirect(302, `/auth/login?redirect=${encodeURIComponent(`/calendar/${params.path}`)}`)
	}

	// Load calendar by slug
	const [cal] = await db.select().from(calendars).where(sql`LOWER(${calendars.slug}) = LOWER(${slug})`)
	if (!cal) error(404, 'Calendar not found')

	// Canonical redirect
	if (cal.slug !== slug && !isConfigure) redirect(301, `/calendar/${cal.slug}`)

	const config = buildCalendarConfig(cal)
	const resolved = resolveDisplay(config)

	// Load wiki content
	let wikiContent = ''
	let ast = null
	let contentRecordId: number | null = null
	if (cal.contentRecordId) {
		const [record] = await db
			.select({ id: contentRecords.id, content: contentRecords.content, parsedAst: contentRecords.parsedAst })
			.from(contentRecords)
			.where(eq(contentRecords.id, cal.contentRecordId))
		if (record) {
			wikiContent = record.content
			ast = (record.parsedAst as import('$lib/parser/types.js').WikiNode) ?? (record.content ? parseWikitext(record.content) : null)
			contentRecordId = record.id
		}
	}

	return {
		mode: (isConfigure ? 'configure' : 'detail') as 'configure' | 'detail',
		calendar: cal,
		config,
		resolved,
		wikiContent,
		ast,
		contentRecordId,
	}
}

/** Save action for configure mode */
export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event)
		const formData = await event.request.formData()
		const calendarId = Number(formData.get('calendarId'))
		const contentRecordId = Number(formData.get('contentRecordId')) || null
		const content = formData.get('content')?.toString() || ''
		const staticDataJson = formData.get('staticData')?.toString() || '{}'
		const editSummary = formData.get('summary')?.toString() || ''

		if (!calendarId) error(400, 'Missing calendar ID')

		const [cal] = await db.select().from(calendars).where(eq(calendars.id, calendarId))
		if (!cal) error(404, 'Calendar not found')

		// Save static data
		try {
			const staticData = JSON.parse(staticDataJson)
			await db.update(calendars).set({ staticData }).where(eq(calendars.id, calendarId))
		} catch { /* ignore bad JSON — keep existing config */ }

		// Save prose content
		if (contentRecordId) {
			const sizeBytes = new TextEncoder().encode(content).length
			const { plainText, ast } = await updateContentEffects(contentRecordId, content)

			await db
				.update(contentRecords)
				.set({ content, plainText, parsedAst: ast, sizeBytes, updatedAt: new Date() })
				.where(eq(contentRecords.id, contentRecordId))

			await db.insert(contentRevisions).values({
				contentRecordId,
				title: cal.name,
				content,
				sizeBytes,
				editSummary,
				userId: user.id,
			})
		}

		redirect(302, `/calendar/${cal.slug}`)
	},
}

function buildCalendarConfig(cal: typeof calendars.$inferSelect): CalendarConfig {
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
