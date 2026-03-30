import type { LayoutServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, calendars, planetaryBodies } from '$lib/server/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { resolveDisplay } from '$lib/calendar/date-math.js'
import type { CalendarConfig, ResolvedDate, StaticCalendarData } from '$lib/calendar/types.js'
import { getSiteConfig } from '$lib/server/settings.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	const [allContent, primaryCalendarRows, siteConfig] = await Promise.all([
		db.select({ domain: contentRecords.domain, slug: contentRecords.slug, parentPath: contentRecords.parentPath }).from(contentRecords),
		db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1),
		getSiteConfig(),
	])

	let calendarDate: ResolvedDate | null = null
	if (primaryCalendarRows.length > 0) {
		const row = primaryCalendarRows[0]
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

		// Enrich with planet data if linked
		if (row.planetId) {
			const [planet] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.id, row.planetId))
			if (planet) {
				// Derive day length from planet rotation
				if (planet.rotationPeriodS) {
					staticData.day_length_seconds = planet.rotationPeriodS
				}
				// Fetch moons for phase computation
				const moons = await db
					.select({ id: planetaryBodies.id, orbitalPeriodDays: planetaryBodies.orbitalPeriodDays, epochPhase: planetaryBodies.epochPhase })
					.from(planetaryBodies)
					.where(sql`${planetaryBodies.parentId} = ${planet.id} AND ${planetaryBodies.bodyType} = 'moon'`)

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
		}

		const config: CalendarConfig = {
			name: row.name,
			description: row.description || '',
			primary: true,
			static_data: staticData,
		}
		calendarDate = resolveDisplay(config)
	}

	return {
		user: locals.user,
		isAdmin: locals.user?.role === 'admin' || locals.user?.role === 'owner' || false,
		isEditor: locals.user?.role === 'editor' || locals.user?.role === 'admin' || locals.user?.role === 'owner' || false,
		existingPages: allContent.filter(c => c.domain === 'know').map(c => c.slug.toLowerCase()),
		existingContent: allContent.map(c => ({ domain: c.domain, slug: c.slug.toLowerCase(), parentPath: c.parentPath })),
		calendarDate,
		siteConfig,
	}
}
