import { db } from './db/index.js'
import { stars, planetaryBodies, starSystems } from './db/schema.js'
import { eq, sql } from 'drizzle-orm'
import type { FieldMap } from '$lib/infoboxes/types.js'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'

export interface SystemMapData {
	systemName: string
	stars: MapBody[]
	bodies: MapBody[]
}

/**
 * Convert a DB row to a FieldMap by mapping camelCase fields to snake_case keys.
 * Filters out null/undefined/empty values. Merges `extra` JSONB overflow.
 */
function rowToFieldMap(row: Record<string, unknown>, fieldNames: string[]): FieldMap {
	const map = new Map<string, string>()

	for (const field of fieldNames) {
		const value = row[field]
		if (value != null && value !== '') {
			// Convert camelCase to snake_case for FieldMap keys
			const key = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
			map.set(key, String(value))
		}
	}

	// Merge extra JSONB fields
	const extra = row.extra as Record<string, unknown> | undefined
	if (extra) {
		for (const [k, v] of Object.entries(extra)) {
			if (v != null && v !== '') {
				map.set(k, String(v))
			}
		}
	}

	return map
}

const STAR_FIELDS = [
	'name', 'spectralType', 'mass', 'radius', 'luminosity', 'luminosityVisual',
	'temperature', 'age', 'color', 'orbitalPeriod', 'semiMajorAxis',
	'periastron', 'apastron', 'apparentMagnitude', 'angularDiameter',
	'companion', 'description',
]

const PLANETARY_BODY_FIELDS = [
	'name', 'bodyType', 'mass', 'radius', 'density', 'surfaceGravity',
	'escapeVelocity', 'temperature', 'age', 'composition', 'atmosphere',
	'surfacePressure', 'orbitalPeriod', 'semiMajorAxis', 'rotationPeriod',
	'apparentMagnitude', 'angularDiameter', 'albedo', 'description',
]

/** Domain mapper registry: infobox type → table query + field mapper */
const DOMAIN_RESOLVERS: Record<string, (slug: string) => Promise<FieldMap | null>> = {
	star: async (slug) => {
		const [row] = await db.select().from(stars).where(eq(stars.slug, slug))
		if (!row) return null
		const fields = rowToFieldMap(row as unknown as Record<string, unknown>, STAR_FIELDS)
		if (row.eccentricity != null) fields.set('eccentricity', String(row.eccentricity))
		return fields
	},
	planet: async (slug) => {
		const [row] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
		if (!row) return null
		const fields = rowToFieldMap(row as unknown as Record<string, unknown>, PLANETARY_BODY_FIELDS)
		if (row.eccentricity != null) fields.set('eccentricity', String(row.eccentricity))
		if (row.axialTilt != null) fields.set('axial_tilt', String(row.axialTilt))
		if (row.inclination != null) fields.set('inclination', String(row.inclination))
		if (row.satellites != null) fields.set('satellites', String(row.satellites))
		if (row.hasRings) fields.set('has_rings', 'yes')
		return fields
	},
}

// moon, celestial all resolve to the planetary_bodies table
DOMAIN_RESOLVERS['moon'] = DOMAIN_RESOLVERS['planet']
DOMAIN_RESOLVERS['celestial'] = DOMAIN_RESOLVERS['planet']
DOMAIN_RESOLVERS['celestial body'] = DOMAIN_RESOLVERS['planet']

