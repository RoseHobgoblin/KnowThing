import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { calendars, contentRecords, contentRevisions } from '$lib/server/db/schema.js'
import { eq, sql, asc } from 'drizzle-orm'
import { parseWikitext } from '$lib/parser/index.js'
import { hasRole } from '$lib/server/auth.js'
import { requireEditor } from '$lib/server/guards.js'
import { updateContentEffects } from '$lib/server/content-effects.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import { parseStaticCalendarDataJson } from '$lib/calendar/schema.js'
import { summarizeZodIssues } from '$lib/utils.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const pathSegments = (params.path || '').split('/').filter(Boolean)

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

	const [cal] = await db.select().from(calendars).where(sql`LOWER(${calendars.slug}) = LOWER(${slug})`)
	if (!cal) throw error(404, 'Calendar not found')

	if (cal.slug !== slug && !isConfigure) throw redirect(301, `/calendar/${cal.slug}`)

	const config = buildCalendarConfig(cal)
	const resolved = resolveDisplay(config)

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

export const actions: Actions = {
	default: async (event) => {
		const user = requireEditor(event)
		const formData = await event.request.formData()
		const calendarId = Number(formData.get('calendarId'))
		const contentRecordId = Number(formData.get('contentRecordId')) || null
		const content = formData.get('content')?.toString() || ''
		const staticDataJson = formData.get('staticData')?.toString() || '{}'
		const editSummary = formData.get('summary')?.toString() || ''

		if (!calendarId) return fail(400, { error: 'Missing calendar ID' })

		const [cal] = await db.select().from(calendars).where(eq(calendars.id, calendarId))
		if (!cal) return fail(404, { error: 'Calendar not found' })

		const parsedStaticData = parseStaticCalendarDataJson(staticDataJson)
		if (!parsedStaticData.success) {
			return fail(400, {
				error: 'Calendar configuration is invalid',
				validationIssues: summarizeZodIssues(parsedStaticData.error),
			})
		}

		await db.update(calendars).set({ staticData: parsedStaticData.data }).where(eq(calendars.id, calendarId))

		try {
			if (contentRecordId) {
				const sizeBytes = new TextEncoder().encode(content).length
				const { plainText, ast } = await updateContentEffects(db, contentRecordId, content)

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
		} catch {
			return fail(500, { error: 'Failed to save calendar changes' })
		}

		throw redirect(302, `/calendar/${cal.slug}`)
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
