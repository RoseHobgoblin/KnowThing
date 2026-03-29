import { db } from './db/index.js'
import { stars, planetaryBodies } from './db/schema.js'
import { eq } from 'drizzle-orm'
import type { FieldMap } from '$lib/infoboxes/types.js'

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

// moon, dwarf_planet, celestial all resolve to the planetary_bodies table
DOMAIN_RESOLVERS['moon'] = DOMAIN_RESOLVERS['planet']
DOMAIN_RESOLVERS['celestial'] = DOMAIN_RESOLVERS['planet']
DOMAIN_RESOLVERS['celestial body'] = DOMAIN_RESOLVERS['planet']

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
