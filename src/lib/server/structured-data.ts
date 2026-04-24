import { db } from './db/index.js'
import { stars, planetaryBodies, starSystems, phonemes, languages } from './db/schema.js'
import { eq, and, sql, asc } from 'drizzle-orm'
import type { FieldMap } from '$lib/infoboxes/types.js'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'
import {
	computePeriastron, computeApastron, formatAu,
	computeOrbitalVelocity, formatOrbitalVelocity,
	computeOrbitalPeriodDays, formatPeriod,
	computeHabitableZoneAu,
	formatMass, formatRadius, formatTemperatureK, formatLuminosity,
	formatAuAsKm, deriveBodyFields,
} from '$lib/celestial/compute.js'

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
			const key = field.replaceAll(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
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
	'name', 'spectralType', 'luminosityVisual',
	'age', 'color', 'metallicity',
	'apparentMagnitude', 'absoluteMagnitude',
	'angularDiameter', 'companion', 'description',
]

const PLANETARY_BODY_FIELDS = [
	'name', 'bodyType', 'temperature', 'age', 'composition', 'atmosphere',
	'surfacePressure', 'apparentMagnitude', 'angularDiameter', 'albedo',
	'description',
]

interface NumericRow {
	massKg: number | null
	radiusM: number | null
	orbitalPeriodDays: number | null
	semiMajorAxisAu: number | null
	rotationPeriodS: number | null
}

/** Compute display strings from numeric values and insert into a FieldMap. */
function addDerivedDisplayFields(fields: FieldMap, row: NumericRow): void {
	if (row.massKg != null && row.massKg > 0) fields.set('mass', formatMass(row.massKg))
	if (row.radiusM != null && row.radiusM > 0) fields.set('radius', formatRadius(row.radiusM))
	const phys = deriveBodyFields(row.massKg ?? null, row.radiusM ?? null)
	if (phys.density) fields.set('density', phys.density)
	if (phys.surfaceGravity) fields.set('surface_gravity', phys.surfaceGravity)
	if (phys.escapeVelocity) fields.set('escape_velocity', phys.escapeVelocity)
	if (row.orbitalPeriodDays != null && row.orbitalPeriodDays > 0) fields.set('orbital_period', formatPeriod(row.orbitalPeriodDays * 86_400))
	if (row.semiMajorAxisAu != null && row.semiMajorAxisAu > 0) fields.set('semi_major_axis', formatAuAsKm(row.semiMajorAxisAu))
	if (row.rotationPeriodS != null && row.rotationPeriodS > 0) fields.set('rotation_period', formatPeriod(row.rotationPeriodS))
}

