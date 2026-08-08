import { eq, and, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	celestialBodies,
	contentLinks,
	contentRecords,
} from '$lib/server/db/schema.js'
import { CELESTIAL_TREE_CTE } from '$lib/server/celestial/hierarchy.js'
import {
	annotateEffectivePeriods,
	type EffectiveOrbitStar,
	type EffectiveOrbitBody,
} from 'tungolcraft'

function periodSource(stored: boolean, period: number | null | undefined) {
	if (stored) return 'stored' as const
	return period == null ? 'unavailable' as const : 'derived' as const
}

/**
 * Read-side registry over the unified `celestial_bodies` table.
 *
 * The old three-table columns (`system_id`, `parent_star_id`, `star_id`,
 * `parent_id`) are derived from the single `parent_id` edge via the
 * `celestial_tree` CTE so every consumer (SystemMap, configure-form dropdowns,
 * manage-page grouping) keeps its field shapes:
 *  - systemId      = root of the parent chain when that root is a system
 *  - parentStarId  = direct parent when the parent is a star
 *  - starId        = nearest star ancestor
 *  - parentId      = direct parent when the parent is a body
 */

export async function listSystemsForRegistry() {
	return db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			ss.id, ss.name, ss.slug,
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = ss.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = ss.id AND t.kind = 'body')::int AS "planetCount"
		FROM celestial_bodies ss
		WHERE ss.kind = 'system'
		ORDER BY ss.name
	`)
}

export async function listStarsForRegistry() {
	return db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			s.id, s.name, s.slug, s.spectral_type AS "spectralType", s.color,
			CASE WHEN t.root_kind = 'system' THEN t.root_id END AS "systemId",
			s.semi_major_axis_au AS "semiMajorAxisAu", s.eccentricity,
			CASE WHEN p.kind = 'star' THEN s.parent_id END AS "parentStarId",
			(SELECT COUNT(*) FROM celestial_tree b WHERE b.kind = 'body' AND b.nearest_star_id = s.id)::int AS "planetCount"
		FROM celestial_bodies s
		JOIN celestial_tree t ON t.id = s.id
		LEFT JOIN celestial_bodies p ON p.id = s.parent_id
		WHERE s.kind = 'star'
		ORDER BY "parentStarId" NULLS FIRST, s.name
	`)
}

export async function listBodiesForRegistry() {
	return db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			t.nearest_star_id AS "starId",
			CASE WHEN p.kind = 'body' THEN pb.parent_id END AS "parentId",
			pb.semi_major_axis_au AS "semiMajorAxisAu", pb.eccentricity,
			(SELECT COUNT(*) FROM celestial_bodies m WHERE m.parent_id = pb.id AND m.kind = 'body')::int AS "moonCount"
		FROM celestial_bodies pb
		JOIN celestial_tree t ON t.id = pb.id
		LEFT JOIN celestial_bodies p ON p.id = pb.parent_id
		WHERE pb.kind = 'body'
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)
}

/**
 * Find any celestial entity by canonical slug or by wiki-slugified display
 * name (spaces → underscores, case-insensitive), so `[[Sunly system]]`-style
 * title links and old title-based URLs resolve without the retired
 * `page_slug` column.
 */
export async function findCelestialBySlugOrName(slug: string) {
	const [row] = await db.select().from(celestialBodies)
		.where(sql`LOWER(${celestialBodies.slug}) = LOWER(${slug}) OR LOWER(REPLACE(${celestialBodies.name}, ' ', '_')) = LOWER(${slug})`)
	return row ?? null
}

/**
 * Resolve any celestial input slug (real slug or underscored title) to its
 * canonical row slug. Used by the legacy `/celestial/[...path]` 308 redirect
 * stub.
 */
export async function resolveCelestialCanonicalSlug(slug: string): Promise<string | null> {
	const row = await findCelestialBySlugOrName(slug)
	return row?.slug ?? null
}

/**
 * Map rows for one system's stars and bodies, with `orbitalPeriodDays` filled
 * in at read time (Kepler from mass + semi-major axis) when not stored — the
 * DB keeps only user-asserted periods.
 */
