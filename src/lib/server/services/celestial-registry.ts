import { eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	planetaryBodies,
	starSystems,
	stars,
} from '$lib/server/db/schema.js'

export async function listSystemsForRegistry() {
	return db.execute(sql`
		SELECT
			ss.id, ss.name, ss.slug, ss.system_type AS "systemType",
			ss.page_slug AS "pageSlug",
			(SELECT COUNT(*) FROM stars WHERE system_id = ss.id)::int AS "starCount",
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ss.id)::int AS "planetCount"
		FROM star_systems ss
		ORDER BY ss.name
	`)
}

export async function listStarsForRegistry() {
	return db.execute(sql`
		SELECT
			s.id, s.name, s.slug, s.spectral_type AS "spectralType",
			s.color, s.page_slug AS "pageSlug", s.system_id AS "systemId",
			s.semi_major_axis_au AS "semiMajorAxisAu", s.eccentricity,
			s.parent_star_id AS "parentStarId",
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = s.id)::int AS "planetCount"
		FROM stars s
		ORDER BY s.parent_star_id NULLS FIRST, s.name
	`)
}

export async function findSystemBySlugOrPageSlug(slug: string) {
	const [system] = await db.select().from(starSystems)
		.where(sql`LOWER(${starSystems.slug}) = LOWER(${slug}) OR LOWER(${starSystems.pageSlug}) = LOWER(${slug})`)
	return system ?? null
}

export async function findStarBySlugOrPageSlug(slug: string) {
	const [star] = await db.select().from(stars)
		.where(sql`LOWER(${stars.slug}) = LOWER(${slug}) OR LOWER(${stars.pageSlug}) = LOWER(${slug})`)
	return star ?? null
}

export async function findPlanetBySlugOrPageSlug(slug: string) {
	const [planet] = await db.select().from(planetaryBodies)
		.where(sql`LOWER(${planetaryBodies.slug}) = LOWER(${slug}) OR LOWER(${planetaryBodies.pageSlug}) = LOWER(${slug})`)
	return planet ?? null
}

/**
 * Resolve any celestial input slug (real slug or legacy `pageSlug`) to its
 * canonical row slug across all three tables. Used by the legacy
 * `/celestial/[...path]` 308 redirect stub.
 */
export async function resolveCelestialCanonicalSlug(slug: string): Promise<string | null> {
	const lower = slug.toLowerCase()
	const [row] = await db.execute(sql`
		SELECT slug FROM star_systems WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		UNION ALL
		SELECT slug FROM stars WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		UNION ALL
		SELECT slug FROM planetary_bodies WHERE LOWER(slug) = ${lower} OR LOWER(page_slug) = ${lower}
		LIMIT 1
	`)
	return (row as unknown as { slug?: string })?.slug ?? null
}

export async function getStarsForSystemMap(systemId: number) {
	return db.execute(sql`
		SELECT id, name, slug, spectral_type AS "spectralType", color,
			page_slug AS "pageSlug", semi_major_axis_au AS "semiMajorAxisAu",
			eccentricity, parent_star_id AS "parentStarId",
			epoch_phase AS "epochPhase"
		FROM stars WHERE system_id = ${systemId}
		ORDER BY parent_star_id NULLS FIRST, name
	`)
}

export async function getBodiesForSystemMap(systemId: number) {
	return db.execute(sql`
		SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.page_slug AS "pageSlug", pb.semi_major_axis_au AS "semiMajorAxisAu",
			pb.eccentricity, pb.star_id AS "starId", pb.parent_id AS "parentId",
			pb.orbital_period_days AS "orbitalPeriodDays",
			pb.epoch_phase AS "epochPhase",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		JOIN stars s ON s.id = pb.star_id
		WHERE s.system_id = ${systemId}
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)
}

export async function getCalendarsForSystem(systemId: number) {
	return db.execute(sql`
		SELECT c.id, c.name, c.static_data AS "staticData", c.planet_id AS "planetId"
		FROM calendars c
		WHERE c.planet_id IN (
			SELECT pb.id FROM planetary_bodies pb
			JOIN stars s ON s.id = pb.star_id
			WHERE s.system_id = ${systemId}
		)
		OR c.planet_id IS NULL
		ORDER BY c.name
	`)
}

export async function getStarSystemRef(systemId: number) {
	const [sys] = await db
		.select({ slug: starSystems.slug, name: starSystems.name })
		.from(starSystems)
		.where(eq(starSystems.id, systemId))
	return sys ?? null
}

export async function getStarSystemId(starId: number) {
	const [parentStar] = await db.select({ systemId: stars.systemId }).from(stars).where(eq(stars.id, starId))
	return parentStar?.systemId ?? null
}

export async function listAllSystemRefs() {
	return db.select({ id: starSystems.id, name: starSystems.name }).from(starSystems).orderBy(starSystems.name)
}

export async function listAllStarRefs() {
	return db.select({ id: stars.id, name: stars.name, slug: stars.slug, massKg: stars.massKg }).from(stars).orderBy(stars.name)
}

export async function listSiblingBodies(starId: number) {
	return db
		.select({
			id: planetaryBodies.id,
			name: planetaryBodies.name,
			slug: planetaryBodies.slug,
			massKg: planetaryBodies.massKg,
		})
		.from(planetaryBodies)
		.where(eq(planetaryBodies.starId, starId))
}

export async function listBodiesForRegistry() {
	return db.execute(sql`
		SELECT
			pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.star_id AS "starId", pb.parent_id AS "parentId",
			pb.page_slug AS "pageSlug",
			pb.semi_major_axis_au AS "semiMajorAxisAu", pb.eccentricity,
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)
}
