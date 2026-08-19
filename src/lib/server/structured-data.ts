import { db } from './db/index.js'
import { rodderBodies, phonemes, languages, languageDialects, lexicon, definitions, graphemes, graphemePhonemes } from './db/schema.js'
import { eq, and, or, sql, asc, inArray } from 'drizzle-orm'
import type { FieldMap } from '$lib/infoboxes/types.js'
import type { MapBody } from '$lib/rodder/root-layout.js'
import type { ApparentSkyResult } from '$lib/rodder/apparent-sky.js'
import {
	deriveBody, deriveStar,
	type BodyModel, type StarModel, type BodyRow, type StarRow,
} from 'tungolcraft'
import { rodderDocumentInfoboxFields } from '$lib/rodder/projections.js'
import { RODDER_TREE_CTE, findNearestStarAncestor } from '$lib/server/rodder/hierarchy.js'
import { resolveRodderEntityDocument } from '$lib/server/services/rodder-documents.js'

export interface RootMapData {
	rootName: string
	stars: MapBody[]
	bodies: MapBody[]
	apparentSky: ApparentSkyResult
}

/** Total mass of a system's stars — the effective mass of its barycenter. */
async function systemStellarMassKg(systemId: number): Promise<number | null> {
	const [row] = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT SUM(cb.mass_kg)::double precision AS "massKg"
		FROM rodder_bodies cb
		JOIN rodder_tree t ON t.id = cb.id
		WHERE cb.kind = 'star' AND t.root_id = ${systemId}
	`)
	const mass = (row as unknown as { massKg: number | null } | undefined)?.massKg
	return mass != null && mass > 0 ? mass : null
}

/**
 * Fetch a body's relations (parent star / parent body / parent system, with
 * masses, plus its moon count) and build the typed model. The model — not a
 * FieldMap — is the canonical representation; every consumer projects from it.
 */
async function buildBodyModel(row: BodyRow & { id: number, parentId?: number | null }): Promise<BodyModel> {
	let star: { name: string, slug: string, massKg: number | null } | null = null
	let parentBody: { name: string, slug: string, massKg: number | null } | null = null
	let system: { name: string, slug: string, massKg: number | null } | null = null

	if (row.parentId != null) {
		const [parent] = await db
			.select({ kind: rodderBodies.kind, name: rodderBodies.name, slug: rodderBodies.slug, massKg: rodderBodies.massKg })
			.from(rodderBodies).where(eq(rodderBodies.id, row.parentId))
		if (parent?.kind === 'body') parentBody = parent
		if (parent?.kind === 'system') {
			// Circumbinary: the primary is the system barycenter, whose effective
			// mass is the total mass of the system's stars.
			system = { name: parent.name, slug: parent.slug, massKg: await systemStellarMassKg(row.parentId) }
		} else {
			// The nearest star ancestor is the direct parent for a planet, or the
			// grandparent chain's star for a moon.
			star = parent?.kind === 'star' ? parent : await findNearestStarAncestor(row.parentId)
		}
	}

	const [{ count: moonCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(rodderBodies)
		.where(and(eq(rodderBodies.parentId, row.id), eq(rodderBodies.kind, 'body')))

	return deriveBody(row, { star, parentBody, system, moonCount })
}

/** Fetch a star's relations (parent star / barycenter mass + planet/satellite counts) and build the model. */
async function buildStarModel(row: StarRow & { id: number, parentId?: number | null }): Promise<StarModel> {
	let parentStar: { name: string, slug: string, massKg: number | null } | null = null
	let barycenterMassKg: number | null = null
	let parentSystemId: number | null = null
	if (row.parentId != null) {
		const [parent] = await db
			.select({ kind: rodderBodies.kind, name: rodderBodies.name, slug: rodderBodies.slug, massKg: rodderBodies.massKg })
			.from(rodderBodies).where(eq(rodderBodies.id, row.parentId))
		if (parent?.kind === 'star') parentStar = { name: parent.name, slug: parent.slug, massKg: parent.massKg }
		if (parent?.kind === 'system') {
			parentSystemId = row.parentId
			// A star orbiting its system orbits the barycenter — its period derives
			// from the system's total stellar mass. Only fetched when there is an
			// orbit to derive (primaries without orbital elements skip the query).
			if (row.semiMajorAxisAu != null && row.semiMajorAxisAu > 0) {
				barycenterMassKg = await systemStellarMassKg(row.parentId)
			}
		}
	}

	// Companions are never stored — they derive from the graph: child stars
	// orbiting this one, plus co-components of the same barycenter.
	const companions = await db
		.select({ name: rodderBodies.name, slug: rodderBodies.slug })
		.from(rodderBodies)
		.where(and(
			eq(rodderBodies.kind, 'star'),
			sql`${rodderBodies.id} <> ${row.id}`,
			parentSystemId == null
				? eq(rodderBodies.parentId, row.id)
				: or(eq(rodderBodies.parentId, row.id), eq(rodderBodies.parentId, parentSystemId)),
		))
		.orderBy(rodderBodies.name)

	// Planets orbit the star directly; satellites are every deeper body whose
	// nearest star ancestor is this one (moons, submoons, …).
	const [counts] = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.kind = 'body' AND t.parent_id = ${row.id})::int AS planets,
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.kind = 'body' AND t.nearest_star_id = ${row.id} AND t.parent_id <> ${row.id})::int AS satellites
	`)
	const c = counts as unknown as { planets?: number, satellites?: number } | undefined

	return deriveStar(row, {
		parentStar,
		barycenterMassKg,
		companions,
		planetCount: c?.planets ?? 0,
		satelliteCount: c?.satellites ?? 0,
	})
}