export async function getSystemMapEntities(systemId: number) {
	const [stars, bodies] = await Promise.all([
		db.execute(sql`
			WITH RECURSIVE ${CELESTIAL_TREE_CTE}
			SELECT s.id, s.name, s.slug, s.spectral_type AS "spectralType", s.color,
				s.mass_kg AS "massKg",
				s.radius_m AS "radiusM",
				s.rotation_period_s AS "rotationPeriodS",
				s.axial_tilt AS "axialTilt",
				s.temperature_k AS "temperatureK",
				s.luminosity_w AS "luminosityW",
				s.extra -> 'stellarSurface' AS "stellarSurface",
				s.semi_major_axis_au AS "relativeSemiMajorAxisAu",
				-- SystemMap still consumes the shared display-oriented field name.
				-- Both aliases represent binary relative separation for stars.
				s.semi_major_axis_au AS "semiMajorAxisAu",
				s.eccentricity,
				s.inclination,
				s.longitude_ascending_node AS "longitudeAscendingNode",
				s.argument_of_periapsis AS "argumentOfPeriapsis",
				CASE WHEN p.kind = 'star' THEN s.parent_id END AS "parentStarId",
				CASE WHEN p.kind = 'system' THEN s.parent_id END AS "parentSystemId",
				s.orbital_period_days AS "orbitalPeriodDays",
				s.epoch_phase AS "epochPhase"
			FROM celestial_bodies s
			JOIN celestial_tree t ON t.id = s.id
			LEFT JOIN celestial_bodies p ON p.id = s.parent_id
			WHERE s.kind = 'star' AND t.root_id = ${systemId}
			ORDER BY "parentStarId" NULLS FIRST, s.name
		`),
		db.execute(sql`
			WITH RECURSIVE ${CELESTIAL_TREE_CTE}
			SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
				pb.mass_kg AS "massKg",
				pb.radius_m AS "radiusM",
				pb.rotation_period_s AS "rotationPeriodS",
				pb.axial_tilt AS "axialTilt",
				pb.temperature_k AS "temperatureK",
				pb.luminosity_w AS "luminosityW",
				pb.composition,
				pb.atmosphere,
				pb.has_rings AS "hasRings",
				pb.extra -> 'surface' AS surface,
				pb.extra -> 'weather' AS weather,
				pb.semi_major_axis_au AS "semiMajorAxisAu",
				pb.eccentricity,
				pb.inclination,
				pb.longitude_ascending_node AS "longitudeAscendingNode",
				pb.argument_of_periapsis AS "argumentOfPeriapsis",
				t.nearest_star_id AS "starId",
				CASE WHEN p.kind = 'body' THEN pb.parent_id END AS "parentId",
				CASE WHEN p.kind = 'system' THEN pb.parent_id END AS "parentSystemId",
				pb.orbital_period_days AS "orbitalPeriodDays",
				pb.epoch_phase AS "epochPhase",
				(SELECT COUNT(*) FROM celestial_bodies m WHERE m.parent_id = pb.id AND m.kind = 'body')::int AS "moonCount"
			FROM celestial_bodies pb
			JOIN celestial_tree t ON t.id = pb.id
			LEFT JOIN celestial_bodies p ON p.id = pb.parent_id
			WHERE pb.kind = 'body' AND t.root_id = ${systemId}
			ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
		`),
	])
	const starRows = stars as unknown as (EffectiveOrbitStar & Record<string, unknown>)[]
	const bodyRows = bodies as unknown as (EffectiveOrbitBody & Record<string, unknown>)[]
	const storedStarPeriods = new Set(starRows.filter(row => row.orbitalPeriodDays != null).map(row => row.id))
	const storedBodyPeriods = new Set(bodyRows.filter(row => row.orbitalPeriodDays != null).map(row => row.id))
	const annotated = annotateEffectivePeriods(starRows, bodyRows)
	return {
		stars: annotated.stars.map(row => ({
			...row,
			effectivePeriodSource: periodSource(storedStarPeriods.has(row.id), row.orbitalPeriodDays),
		})),
		bodies: annotated.bodies.map(row => ({
			...row,
			effectivePeriodSource: periodSource(storedBodyPeriods.has(row.id), row.orbitalPeriodDays),
		})),
	}
}

