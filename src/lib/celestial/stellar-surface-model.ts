import {
	mediaAssetContentUrl,
	parseMediaAssetBinding,
	type MediaAssetBinding,
} from '$lib/media/asset-binding.js'

export const STELLAR_SURFACE_RECIPE_VERSION = 2 as const

export type StellarSurfaceFallback = 'procedural' | 'flat'
export type StellarMorphology = 'auto' | 'main_sequence' | 'giant' | 'white_dwarf'
export type ResolvedStellarMorphology = Exclude<StellarMorphology, 'auto'>
export type StellarPhotosphereSource = 'uploaded' | 'procedural' | 'constant'

export type StellarSurfaceRecipe = {
	version: typeof STELLAR_SURFACE_RECIPE_VERSION
	fallback: StellarSurfaceFallback
	morphology: StellarMorphology
	seed: number | null
	/** Starwright appearance control, not a standardized activity measurement. */
	activity: number | null
	maps: { photosphere?: MediaAssetBinding }
}

export type StellarSurfaceBodyInput = {
	id: number
	slug: string
	spectralType?: string | null
	temperatureK?: number | null
	rotationPeriodS?: number | null
}

export type StellarSurfacePlan = {
	recipe: StellarSurfaceRecipe
	morphology: ResolvedStellarMorphology
	morphologySource: 'explicit' | 'inferred'
	seed: number
	temperatureK: number
	temperatureSource: 'stored' | 'spectral' | 'default'
	rotationDays: number
	rotationSource: 'stored' | 'default'
	activity: number
	activitySource: 'explicit' | 'default'
	photosphere: { source: StellarPhotosphereSource, filename: string | null, binding: MediaAssetBinding | null }
}

const DEFAULT_RECIPE: StellarSurfaceRecipe = {
	version: STELLAR_SURFACE_RECIPE_VERSION,
	fallback: 'procedural',
	morphology: 'auto',
	seed: null,
	activity: null,
	maps: {},
}

const SPECTRAL_TEMPERATURES: Record<string, number> = {
	O: 35_000,
	B: 15_000,
	A: 8_500,
	F: 6_500,
	G: 5_600,
	K: 4_500,
	M: 3_200,
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function enumValue<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
	return typeof value === 'string' && options.includes(value as T) ? value as T : fallback
}

function unitFraction(value: unknown): number | null {
	const number = finiteNumber(value)
	return number == null ? null : Math.min(1, Math.max(0, number))
}

/** Parse untrusted JSONB and normalize old or malformed Starwright settings. */
export function parseStellarSurfaceRecipe(value: unknown): StellarSurfaceRecipe {
	if (!isRecord(value)) return { ...DEFAULT_RECIPE, maps: {} }
	const rawMaps = isRecord(value.maps) ? value.maps : {}
	const photosphere = parseMediaAssetBinding(rawMaps.photosphere, 'stellar-photosphere') ?? undefined
	const rawSeed = finiteNumber(value.seed)
	return {
		version: STELLAR_SURFACE_RECIPE_VERSION,
		fallback: enumValue(value.fallback, ['procedural', 'flat'], DEFAULT_RECIPE.fallback),
		morphology: enumValue(
			value.morphology,
			['auto', 'main_sequence', 'giant', 'white_dwarf'],
			DEFAULT_RECIPE.morphology,
		),
		seed: rawSeed == null ? null : Math.trunc(rawSeed),
		activity: unitFraction(value.activity),
		maps: photosphere ? { photosphere } : {},
	}
}

function stableSeed(value: string): number {
	let hash = 2_166_136_261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.codePointAt(index) ?? 0
		hash = Math.imul(hash, 16_777_619)
	}
	return hash >>> 0
}

