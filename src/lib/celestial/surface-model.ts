import {
	mediaAssetContentUrl,
	parseMediaAssetBinding,
	type MediaAssetBinding,
} from '$lib/media/asset-binding.js'

export const SURFACE_RECIPE_VERSION = 3 as const

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
	vegetationFraction: number | null
	snowCoverage: number | null
	maps: Partial<Record<SurfaceMapChannel, MediaAssetBinding>>
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
	binding: MediaAssetBinding | null
}

export type SurfacePlan = {
	recipe: SurfaceRecipe
	class: ResolvedSurfaceClass
	classSource: 'explicit' | 'inferred'
	seed: number
	temperatureK: number | null
	hydrosphereFraction: number
	hydrosphereSource: 'explicit' | 'inferred' | 'default'
	vegetationFraction: number
	vegetationSource: 'explicit' | 'inferred' | 'default'
	snowCoverage: number
	snowSource: 'explicit' | 'inferred' | 'default'
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
	vegetationFraction: null,
	snowCoverage: null,
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

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value))
}

function enumValue<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
	return typeof value === 'string' && options.includes(value as T) ? value as T : fallback
}

/** Parse untrusted JSONB without allowing malformed surface data into rendering. */
export function parseSurfaceRecipe(value: unknown): SurfaceRecipe {
	if (!isRecord(value)) return { ...DEFAULT_RECIPE, maps: {} }
	const rawMaps = isRecord(value.maps) ? value.maps : {}
	const maps: Partial<Record<SurfaceMapChannel, MediaAssetBinding>> = {}
	for (const channel of CHANNELS) {
		const binding = parseMediaAssetBinding(rawMaps[channel], `surface-${channel}`)
		if (binding) maps[channel] = binding
	}
	const rawSeed = finiteNumber(value.seed)
	return {
		version: SURFACE_RECIPE_VERSION,
		fallback: enumValue(value.fallback, ['procedural', 'flat'], DEFAULT_RECIPE.fallback),
		class: enumValue(value.class, ['auto', 'rocky', 'terrestrial', 'gas', 'ice'], DEFAULT_RECIPE.class),
		seed: rawSeed == null ? null : Math.trunc(rawSeed),
		hydrosphereFraction: unitFraction(value.hydrosphereFraction),
		cloudCoverage: unitFraction(value.cloudCoverage),
		vegetationFraction: unitFraction(value.vegetationFraction),
		snowCoverage: unitFraction(value.snowCoverage),
		maps,
	}
}

function writtenTemperatureK(value: string | null | undefined): number | null {
	if (!value) return null
	const match = value.match(/([+−-]?\d+(?:\.\d+)?)\s*°?\s*([cfk])\b/i)
	if (!match) return null
	const amount = Number.parseFloat(match[1].replace('−', '-'))
	if (!Number.isFinite(amount)) return null
	const unit = match[2].toLowerCase()
	let kelvin = amount
	if (unit === 'c') kelvin = amount + 273.15
	else if (unit === 'f') kelvin = (amount - 32) * 5 / 9 + 273.15
	return kelvin > 0 ? kelvin : null
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

function channel(source: SurfaceSourceKind, binding: MediaAssetBinding | null = null): SurfaceChannelPlan {
	return { source, filename: binding?.filename ?? null, binding }
}

export function composeSurfacePlan(body: SurfaceBodyInput, rawRecipe: unknown): SurfacePlan {
	const recipe = parseSurfaceRecipe(rawRecipe)
	const surfaceClass = recipe.class === 'auto' ? inferSurfaceClass(body) : recipe.class
	const procedural = recipe.fallback === 'procedural'
	const generatedRelief = procedural && surfaceClass !== 'gas'
	const evidence = `${body.bodyType} ${body.composition ?? ''} ${body.atmosphere ?? ''}`
	const inferredOcean = /ocean|water world/i.test(evidence)
	const inferredVegetation = /earth[ -]?like|garden world|biosphere|vegetat|forest|flora/i.test(evidence)
	const hydrosphereFraction = recipe.hydrosphereFraction ?? (inferredOcean ? 0.8 : 0)
	const temperatureK = typeof body.temperatureK === 'number' && body.temperatureK > 0
		? body.temperatureK
		: writtenTemperatureK(body.temperature)
	const vegetationFraction = recipe.vegetationFraction ?? (inferredVegetation ? 0.55 : 0)
	const inferredSnow = temperatureK != null && hydrosphereFraction > 0 && surfaceClass !== 'gas'
		? clamp((296 - temperatureK) / 70, 0, 0.9) * Math.min(1, hydrosphereFraction * 2)
		: 0
	const snowCoverage = recipe.snowCoverage ?? inferredSnow
	const uploaded = (mapChannel: SurfaceMapChannel) => recipe.maps[mapChannel]
	const choose = (mapChannel: SurfaceMapChannel, fallback: SurfaceSourceKind): SurfaceChannelPlan => {
		const binding = uploaded(mapChannel)
		return binding ? channel('uploaded', binding) : channel(fallback)
	}

	let hydrosphereSource: SurfacePlan['hydrosphereSource'] = 'default'
	if (inferredOcean) hydrosphereSource = 'inferred'
	if (recipe.hydrosphereFraction != null) hydrosphereSource = 'explicit'
	let vegetationSource: SurfacePlan['vegetationSource'] = inferredVegetation ? 'inferred' : 'default'
	if (recipe.vegetationFraction != null) vegetationSource = 'explicit'
	let snowSource: SurfacePlan['snowSource'] = inferredSnow > 0 ? 'inferred' : 'default'
	if (recipe.snowCoverage != null) snowSource = 'explicit'
	return {
		recipe,
		class: surfaceClass,
		classSource: recipe.class === 'auto' ? 'inferred' : 'explicit',
		seed: recipe.seed ?? stableSeed(`${body.id}:${body.slug}`),
		temperatureK,
		hydrosphereFraction,
		hydrosphereSource,
		vegetationFraction,
		vegetationSource,
		snowCoverage,
		snowSource,
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

export function surfaceMediaUrl(asset: MediaAssetBinding | string): string {
	return typeof asset === 'string'
		? `/api/media/${encodeURIComponent(asset)}`
		: mediaAssetContentUrl(asset)
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
