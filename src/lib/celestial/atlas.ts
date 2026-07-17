/**
 * Pure helpers for the celestial atlas (the `/celestial` landing index).
 *
 * Kept out of the Svelte component so the grouping/search/sort logic is unit
 * testable and free of the reactivity lint rules — it operates on plain data
 * loaded from the registry queries.
 */
import { deriveSystemType } from './compute.js'
import { spectralColor } from './colors.js'

export interface AtlasSystem {
	id: number
	name: string
	slug: string
	starCount: number
	planetCount: number
}

export interface AtlasStar {
	id: number
	name: string
	slug: string
	spectralType: string | null
	color: string | null
	systemId: number | null
}

export interface AtlasBody {
	id: number
	name: string
	slug: string
	bodyType: string
	starId: number | null
	parentId: number | null
}

export interface EnrichedSystem {
	system: AtlasSystem
	/** Derived system type: single / binary / trinary / multiple. */
	type: string
	/** Distinct Morgan–Keenan classes present, in temperature order. */
	classes: string[]
	/** One dot per star, colored by spectral class or explicit color. */
	starDots: { name: string, color: string }[]
	moonCount: number
	/** Names of bodies in the system, for search. */
	bodyNames: string[]
	/** Lowercased system + star + body names, for substring search. */
	haystack: string
}

export const SYSTEM_TYPE_ORDER = ['single', 'binary', 'trinary', 'multiple']
export const SPECTRAL_CLASS_ORDER = ['O', 'B', 'A', 'F', 'G', 'K', 'M']

/** Attach per-system facets, counts, and a search haystack in a single pass. */
export function enrichSystems(systems: AtlasSystem[], stars: AtlasStar[], bodies: AtlasBody[]): EnrichedSystem[] {
	const starToSystem = new Map<number, number>()
	const starsBySystem = new Map<number, AtlasStar[]>()
	for (const star of stars) {
		if (star.systemId == null) continue
		starToSystem.set(star.id, star.systemId)
		const list = starsBySystem.get(star.systemId) ?? []
		list.push(star)
		starsBySystem.set(star.systemId, list)
	}

	const bodiesBySystem = new Map<number, AtlasBody[]>()
	const moonCounts = new Map<number, number>()
	for (const body of bodies) {
		const systemId = body.starId == null ? undefined : starToSystem.get(body.starId)
		if (systemId == null) continue
		const list = bodiesBySystem.get(systemId) ?? []
		list.push(body)
		bodiesBySystem.set(systemId, list)
		if (body.parentId != null) moonCounts.set(systemId, (moonCounts.get(systemId) ?? 0) + 1)
	}

	return systems.map((system) => {
		const systemStars = starsBySystem.get(system.id) ?? []
		const classes = [...new Set(
			systemStars
				.map(star => star.spectralType?.trim()?.[0]?.toUpperCase())
				.filter((cls): cls is string => !!cls && SPECTRAL_CLASS_ORDER.includes(cls)),
		)].toSorted((a, b) => SPECTRAL_CLASS_ORDER.indexOf(a) - SPECTRAL_CLASS_ORDER.indexOf(b))
		const bodyNames = (bodiesBySystem.get(system.id) ?? []).map(body => body.name)
		return {
			system,
			type: deriveSystemType(system.starCount),
			classes,
			starDots: systemStars.map(star => ({ name: star.name, color: spectralColor(star.spectralType, star.color) })),
			moonCount: moonCounts.get(system.id) ?? 0,
			bodyNames,
			haystack: [system.name, ...systemStars.map(s => s.name), ...bodyNames].join(' ').toLowerCase(),
		}
	})
}

export interface AtlasFilter {
	query: string
	types: string[]
	classes: string[]
	sort: 'name' | 'planets' | 'stars'
}

/** Filter by query + facets, then sort. Returns a new array. */
export function filterSystems(enriched: EnrichedSystem[], filter: AtlasFilter): EnrichedSystem[] {
	const query = filter.query.trim().toLowerCase()
	const matched = enriched.filter(entry =>
		(filter.types.length === 0 || filter.types.includes(entry.type))
		&& (filter.classes.length === 0 || entry.classes.some(cls => filter.classes.includes(cls)))
		&& (query === '' || entry.haystack.includes(query)),
	)
	if (filter.sort === 'planets') return matched.toSorted((a, b) => b.system.planetCount - a.system.planetCount)
	if (filter.sort === 'stars') return matched.toSorted((a, b) => b.system.starCount - a.system.starCount)
	return matched.toSorted((a, b) => a.system.name.localeCompare(b.system.name))
}

/** The body name (if any) that a query matched, when it wasn't the system name. */
export function matchedBodyName(entry: EnrichedSystem, query: string): string | null {
	const q = query.trim().toLowerCase()
	if (q === '' || entry.system.name.toLowerCase().includes(q)) return null
	return entry.bodyNames.find(name => name.toLowerCase().includes(q)) ?? null
}