export async function getCalendarsForSystem(systemId: number) {
	return db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT c.id, c.name, c.static_data AS "staticData", c.planet_id AS "planetId"
		FROM calendars c
		WHERE c.planet_id IN (
			SELECT t.id FROM celestial_tree t WHERE t.kind = 'body' AND t.root_id = ${systemId}
		)
		OR c.planet_id IS NULL
		ORDER BY c.name
	`)
}

export async function getStarSystemRef(systemId: number) {
	const [sys] = await db
		.select({ slug: celestialBodies.slug, name: celestialBodies.name })
		.from(celestialBodies)
		.where(and(eq(celestialBodies.id, systemId), eq(celestialBodies.kind, 'system')))
	return sys ?? null
}

/** The system a star belongs to: the root of its parent chain, if a system. */
export async function getStarSystemId(starId: number) {
	const [row] = await db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT CASE WHEN t.root_kind = 'system' THEN t.root_id END AS "systemId"
		FROM celestial_tree t WHERE t.id = ${starId}
	`)
	return (row as unknown as { systemId?: number | null })?.systemId ?? null
}

export async function listAllSystemReferences() {
	return db
		.select({ id: celestialBodies.id, name: celestialBodies.name })
		.from(celestialBodies)
		.where(eq(celestialBodies.kind, 'system'))
		.orderBy(celestialBodies.name)
}

export interface StarReference {
	id: number
	name: string
	slug: string
	massKg: number | null
	spectralType: string | null
	temperatureK: number | null
	/** Root of the parent chain when that root is a system. */
	systemId: number | null
	/** Direct parent when the parent is a star (companion relationship). */
	parentStarId: number | null
}

export async function listAllStarReferences(): Promise<StarReference[]> {
	const rows = await db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT s.id, s.name, s.slug, s.mass_kg AS "massKg",
			s.spectral_type AS "spectralType", s.temperature_k AS "temperatureK",
			CASE WHEN t.root_kind = 'system' THEN t.root_id END AS "systemId",
			CASE WHEN p.kind = 'star' THEN s.parent_id END AS "parentStarId"
		FROM celestial_bodies s
		JOIN celestial_tree t ON t.id = s.id
		LEFT JOIN celestial_bodies p ON p.id = s.parent_id
		WHERE s.kind = 'star'
		ORDER BY s.name
	`)
	return rows as unknown as StarReference[]
}

export interface BodyReference {
	id: number
	name: string
	slug: string
	massKg: number | null
	radiusM: number | null
	/** Nearest star ancestor. */
	starId: number | null
	/** Direct parent when the parent is a body (moon relationship). */
	parentId: number | null
	/** Direct parent when the parent is a system (circumbinary orbit). */
	parentSystemId: number | null
	/** Root of the parent chain when that root is a system. */
	rootSystemId: number | null
	semiMajorAxisAu: number | null
	eccentricity: number | null
	bodyType: string | null
}

export async function listAllBodyReferences(): Promise<BodyReference[]> {
	const rows = await db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT pb.id, pb.name, pb.slug, pb.mass_kg AS "massKg", pb.radius_m AS "radiusM",
			t.nearest_star_id AS "starId",
			CASE WHEN p.kind = 'body' THEN pb.parent_id END AS "parentId",
			CASE WHEN p.kind = 'system' THEN pb.parent_id END AS "parentSystemId",
			CASE WHEN t.root_kind = 'system' THEN t.root_id END AS "rootSystemId",
			pb.semi_major_axis_au AS "semiMajorAxisAu", pb.eccentricity,
			pb.body_type AS "bodyType"
		FROM celestial_bodies pb
		JOIN celestial_tree t ON t.id = pb.id
		LEFT JOIN celestial_bodies p ON p.id = pb.parent_id
		WHERE pb.kind = 'body'
		ORDER BY pb.name
	`)
	return rows as unknown as BodyReference[]
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
			luminosityW: celestialBodies.luminosityW,
			radiusM: celestialBodies.radiusM,
			temperatureK: celestialBodies.temperatureK,
		})
		.from(celestialBodies)
		.where(and(eq(celestialBodies.id, starId), eq(celestialBodies.kind, 'star')))
	return row ?? null
}

/** Direct planets of a star (its immediate child bodies), by orbital distance. */
export async function getPlanetsForStar(starId: number) {
	return db
		.select({
			id: celestialBodies.id,
			name: celestialBodies.name,
			slug: celestialBodies.slug,
			semiMajorAxisAu: celestialBodies.semiMajorAxisAu,
			bodyType: celestialBodies.bodyType,
		})
		.from(celestialBodies)
		.where(and(eq(celestialBodies.parentId, starId), eq(celestialBodies.kind, 'body')))
		.orderBy(celestialBodies.semiMajorAxisAu)
}