/**
 * Resolve the typed model for a rodder entity — the model-layer entry point
 * used by pages/consumers that want structured data rather than infobox fields.
 */
export async function resolveRodderModel(type: string, slug: string): Promise<BodyModel | StarModel | null> {
	if (type === 'star') {
		const [row] = await db.select().from(rodderBodies)
			.where(and(eq(rodderBodies.slug, slug), eq(rodderBodies.kind, 'star')))
		return row ? buildStarModel(row) : null
	}
	// 'body' is the canonical internal kind; 'planet'/'rodder'/'rodder body'
	// remain as user-facing infobox template vocabulary.
	if (type === 'body' || type === 'planet' || type === 'rodder' || type === 'rodder body') {
		const [row] = await db.select().from(rodderBodies)
			.where(and(eq(rodderBodies.slug, slug), eq(rodderBodies.kind, 'body')))
		return row ? buildBodyModel(row) : null
	}
	return null
}

/** Domain mapper registry: infobox type → table query + field mapper */
const DOMAIN_RESOLVERS: Record<string, (slug: string) => Promise<FieldMap | null>> = {
	star: async (slug) => {
		const document = await resolveRodderEntityDocument(slug)
		return document ? rodderDocumentInfoboxFields(document) : null
	},
	planet: async (slug) => {
		const document = await resolveRodderEntityDocument(slug)
		return document ? rodderDocumentInfoboxFields(document) : null
	},
}

// rodder aliases all resolve to the planetary_bodies table
DOMAIN_RESOLVERS['rodder'] = DOMAIN_RESOLVERS['planet']
DOMAIN_RESOLVERS['rodder body'] = DOMAIN_RESOLVERS['planet']

// Star systems — auto-computed from child stars and planets
DOMAIN_RESOLVERS['system'] = async (slug) => {
	const document = await resolveRodderEntityDocument(slug)
	return document ? rodderDocumentInfoboxFields(document) : null
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
		fields.set('definition', defs.map((d, index) => (defs.length > 1 ? `${index + 1}. ${d.definition}` : d.definition)).join('<br>'))
	}

	return fields
}

/**
 * Fetch full root map data for rendering {{Root map|slug}}.
 */
export async function resolveRootMapData(slug: string): Promise<RootMapData | null> {
	const document = await resolveRodderEntityDocument(slug)
	const display = document?.displays.rootMap
	if (!display) return null
	return {
		rootName: display.rootName,
		stars: display.stars as unknown as MapBody[],
		bodies: display.bodies as unknown as MapBody[],
		apparentSky: display.apparentSky,
	}
}

/**
 * Batch-fetch root map data for multiple slugs.
 */
export async function resolveAllRootMaps(slugs: string[]): Promise<Record<string, RootMapData>> {
	const result: Record<string, RootMapData> = {}
	await Promise.all(
		slugs.map(async (slug) => {
			const data = await resolveRootMapData(slug)
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