/** Domain mapper registry: infobox type → table query + field mapper */
const DOMAIN_RESOLVERS: Record<string, (slug: string) => Promise<FieldMap | null>> = {
	star: async (slug) => {
		const [row] = await db.select().from(stars).where(eq(stars.slug, slug))
		if (!row) return null
		const fields = rowToFieldMap(row as unknown as Record<string, unknown>, STAR_FIELDS)
		addDerivedDisplayFields(fields, row)
		if (row.temperatureK != null && row.temperatureK > 0) fields.set('temperature', formatTemperatureK(row.temperatureK))
		if (row.luminosityW != null && row.luminosityW > 0) fields.set('luminosity', formatLuminosity(row.luminosityW))
		if (row.semiMajorAxisAu != null && row.eccentricity != null) {
			fields.set('periastron', formatAu(computePeriastron(row.semiMajorAxisAu, row.eccentricity)))
			fields.set('apastron', formatAu(computeApastron(row.semiMajorAxisAu, row.eccentricity)))
		}
		if (row.eccentricity != null) fields.set('eccentricity', String(row.eccentricity))
		if (row.axialTilt != null) fields.set('axial_tilt', String(row.axialTilt))

		// Parent star context for companions
		if (row.parentStarId != null) {
			const [parent] = await db.select({ name: stars.name, slug: stars.slug })
				.from(stars).where(eq(stars.id, row.parentStarId))
			if (parent) {
				fields.set('companion_of', parent.name)
				fields.set('companion_of_slug', parent.slug)
			}
		}

		// Habitable zone from luminosity
		if (row.luminosityW != null && row.luminosityW > 0) {
			const hz = computeHabitableZoneAu(row.luminosityW)
			fields.set('habitable_zone', `${hz.inner.toFixed(2)} – ${hz.outer.toFixed(2)} AU`)
		}

		// Equatorial rotation velocity
		if (row.radiusM != null && row.rotationPeriodS != null && row.radiusM > 0 && row.rotationPeriodS > 0) {
			const eqVel = (2 * Math.PI * row.radiusM) / row.rotationPeriodS
			fields.set('equatorial_velocity', `${(eqVel / 1000).toFixed(2)} km/s`)
		}

		// Planet count
		const [counts] = await db.execute(sql`
			SELECT
				(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = ${row.id} AND parent_id IS NULL)::int AS planets,
				(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = ${row.id} AND parent_id IS NOT NULL)::int AS satellites
		`)
		const c = counts as any
		if (c?.planets) fields.set('planets', String(c.planets))
		if (c?.satellites) fields.set('known_satellites', String(c.satellites))

		return fields
	},
	planet: async (slug) => {
		const [row] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
		if (!row) return null
		const fields = rowToFieldMap(row as unknown as Record<string, unknown>, PLANETARY_BODY_FIELDS)
		addDerivedDisplayFields(fields, row)
		if (row.eccentricity != null) fields.set('eccentricity', String(row.eccentricity))
		if (row.axialTilt != null) fields.set('axial_tilt', String(row.axialTilt))
		if (row.inclination != null) fields.set('inclination', String(row.inclination))
		if (row.satellites != null) fields.set('satellites', String(row.satellites))
		if (row.hasRings) fields.set('has_rings', 'yes')

		// Parent body context
		if (row.parentId != null) {
			const [parent] = await db.select({ name: planetaryBodies.name, slug: planetaryBodies.slug })
				.from(planetaryBodies).where(eq(planetaryBodies.id, row.parentId))
			if (parent) {
				fields.set('satellite_of', parent.name)
				fields.set('satellite_of_slug', parent.slug)
			}
		}

		// Parent star name
		if (row.starId != null) {
			const [star] = await db.select({ name: stars.name, slug: stars.slug, massKg: stars.massKg })
				.from(stars).where(eq(stars.id, row.starId))
			if (star) {
				if (!row.parentId) fields.set('satellite_of', star.name)
				fields.set('parent_star', star.name)
				fields.set('parent_star_slug', star.slug)

				// Kepler-derived orbital period if not stored
				if (row.orbitalPeriodDays == null && row.semiMajorAxisAu != null && star.massKg != null) {
					const period = computeOrbitalPeriodDays(row.semiMajorAxisAu, star.massKg)
					fields.set('orbital_period', formatPeriod(period * 86_400))
				}
			}
		}

		// Computed orbital fields
		if (row.semiMajorAxisAu != null && row.eccentricity != null) {
			fields.set('periapsis', formatAu(computePeriastron(row.semiMajorAxisAu, row.eccentricity)))
			fields.set('apoapsis', formatAu(computeApastron(row.semiMajorAxisAu, row.eccentricity)))
		}
		if (row.semiMajorAxisAu != null && row.orbitalPeriodDays != null && row.orbitalPeriodDays > 0) {
			fields.set('orbital_velocity', formatOrbitalVelocity(computeOrbitalVelocity(row.semiMajorAxisAu, row.orbitalPeriodDays)))
		}

		// Computed physical fields from radius
		if (row.radiusM != null && row.radiusM > 0) {
			const r = row.radiusM
			fields.set('circumference', `${((2 * Math.PI * r) / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`)
			fields.set('surface_area', `${((4 * Math.PI * r * r) / 1e6).toExponential(3)} km²`)
			fields.set('volume', `${((4 / 3 * Math.PI * r * r * r) / 1e9).toExponential(3)} km³`)

			if (row.rotationPeriodS != null && row.rotationPeriodS > 0) {
				const eqVel = (2 * Math.PI * r) / row.rotationPeriodS
				fields.set('equatorial_velocity', `${eqVel.toFixed(eqVel >= 100 ? 0 : 1)} m/s`)
			}
		}

		return fields
	},
}

