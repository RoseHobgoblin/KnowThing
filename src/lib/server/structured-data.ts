import { db } from './db/index.js'
import { stars, planetaryBodies, starSystems, phonemes, languages, languageDialects, lexicon, definitions, graphemes, graphemePhonemes } from './db/schema.js'
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

// Languages — {{Infobox language|from=<language-slug>}} pulls the structured
// languages row (+ ancestry chain + dialects) so Know infoboxes stop drifting
// from the Wordbook. Hand-typed args still override any pulled field.
DOMAIN_RESOLVERS['language'] = async (slug) => {
	const [lang] = await db.select().from(languages).where(eq(languages.slug, slug.toLowerCase()))
	if (!lang) return null

	const fields = new Map<string, string>([['name', lang.name]])
	if (lang.nativeName) fields.set('nativename', lang.nativeName)
	if (lang.script) fields.set('script', lang.script)
	if (lang.family) fields.set('family', lang.family)
	if (lang.color) fields.set('familycolor', lang.color)

	// Walk the parent chain (proto → … → parent) into ancestor1..N, linking
	// each ancestor's Wordbook page.
	const ancestors: string[] = []
	let parentId = lang.parentLanguageId
	for (let depth = 0; parentId != null && depth < 10; depth++) {
		const [parent] = await db
			.select({
				id: languages.id,
				name: languages.name,
				slug: languages.slug,
				parentLanguageId: languages.parentLanguageId,
				family: languages.family,
			})
			.from(languages)
			.where(eq(languages.id, parentId))
		if (!parent) break
		ancestors.unshift(`[[Wordbook/${parent.slug}|${parent.name}]]`)
		// Inherit family from the nearest ancestor that declares one.
		if (!fields.has('family') && parent.family) fields.set('family', parent.family)
		parentId = parent.parentLanguageId
	}
	for (const [index, ancestor] of ancestors.entries()) {
		fields.set(`ancestor${index + 1}`, ancestor)
	}
	if (ancestors.length > 0 && lang.languageType !== 'proto') {
		fields.set('protoname', ancestors[0].replace(/\[\[[^|]*\|([^\]]*)]]/, '$1'))
	}

	const dialects = await db
		.select({ name: languageDialects.name })
		.from(languageDialects)
		.where(eq(languageDialects.languageId, lang.id))
	for (const [index, dialect] of dialects.entries()) {
		fields.set(`ld${index + 1}`, dialect.name)
	}

	return fields
}
DOMAIN_RESOLVERS['conlang'] = DOMAIN_RESOLVERS['language']

// Lexicon entries — {{Infobox word|from=<language-slug>:<word>}}.
// Renders via the generic infobox (no dedicated word schema yet).
DOMAIN_RESOLVERS['word'] = async (ref) => {
	const [langSlug, ...wordParts] = ref.split(':')
	const word = wordParts.join(':').trim()
	if (!langSlug || !word) return null

	const [lang] = await db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.where(eq(languages.slug, langSlug.toLowerCase()))
	if (!lang) return null

	const [entry] = await db
		.select()
		.from(lexicon)
		.where(and(eq(lexicon.languageId, lang.id), sql`LOWER(${lexicon.word}) = LOWER(${word})`))
		.orderBy(asc(lexicon.homographNumber))
	if (!entry) return null

	const fields = new Map<string, string>([
		['name', entry.word],
		['language', `[[Wordbook/${lang.slug}|${lang.name}]]`],
	])
	if (entry.pronunciation) fields.set('pronunciation', entry.pronunciation)
	if (entry.etymology) fields.set('etymology', entry.etymology)
	if (entry.tags && entry.tags.length > 0) fields.set('tags', entry.tags.join(', '))

	const defs = await db
		.select({ partOfSpeech: definitions.partOfSpeech, definition: definitions.definition })
		.from(definitions)
		.where(eq(definitions.entryId, entry.id))
		.orderBy(asc(definitions.senseNumber))
	if (defs.length > 0) {
		if (defs[0].partOfSpeech) fields.set('part_of_speech', defs[0].partOfSpeech)
		fields.set('definition', defs.map((d, i) => (defs.length > 1 ? `${i + 1}. ${d.definition}` : d.definition)).join('<br>'))
	}

	return fields
}

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

async function loadPhonemesByType(slug: string, phonemeType: 'consonant' | 'vowel' | 'diphthong'): Promise<StructuredCollection | null> {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) return null
	const rows = await db
		.select()
		.from(phonemes)
		.where(and(eq(phonemes.languageId, lang.id), eq(phonemes.type, phonemeType)))
		.orderBy(asc(phonemes.sortOrder), asc(phonemes.id))
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

// Note: there is deliberately no 'phonology' resolver — {{Phonology|slug}}
// fans out into consonants+vowels refs at extraction time (parser/index.ts).
export const COLLECTION_RESOLVERS: Record<
	string,
	(slug: string) => Promise<StructuredCollection | null>
> = {
	consonants: slug => loadPhonemesByType(slug, 'consonant'),
	vowels: slug => loadPhonemesByType(slug, 'vowel'),
	diphthongs: slug => loadPhonemesByType(slug, 'diphthong'),
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
