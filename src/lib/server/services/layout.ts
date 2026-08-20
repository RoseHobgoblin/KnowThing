import { eq, and } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { calendars, rodderBodies } from '$lib/server/db/schema.js'

export async function getPrimaryCalendarWithPlanetData() {
	const [row] = await db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1)
	if (!row) return null

	let planet: typeof rodderBodies.$inferSelect | null = null
	let moons: { id: number, orbitalPeriodDays: number | null, epochPhase: number | null }[] = []

	if (row.planetId) {
		const [foundPlanet] = await db.select().from(rodderBodies).where(eq(rodderBodies.id, row.planetId))
		planet = foundPlanet ?? null
		if (planet) {
			moons = await db
				.select({
					id: rodderBodies.id,
					orbitalPeriodDays: rodderBodies.orbitalPeriodDays,
					epochPhase: rodderBodies.epochPhase,
				})
				.from(rodderBodies)
				.where(and(eq(rodderBodies.parentId, planet.id), eq(rodderBodies.kind, 'body')))
		}
	}

	return { calendar: row, planet, moons }
}
