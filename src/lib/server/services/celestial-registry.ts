import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	contentLinks,
	contentRecords,
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
			orbital_period_days AS "orbitalPeriodDays",
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

export async function listAllSystemReferences() {
	return db.select({ id: starSystems.id, name: starSystems.name }).from(starSystems).orderBy(starSystems.name)
}

export async function listAllStarReferences() {
	return db
		.select({
			id: stars.id,
			name: stars.name,
			slug: stars.slug,
			massKg: stars.massKg,
			systemId: stars.systemId,
			parentStarId: stars.parentStarId,
		})
		.from(stars)
		.orderBy(stars.name)
}

export async function listAllBodyReferences() {
	return db
		.select({
			id: planetaryBodies.id,
			name: planetaryBodies.name,
			slug: planetaryBodies.slug,
			massKg: planetaryBodies.massKg,
			starId: planetaryBodies.starId,
			parentId: planetaryBodies.parentId,
			semiMajorAxisAu: planetaryBodies.semiMajorAxisAu,
			eccentricity: planetaryBodies.eccentricity,
			bodyType: planetaryBodies.bodyType,
		})
		.from(planetaryBodies)
		.orderBy(planetaryBodies.name)
}

/**
 * Wiki pages that link to a celestial body (its "referenced by" / backlinks).
 * Reads the persisted `content_links` graph — matched on slug since celestial
 * entities have no shadow row in `content_records` to resolve against.
 *
 * Match only the `celestial` namespace (explicit `[[Celestial:X]]`). Bare
 * `[[X]]` links live in the default `know` namespace and are NOT counted: with
 * no shadow record there is no subject identity, only slug equality, so a Know
 * article that merely shares a slug (body "Mercury" vs. the deity/element) would
 * surface as a false backlink. The prose migration already repoints genuinely
 * celestial-intended links into the `celestial` namespace, so this stays complete.
 * The join to `content_records` limits sources to article-backed pages.
 */
export async function getBacklinksForCelestial(slug: string) {
	return db
		.selectDistinct({
			slug: contentRecords.slug,
			title: contentRecords.title,
			domain: contentRecords.domain,
		})
		.from(contentLinks)
		.innerJoin(contentRecords, eq(contentLinks.sourceId, contentRecords.id))
		.where(and(
			eq(contentLinks.targetDomain, 'celestial'),
			sql`LOWER(${contentLinks.targetSlug}) = LOWER(${slug})`,
		))
		.orderBy(contentRecords.title)
}

/**
 * Just the columns needed to derive a star's habitable zone, by id. Lets a
 * planet page compute its parent star's HZ without building the star's full
 * model (which would run discarded planet/satellite COUNT subqueries).
 */
export async function getStarHzInputs(starId: number) {
	const [row] = await db
		.select({
			luminosityW: stars.luminosityW,
			radiusM: stars.radiusM,
			temperatureK: stars.temperatureK,
		})
		.from(stars)
		.where(eq(stars.id, starId))
	return row ?? null
}

/** Direct planets of a star (parentId null), ordered by orbital distance. */
export async function getPlanetsForStar(starId: number) {
	return db
		.select({
			id: planetaryBodies.id,
			name: planetaryBodies.name,
			slug: planetaryBodies.slug,
			semiMajorAxisAu: planetaryBodies.semiMajorAxisAu,
			bodyType: planetaryBodies.bodyType,
		})
		.from(planetaryBodies)
		.where(and(eq(planetaryBodies.starId, starId), isNull(planetaryBodies.parentId)))
		.orderBy(planetaryBodies.semiMajorAxisAu)
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
