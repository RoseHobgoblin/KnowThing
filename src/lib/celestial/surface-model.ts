export const SURFACE_RECIPE_VERSION = 1 as const

export type SurfaceClass = 'auto' | 'rocky' | 'terrestrial' | 'gas' | 'ice'
export type ResolvedSurfaceClass = Exclude<SurfaceClass, 'auto'>
export type SurfaceFallback = 'procedural' | 'flat'
export type SurfaceMapChannel = 'albedo' | 'elevation' | 'normal' | 'roughness' | 'clouds' | 'emissive'
export type SurfaceSourceKind = 'uploaded' | 'procedural' | 'constant' | 'unavailable'

export type SurfaceRecipe = {
	version: typeof SURFACE_RECIPE_VERSION
	fallback: SurfaceFallback
	class: SurfaceClass
	seed: number | null
	hydrosphereFraction: number | null
	cloudCoverage: number | null
	maps: Partial<Record<SurfaceMapChannel, string>>
}

export type SurfaceBodyInput = {
	id: number
	slug: string
	bodyType: string
	temperatureK?: number | null
	temperature?: string | null
	composition?: string | null
	atmosphere?: string | null
}

export type SurfaceChannelPlan = {
	source: SurfaceSourceKind
	filename: string | null
}

export type SurfacePlan = {
	recipe: SurfaceRecipe
	class: ResolvedSurfaceClass
	classSource: 'explicit' | 'inferred'
	seed: number
	temperatureK: number | null
	hydrosphereFraction: number
	hydrosphereSource: 'explicit' | 'inferred' | 'default'
	channels: Record<SurfaceMapChannel, SurfaceChannelPlan>
}

const CHANNELS: SurfaceMapChannel[] = ['albedo', 'elevation', 'normal', 'roughness', 'clouds', 'emissive']

const DEFAULT_RECIPE: SurfaceRecipe = {
	version: SURFACE_RECIPE_VERSION,
	fallback: 'procedural',
	class: 'auto',
	seed: null,
	hydrosphereFraction: null,
	cloudCoverage: null,
	maps: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function unitFraction(value: unknown): number | null {
	const number = finiteNumber(value)
	return number == null ? null : Math.min(1, Math.max(0, number))
}

function enumValue<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
	return typeof value === 'string' && options.includes(value as T) ? value as T : fallback
}

/** Parse untrusted JSONB without allowing malformed surface data into rendering. */
export function parseSurfaceRecipe(value: unknown): SurfaceRecipe {
	if (!isRecord(value)) return { ...DEFAULT_RECIPE, maps: {} }
	const rawMaps = isRecord(value.maps) ? value.maps : {}
	const maps: Partial<Record<SurfaceMapChannel, string>> = {}
	for (const channel of CHANNELS) {
		const filename = rawMaps[channel]
		if (typeof filename === 'string' && filename.trim()) maps[channel] = filename.trim()
	}
	const rawSeed = finiteNumber(value.seed)
	return {
		version: SURFACE_RECIPE_VERSION,
		fallback: enumValue(value.fallback, ['procedural', 'flat'], DEFAULT_RECIPE.fallback),
		class: enumValue(value.class, ['auto', 'rocky', 'terrestrial', 'gas', 'ice'], DEFAULT_RECIPE.class),
		seed: rawSeed == null ? null : Math.trunc(rawSeed),
		hydrosphereFraction: unitFraction(value.hydrosphereFraction),
		cloudCoverage: unitFraction(value.cloudCoverage),
		maps,
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

export function inferSurfaceClass(body: SurfaceBodyInput): ResolvedSurfaceClass {
	const evidence = `${body.bodyType} ${body.composition ?? ''} ${body.atmosphere ?? ''}`.toLowerCase()
	if (/gas giant|jovian|neptune|hydrogen|helium/.test(evidence)) return 'gas'
	if (/ice|icy|frozen|cryovolcan|glacier/.test(evidence)) return 'ice'
	if (/terrestrial|ocean|water world|earthlike|earth-like/.test(evidence)) return 'terrestrial'
	return 'rocky'
}

function channel(source: SurfaceSourceKind, filename: string | null = null): SurfaceChannelPlan {
	return { source, filename }
}

export function composeSurfacePlan(body: SurfaceBodyInput, rawRecipe: unknown): SurfacePlan {
	const recipe = parseSurfaceRecipe(rawRecipe)
	const surfaceClass = recipe.class === 'auto' ? inferSurfaceClass(body) : recipe.class
	const procedural = recipe.fallback === 'procedural'
	const generatedRelief = procedural && surfaceClass !== 'gas'
	const inferredOcean = /ocean|water world/i.test(body.bodyType)
	const hydrosphereFraction = recipe.hydrosphereFraction ?? (inferredOcean ? 0.8 : 0)
	const uploaded = (mapChannel: SurfaceMapChannel) => recipe.maps[mapChannel]
	const choose = (mapChannel: SurfaceMapChannel, fallback: SurfaceSourceKind): SurfaceChannelPlan => {
		const filename = uploaded(mapChannel)
		return filename ? channel('uploaded', filename) : channel(fallback)
	}

	const writtenTemperature = body.temperature?.match(/([+-]?\d+(?:\.\d+)?)\s*k\b/i)
	const parsedTemperature = writtenTemperature ? Number.parseFloat(writtenTemperature[1]) : null
	let hydrosphereSource: SurfacePlan['hydrosphereSource'] = 'default'
	if (inferredOcean) hydrosphereSource = 'inferred'
	if (recipe.hydrosphereFraction != null) hydrosphereSource = 'explicit'
	return {
		recipe,
		class: surfaceClass,
		classSource: recipe.class === 'auto' ? 'inferred' : 'explicit',
		seed: recipe.seed ?? stableSeed(`${body.id}:${body.slug}`),
		temperatureK: typeof body.temperatureK === 'number' && body.temperatureK > 0
			? body.temperatureK
			: (parsedTemperature != null && parsedTemperature > 0 ? parsedTemperature : null),
		hydrosphereFraction,
		hydrosphereSource,
		channels: {
			albedo: choose('albedo', procedural ? 'procedural' : 'constant'),
			elevation: choose('elevation', generatedRelief ? 'procedural' : 'unavailable'),
			normal: choose('normal', 'unavailable'),
			roughness: choose('roughness', procedural ? 'procedural' : 'constant'),
			clouds: choose('clouds', procedural && recipe.cloudCoverage != null && recipe.cloudCoverage > 0 ? 'procedural' : 'unavailable'),
			emissive: choose('emissive', 'unavailable'),
		},
	}
}

export function surfaceMediaUrl(filename: string): string {
	return `/api/media/${encodeURIComponent(filename)}`
}

export function describeSurfacePlan(plan: SurfacePlan): string {
	const uploadedCount = CHANNELS.filter(channelName => plan.channels[channelName].source === 'uploaded').length
	if (uploadedCount > 0) {
		const fallback = CHANNELS.some(channelName => plan.channels[channelName].source === 'procedural')
		return fallback ? `Uploaded surface data (${uploadedCount} channels) with procedural gaps` : `Uploaded surface data (${uploadedCount} channels)`
	}
	if (plan.channels.albedo.source === 'procedural') return `Procedural ${plan.class} surface (illustrative)`
	return 'Flat surface; no texture data'
}
