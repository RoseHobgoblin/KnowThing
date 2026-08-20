import type { LayoutServerLoad } from './$types.js'
import { resolveDisplay } from 'rimecraft'
import type { CalendarConfig, ResolvedDate, StaticCalendarData } from 'rimecraft'
import { getSiteConfig } from '$lib/server/settings.js'
import { hasRole } from '$lib/server/auth.js'
import type { AppPermissions } from '$lib/permissions.js'
import { getPrimaryCalendarWithPlanetData } from '$lib/server/services/layout.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user
	const permissions: AppPermissions = {
		isAuthenticated: !!user,
		canEditContent: user ? hasRole(user.role, 'editor') : false,
		canCreatePages: user ? hasRole(user.role, 'editor') : false,
		canManageWordbook: user ? hasRole(user.role, 'editor') : false,
		canManageMedia: user ? hasRole(user.role, 'editor') : false,
		canConfigureCalendar: user ? hasRole(user.role, 'editor') : false,
		canConfigureRodder: user ? hasRole(user.role, 'editor') : false,
		canManageSettings: user ? hasRole(user.role, 'admin') : false,
		canManageUsers: user ? hasRole(user.role, 'admin') : false,
		canManageLanguages: user ? hasRole(user.role, 'admin') : false,
		canGenerateInviteCodes: user ? hasRole(user.role, 'admin') : false,
	}

	const [primaryCalendar, siteConfig] = await Promise.all([
		getPrimaryCalendarWithPlanetData(),
		getSiteConfig(),
	])

	let calendarDate: ResolvedDate | null = null
	let calendarConfig: CalendarConfig | null = null
	if (primaryCalendar) {
		const { calendar: row, planet, moons } = primaryCalendar
		const staticData: StaticCalendarData = {
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
		}

		if (planet) {
			if (planet.rotationPeriodS) {
				staticData.day_length_seconds = planet.rotationPeriodS
			}
			staticData.planet = {
				orbital_period_days: planet.orbitalPeriodDays ?? 0,
				rotation_period_s: planet.rotationPeriodS ?? 86400,
				moons: moons.map(m => ({
					id: m.id,
					orbital_period_days: m.orbitalPeriodDays ?? 29.5,
					epoch_phase: m.epochPhase ?? 0,
				})),
			}
		}

		calendarConfig = {
			name: row.name,
			description: row.description || '',
			primary: true,
			static_data: staticData,
		}
		calendarDate = resolveDisplay(calendarConfig)
	}

	return {
		user,
		isAdmin: permissions.canManageSettings,
		isEditor: permissions.canEditContent,
		permissions,
		calendarDate,
		calendarConfig,
		siteConfig,
	}
}
