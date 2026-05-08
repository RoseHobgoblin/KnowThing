import { error, redirect } from '@sveltejs/kit'
import { hasRole } from '$lib/server/auth.js'
import type { CalendarConfig, StaticCalendarData } from '$lib/calendar/types.js'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import {
	type Calendar,
	findCalendarBySlugCaseInsensitive,
} from '$lib/server/services/calendar.js'
import { loadEntityBody } from '$lib/server/services/entity-article-loader.js'

export interface CalendarDetailContext {
	identifier: string
	mode: 'view' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string
	canonicalize: (slug: string) => string
}

export interface CalendarDetailData {
	mode: 'detail' | 'configure'
	calendar: Calendar
	config: CalendarConfig
	resolved: ReturnType<typeof resolveDisplay>
	wikiContent: string
	ast: unknown
	contentRecordId: number | null
	resolvedLinks: Record<string, { href: string, exists: boolean }>
}

export async function loadCalendarDetail(ctx: CalendarDetailContext): Promise<CalendarDetailData> {
	const { identifier, mode, user, loginRedirectPath, canonicalize } = ctx

	if (mode === 'configure') {
		if (!user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(loginRedirectPath)}`)
		}
		if (!hasRole(user.role, 'editor')) {
			throw redirect(302, canonicalize(identifier))
		}
	}

	const cal = await findCalendarBySlugCaseInsensitive(identifier)
	if (!cal) throw error(404, 'Calendar not found')

	if (cal.slug !== identifier && mode !== 'configure') {
		throw redirect(301, canonicalize(cal.slug))
	}

	const config = buildCalendarConfig(cal)
	const resolved = resolveDisplay(config)

	const article = await loadEntityBody({
		kind: 'calendar',
		entityId: cal.id,
		body: cal.body ?? '',
		bodyParsedAst: cal.bodyParsedAst,
	})

	return {
		mode: mode === 'configure' ? 'configure' : 'detail',
		calendar: cal,
		config,
		resolved,
		wikiContent: article.wikiContent,
		ast: article.ast,
		contentRecordId: article.contentRecordId,
		resolvedLinks: article.resolvedLinks,
	}
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