// Star systems — auto-computed from child stars and planets
DOMAIN_RESOLVERS['system'] = async (slug) => {
	const [system] = await db.select().from(starSystems).where(eq(starSystems.slug, slug))
	if (!system) return null

	// Fetch stars in this system
	const systemStars = await db.execute(sql`
		SELECT name, spectral_type, slug, page_slug
		FROM stars WHERE system_id = ${system.id}
		ORDER BY parent_star_id NULLS FIRST, name
	`)

	// Count planets
	const [counts] = await db.execute(sql`
		SELECT
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ${system.id} AND pb.body_type = 'planet')::int AS planets,
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ${system.id} AND pb.body_type = 'moon')::int AS moons
	`)

	const fields = new Map<string, string>()
	fields.set('name', system.name)
	fields.set('system_type', system.systemType ?? 'single')

	// Stars list
	const starNames = (systemStars as any[]).map((s: any) => {
		const link = s.page_slug ? `[[${s.page_slug}|${s.name}]]` : s.name
		return s.spectral_type ? `${link} (${s.spectral_type})` : link
	})
	fields.set('stars', starNames.join(', '))
	fields.set('star_count', String(systemStars.length))

	const c = counts as any
	if (c?.planets) fields.set('planets', String(c.planets))
	if (c?.moons) fields.set('moons', String(c.moons))

	if (system.description) fields.set('description', system.description)

	// Merge extra
	const extra = system.extra as Record<string, unknown> | undefined
	if (extra) {
		for (const [k, v] of Object.entries(extra)) {
			if (v != null && v !== '') fields.set(k, String(v))
		}
	}

	return fields
}
DOMAIN_RESOLVERS['star system'] = DOMAIN_RESOLVERS['system']
DOMAIN_RESOLVERS['planetary system'] = DOMAIN_RESOLVERS['system']

/**
 * Fetch full system map data for rendering {{System map|slug}}.
 */
export async function resolveSystemMapData(slug: string): Promise<SystemMapData | null> {
	const [system] = await db.select().from(starSystems).where(eq(starSystems.slug, slug))
	if (!system) return null

	const systemStars = await db.execute(sql`
		SELECT id, name, slug, spectral_type AS "spectralType", color,
			page_slug AS "pageSlug", semi_major_axis_au AS "semiMajorAxisAu",
			eccentricity, parent_star_id AS "parentStarId"
		FROM stars WHERE system_id = ${system.id}
		ORDER BY parent_star_id NULLS FIRST, name
	`)

	const systemBodies = await db.execute(sql`
		SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.page_slug AS "pageSlug", pb.semi_major_axis_au AS "semiMajorAxisAu",
			pb.eccentricity, pb.star_id AS "starId", pb.parent_id AS "parentId",
			(SELECT COUNT(*) FROM planetary_bodies m WHERE m.parent_id = pb.id)::int AS "moonCount"
		FROM planetary_bodies pb
		JOIN stars s ON s.id = pb.star_id
		WHERE s.system_id = ${system.id}
		ORDER BY pb.semi_major_axis_au NULLS LAST, pb.name
	`)

	return {
		systemName: system.name,
		stars: systemStars as unknown as MapBody[],
		bodies: systemBodies as unknown as MapBody[],
	}
}

/**
 * Batch-fetch system map data for multiple slugs.
 */
export async function resolveAllSystemMaps(slugs: string[]): Promise<Record<string, SystemMapData>> {
	const result: Record<string, SystemMapData> = {}
	await Promise.all(
		slugs.map(async slug => {
			const data = await resolveSystemMapData(slug)
			if (data) result[slug] = data
		}),
	)
	return result
}

/**
 * Resolve a `from=slug` reference for a given infobox type.
 * Returns a FieldMap if found, null if no resolver exists or slug not found.
 */
export async function resolveStructuredData(
	infoboxType: string,
	slug: string,
): Promise<FieldMap | null> {
	const resolver = DOMAIN_RESOLVERS[infoboxType]
	if (!resolver) return null
	return resolver(slug)
}

/**
 * Batch-resolve multiple from=slug references.
 * Returns a Map keyed by `${type}:${slug}` → FieldMap.
 */
export async function resolveAllStructuredData(
	refs: { type: string, slug: string }[],
): Promise<Map<string, FieldMap>> {
	const result = new Map<string, FieldMap>()

	await Promise.all(
		refs.map(async ({ type, slug }) => {
			const fields = await resolveStructuredData(type, slug)
			if (fields) {
				result.set(slug, fields)
			}
		}),
	)

	return result
}
