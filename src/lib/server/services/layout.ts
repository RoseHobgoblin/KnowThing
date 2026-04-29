import { eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { calendars, planetaryBodies } from '$lib/server/db/schema.js'

export async function getPrimaryCalendarWithPlanetData() {
	const [row] = await db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1)
	if (!row) return null

	let planet: typeof planetaryBodies.$inferSelect | null = null
	let moons: { id: number, orbitalPeriodDays: number | null, epochPhase: number | null }[] = []

	if (row.planetId) {
		const [foundPlanet] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.id, row.planetId))
		planet = foundPlanet ?? null
		if (planet) {
			moons = await db
				.select({
					id: planetaryBodies.id,
					orbitalPeriodDays: planetaryBodies.orbitalPeriodDays,
					epochPhase: planetaryBodies.epochPhase,
				})
				.from(planetaryBodies)
				.where(sql`${planetaryBodies.parentId} = ${planet.id}`)
		}
	}

	return { calendar: row, planet, moons }
}
