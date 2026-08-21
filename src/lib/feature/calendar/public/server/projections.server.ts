import { asc, inArray, isNull, or } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { calendars } from '../../server/schema.server.js'

export async function calendarProjectionsForBodyIds(bodyIds: number[], includeUnbound = true) {
	const uniqueIds = [...new Set(bodyIds)]
	const condition = uniqueIds.length > 0
		? (includeUnbound ? or(inArray(calendars.planetId, uniqueIds), isNull(calendars.planetId)) : inArray(calendars.planetId, uniqueIds))
		: isNull(calendars.planetId)
	const rows = await db.select({ id: calendars.id, name: calendars.name, staticData: calendars.staticData, planetId: calendars.planetId })
		.from(calendars).where(condition).orderBy(asc(calendars.name))
	return rows.map(row => ({
		...row,
		staticData: typeof row.staticData === 'object' && row.staticData !== null && !Array.isArray(row.staticData)
			? row.staticData as Record<string, unknown>
			: null,
	}))
}