// celestial aliases all resolve to the planetary_bodies table
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
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ${system.id} AND pb.parent_id IS NULL)::int AS planets,
			(SELECT COUNT(*) FROM planetary_bodies pb JOIN stars s ON s.id = pb.star_id WHERE s.system_id = ${system.id} AND pb.parent_id IS NOT NULL)::int AS satellites
	`)

	const fields = new Map<string, string>([['name', system.name], ['system_type', system.systemType ?? 'single']])

	// Stars list
	const starNames = (systemStars as any[]).map((s: any) => {
		const link = s.page_slug ? `[[${s.page_slug}|${s.name}]]` : s.name
		return s.spectral_type ? `${link} (${s.spectral_type})` : link
	})
	fields.set('stars', starNames.join(', '))
	fields.set('star_count', String(systemStars.length))

	const c = counts as any
	if (c?.planets) fields.set('planets', String(c.planets))
	if (c?.satellites) fields.set('satellites', String(c.satellites))

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
		slugs.map(async (slug) => {
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
	references: { type: string, slug: string }[],
): Promise<Map<string, FieldMap>> {
	const result = new Map<string, FieldMap>()

	await Promise.all(
		references.map(async ({ type, slug }) => {
			const fields = await resolveStructuredData(type, slug)
			if (fields) {
				result.set(slug, fields)
			}
		}),
	)

	return result
}

// ============================================================================
// Collection resolvers — for array-shaped structured data (tables, grids).
// Keyed by `${type}:${slug}` since two collection types share a language slug.
// ============================================================================

export type StructuredCollection = Record<string, unknown>[]
export interface CollectionRef { type: string, slug: string }

async function loadPhonemesByType(slug: string, phonemeType: 'consonant' | 'vowel'): Promise<StructuredCollection | null> {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) return null
	const rows = await db
		.select()
		.from(phonemes)
		.where(and(eq(phonemes.languageId, lang.id), eq(phonemes.type, phonemeType)))
		.orderBy(asc(phonemes.sortOrder), asc(phonemes.id))
	return rows as unknown as StructuredCollection
}

async function loadPhonology(slug: string): Promise<StructuredCollection | null> {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) return null
	const rows = await db
		.select()
		.from(phonemes)
		.where(eq(phonemes.languageId, lang.id))
		.orderBy(asc(phonemes.type), asc(phonemes.sortOrder), asc(phonemes.id))
	return rows as unknown as StructuredCollection
}

export const COLLECTION_RESOLVERS: Record<
	string,
	(slug: string) => Promise<StructuredCollection | null>
> = {
	consonants: slug => loadPhonemesByType(slug, 'consonant'),
	vowels: slug => loadPhonemesByType(slug, 'vowel'),
	phonology: loadPhonology,
}

export async function resolveStructuredCollection(
	type: string,
	slug: string,
): Promise<StructuredCollection | null> {
	const resolver = COLLECTION_RESOLVERS[type]
	if (!resolver) return null
	return resolver(slug)
}

/**
 * Batch-resolve array-shaped structured data (phoneme grids, etc).
 * Returns a Map keyed by `${type}:${slug}` → array of row objects.
 */
export async function resolveAllStructuredCollections(
	references: CollectionRef[],
): Promise<Map<string, StructuredCollection>> {
	const result = new Map<string, StructuredCollection>()
	await Promise.all(
		references.map(async ({ type, slug }) => {
			const rows = await resolveStructuredCollection(type, slug)
			if (rows) result.set(`${type}:${slug}`, rows)
		}),
	)
	return result
}
