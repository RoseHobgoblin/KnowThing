import { eq, and } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { calendars, celestialBodies } from '$lib/server/db/schema.js'

export async function getPrimaryCalendarWithPlanetData() {
	const [row] = await db.select().from(calendars).where(eq(calendars.isPrimary, true)).limit(1)
	if (!row) return null

	let planet: typeof celestialBodies.$inferSelect | null = null
	let moons: { id: number, orbitalPeriodDays: number | null, epochPhase: number | null }[] = []

	if (row.planetId) {
		const [foundPlanet] = await db.select().from(celestialBodies).where(eq(celestialBodies.id, row.planetId))
		planet = foundPlanet ?? null
		if (planet) {
			moons = await db
				.select({
					id: celestialBodies.id,
					orbitalPeriodDays: celestialBodies.orbitalPeriodDays,
					epochPhase: celestialBodies.epochPhase,
				})
				.from(celestialBodies)
				.where(and(eq(celestialBodies.parentId, planet.id), eq(celestialBodies.kind, 'body')))
		}
	}

	return { calendar: row, planet, moons }
}
