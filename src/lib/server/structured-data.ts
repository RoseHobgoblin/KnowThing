import { db } from './db/index.js'
import { stars, planetaryBodies, starSystems, phonemes, languages, graphemes, graphemePhonemes } from './db/schema.js'
import { eq, and, sql, asc, inArray } from 'drizzle-orm'
import type { FieldMap } from '$lib/infoboxes/types.js'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'
import { deriveSystemType } from '$lib/celestial/compute.js'
import {
	derivePlanet, deriveStar,
	type PlanetModel, type StarModel, type PlanetRow, type StarRow,
} from '$lib/celestial/models.js'
import { planetInfoboxFields, starInfoboxFields } from '$lib/celestial/projections.js'

export interface SystemMapData {
	systemName: string
	stars: MapBody[]
	bodies: MapBody[]
}

/**
 * Fetch a planet's relations (parent star + parent body, with masses) and build
 * the typed model. The model — not a FieldMap — is the canonical representation;
 * every consumer projects from it.
 */
async function buildPlanetModel(row: PlanetRow & { starId?: number | null, parentId?: number | null }): Promise<PlanetModel> {
	let star: { name: string, slug: string, massKg: number | null } | null = null
	let parentBody: { name: string, slug: string, massKg: number | null } | null = null

	if (row.parentId != null) {
		const [parent] = await db.select({ name: planetaryBodies.name, slug: planetaryBodies.slug, massKg: planetaryBodies.massKg })
			.from(planetaryBodies).where(eq(planetaryBodies.id, row.parentId))
		parentBody = parent ?? null
	}
	if (row.starId != null) {
		const [s] = await db.select({ name: stars.name, slug: stars.slug, massKg: stars.massKg })
			.from(stars).where(eq(stars.id, row.starId))
		star = s ?? null
	}

	return derivePlanet(row, { star, parentBody })
}

/** Fetch a star's relations (parent star + planet/satellite counts) and build the model. */
async function buildStarModel(row: StarRow & { id: number, parentStarId?: number | null }): Promise<StarModel> {
	let parentStar: { name: string, slug: string } | null = null
	if (row.parentStarId != null) {
		const [parent] = await db.select({ name: stars.name, slug: stars.slug })
			.from(stars).where(eq(stars.id, row.parentStarId))
		parentStar = parent ?? null
	}

	const [counts] = await db.execute(sql`
		SELECT
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = ${row.id} AND parent_id IS NULL)::int AS planets,
			(SELECT COUNT(*) FROM planetary_bodies WHERE star_id = ${row.id} AND parent_id IS NOT NULL)::int AS satellites
	`)
	const c = counts as unknown as { planets?: number, satellites?: number } | undefined

	return deriveStar(row, {
		parentStar,
		planetCount: c?.planets ?? 0,
		satelliteCount: c?.satellites ?? 0,
	})
}

/**
 * Resolve the typed model for a celestial entity — the model-layer entry point
 * used by pages/consumers that want structured data rather than infobox fields.
 */
export async function resolveCelestialModel(type: string, slug: string): Promise<PlanetModel | StarModel | null> {
	if (type === 'star') {
		const [row] = await db.select().from(stars).where(eq(stars.slug, slug))
		return row ? buildStarModel(row) : null
	}
	if (type === 'planet' || type === 'celestial' || type === 'celestial body') {
		const [row] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
		return row ? buildPlanetModel(row) : null
	}
	return null
}

/** Domain mapper registry: infobox type → table query + field mapper */
const DOMAIN_RESOLVERS: Record<string, (slug: string) => Promise<FieldMap | null>> = {
	star: async (slug) => {
		const [row] = await db.select().from(stars).where(eq(stars.slug, slug))
		if (!row) return null
		return starInfoboxFields(await buildStarModel(row))
	},
	planet: async (slug) => {
		const [row] = await db.select().from(planetaryBodies).where(eq(planetaryBodies.slug, slug))
		if (!row) return null
		return planetInfoboxFields(await buildPlanetModel(row))
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

	const fields = new Map<string, string>([
		['name', system.name],
		['system_type', deriveSystemType(systemStars.length, system.systemType)],
	])

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

	// System-level placement / metadata (non-derivable, edited via the system configure form)
	if (system.distanceLy != null) fields.set('distance', `${system.distanceLy.toLocaleString('en-US', { maximumFractionDigits: 2 })} ly`)
	if (system.galacticX != null && system.galacticY != null && system.galacticZ != null) {
		const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
		fields.set('coordinates', `(${fmt(system.galacticX)}, ${fmt(system.galacticY)}, ${fmt(system.galacticZ)}) ly`)
	}
	if (system.formationAge) fields.set('formation_age', system.formationAge)
	if (system.designations) fields.set('designations', system.designations)

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
			eccentricity, parent_star_id AS "parentStarId",
			orbital_period_days AS "orbitalPeriodDays", epoch_phase AS "epochPhase"
		FROM stars WHERE system_id = ${system.id}
		ORDER BY parent_star_id NULLS FIRST, name
	`)

	const systemBodies = await db.execute(sql`
		SELECT pb.id, pb.name, pb.slug, pb.body_type AS "bodyType",
			pb.page_slug AS "pageSlug", pb.semi_major_axis_au AS "semiMajorAxisAu",
			pb.eccentricity, pb.star_id AS "starId", pb.parent_id AS "parentId",
			pb.orbital_period_days AS "orbitalPeriodDays", pb.epoch_phase AS "epochPhase",
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

async function loadOrthography(slug: string): Promise<StructuredCollection | null> {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) return null

	const rows = await db
		.select({
			id: graphemes.id,
			grapheme: graphemes.grapheme,
			romanization: graphemes.romanization,
			environment: graphemes.environment,
			notes: graphemes.notes,
			sortOrder: graphemes.sortOrder,
		})
		.from(graphemes)
		.where(eq(graphemes.languageId, lang.id))
		.orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

	if (rows.length === 0) return []

	const links = await db
		.select({
			graphemeId: graphemePhonemes.graphemeId,
			position: graphemePhonemes.position,
			ipa: phonemes.ipa,
			type: phonemes.type,
		})
		.from(graphemePhonemes)
		.innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
		.where(inArray(graphemePhonemes.graphemeId, rows.map(r => r.id)))
		.orderBy(asc(graphemePhonemes.graphemeId), asc(graphemePhonemes.position))

	const byId = new Map<number, { ipa: string, type: string }[]>()
	for (const l of links) {
		if (!byId.has(l.graphemeId)) byId.set(l.graphemeId, [])
		byId.get(l.graphemeId)!.push({ ipa: l.ipa, type: l.type })
	}

	return rows.map(r => ({ ...r, phonemes: byId.get(r.id) ?? [] })) as unknown as StructuredCollection
}

export const COLLECTION_RESOLVERS: Record<
	string,
	(slug: string) => Promise<StructuredCollection | null>
> = {
	consonants: slug => loadPhonemesByType(slug, 'consonant'),
	vowels: slug => loadPhonemesByType(slug, 'vowel'),
	phonology: loadPhonology,
	orthography: loadOrthography,
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