export function inferStellarMorphology(spectralType: string | null | undefined): ResolvedStellarMorphology {
	const normalized = spectralType?.trim().toUpperCase() ?? ''
	if (/^D[A-Z]?\d*/.test(normalized)) return 'white_dwarf'
	// Ia/Iab/Ib, II, and III are luminous giants. IV remains with the ordinary
	// photosphere for now rather than overstating the prototype's fidelity.
	if (/(?:IAB|IA|IB|III|II)$/.test(normalized)) return 'giant'
	return 'main_sequence'
}

/** Representative photosphere temperature for a spectral class letter. */
export function spectralTemperatureK(spectralType: string | null | undefined): number | null {
	const spectralClass = spectralType?.trim()?.[0]?.toUpperCase()
	return spectralClass ? SPECTRAL_TEMPERATURES[spectralClass] ?? null : null
}

/**
 * Resolve a star's display temperature for downstream illustrative tinting:
 * stored value, then spectral-class table, then the solar default.
 */
export function hostStarTemperatureK(
	star: { temperatureK?: number | null, spectralType?: string | null } | null | undefined,
): number {
	const stored = typeof star?.temperatureK === 'number' && Number.isFinite(star.temperatureK) && star.temperatureK > 0
		? star.temperatureK
		: null
	return stored ?? spectralTemperatureK(star?.spectralType) ?? 5_772
}

function temperatureSource(stored: number | null, spectral: number | null): StellarSurfacePlan['temperatureSource'] {
	if (stored) return 'stored'
	if (spectral) return 'spectral'
	return 'default'
}

export function composeStellarSurfacePlan(
	body: StellarSurfaceBodyInput,
	rawRecipe: unknown,
): StellarSurfacePlan {
	const recipe = parseStellarSurfaceRecipe(rawRecipe)
	const morphology = recipe.morphology === 'auto'
		? inferStellarMorphology(body.spectralType)
		: recipe.morphology
	const storedTemperature = typeof body.temperatureK === 'number' && body.temperatureK > 0
		? body.temperatureK
		: null
	const spectralTemperature = spectralTemperatureK(body.spectralType)
	const storedRotationDays = typeof body.rotationPeriodS === 'number' && body.rotationPeriodS > 0
		? body.rotationPeriodS / 86_400
		: null
	const defaultActivity = morphology === 'white_dwarf' ? 0 : (morphology === 'giant' ? 0.4 : 0.3)
	const uploaded = recipe.maps.photosphere

	return {
		recipe,
		morphology,
		morphologySource: recipe.morphology === 'auto' ? 'inferred' : 'explicit',
		seed: recipe.seed ?? stableSeed(`${body.id}:${body.slug}:starwright`),
		temperatureK: storedTemperature ?? spectralTemperature ?? 5_772,
		temperatureSource: temperatureSource(storedTemperature, spectralTemperature),
		rotationDays: storedRotationDays ?? 25.4,
		rotationSource: storedRotationDays ? 'stored' : 'default',
		activity: recipe.activity ?? defaultActivity,
		activitySource: typeof recipe.activity === 'number' ? 'explicit' : 'default',
		photosphere: uploaded
			? { source: 'uploaded', filename: uploaded.filename, binding: uploaded }
			: { source: recipe.fallback === 'procedural' ? 'procedural' : 'constant', filename: null, binding: null },
	}
}

export function stellarSurfaceMediaUrl(asset: MediaAssetBinding | string): string {
	return typeof asset === 'string'
		? `/api/media/${encodeURIComponent(asset)}`
		: mediaAssetContentUrl(asset)
}

export function describeStellarSurfacePlan(plan: StellarSurfacePlan): string {
	if (plan.photosphere.source === 'uploaded') return 'Provided stellar photosphere'
	if (plan.photosphere.source === 'procedural') return 'Illustrative Starwright photosphere'
	return 'Flat restrained photosphere'
}

export function summarizeStellarSurfacePlan(plan: StellarSurfacePlan): 'Provided' | 'Illustrative' | 'Flat' {
	if (plan.photosphere.source === 'uploaded') return 'Provided'
	if (plan.photosphere.source === 'procedural') return 'Illustrative'
	return 'Flat'
}
