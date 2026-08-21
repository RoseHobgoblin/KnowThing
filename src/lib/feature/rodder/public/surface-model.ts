import {
	mediaAssetContentUrl,
	parseMediaAssetBinding,
	type MediaAssetBinding,
} from '$lib/feature/media/public/media-binding.js'
import { mediaContentUrl } from '$lib/feature/media/public/media-urls.js'
import { rodderMediaInterpretation } from './media-binding.js'

export const SURFACE_RECIPE_VERSION = 5 as const

export type SurfaceClass = 'rocky' | 'terrestrial' | 'gas' | 'ice'
export type ResolvedSurfaceClass = SurfaceClass
export type SurfaceFallback = 'procedural' | 'flat'
export type SurfaceMapChannel = 'albedo' | 'elevation' | 'normal' | 'roughness' | 'emissive'
export type SurfaceSourceKind = 'uploaded' | 'procedural' | 'constant' | 'unavailable'
export type SurfaceCoverageKey = 'surfaceWater' | 'vegetation' | 'permanentSnowIce'

export type SurfaceCoverage = Record<SurfaceCoverageKey, number | null>

export type SurfaceRecipe = {
	version: typeof SURFACE_RECIPE_VERSION
	fallback: SurfaceFallback
	class: SurfaceClass | null
	seed: number | null
	coverage: SurfaceCoverage
	maps: Partial<Record<SurfaceMapChannel, MediaAssetBinding>>
}

export type SurfaceBodyInput = {
	id: number
	slug: string
	bodyType: string
	temperatureK?: number | null
}

export type SurfaceChannelPlan = {
	source: SurfaceSourceKind
	filename: string | null
	binding: MediaAssetBinding | null
}

export type SurfaceDiagnostic = {
	code: 'profile-vegetation-temperature' | 'profile-snow-temperature' | 'empty-vegetation-domain' | 'incompatible-coverage'
	message: string
}

export type SurfacePlan = {
	recipe: SurfaceRecipe
	class: ResolvedSurfaceClass
	classSource: 'explicit' | 'default'
	seed: number
	temperatureK: number | null
	coverage: SurfaceCoverage
	coverageSource: Record<SurfaceCoverageKey, 'explicit' | 'unknown'>
	diagnostics: SurfaceDiagnostic[]
	channels: Record<SurfaceMapChannel, SurfaceChannelPlan>
}

export const SURFACE_CHANNELS: readonly SurfaceMapChannel[] = [
	'albedo', 'elevation', 'normal', 'roughness', 'emissive',
]

const DEFAULT_COVERAGE: SurfaceCoverage = {
	surfaceWater: null,
	vegetation: null,
	permanentSnowIce: null,
}

const DEFAULT_RECIPE: SurfaceRecipe = {
	version: SURFACE_RECIPE_VERSION,
	fallback: 'procedural',
	class: null,
	seed: null,
	coverage: DEFAULT_COVERAGE,
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

function parseCoverage(value: Record<string, unknown>): SurfaceCoverage {
	const nested = isRecord(value.coverage) ? value.coverage : null
	return {
		// v3 migration is deliberately value-only: no inferred appearance survives.
		surfaceWater: unitFraction(nested?.surfaceWater ?? value.hydrosphereFraction),
		vegetation: unitFraction(nested?.vegetation ?? value.vegetationFraction),
		permanentSnowIce: unitFraction(nested?.permanentSnowIce ?? value.snowCoverage),
	}
}

/** Parse untrusted JSONB and upgrade explicit v3 settings to recipe v4. */
export function parseSurfaceRecipe(value: unknown): SurfaceRecipe {
	if (!isRecord(value)) return { ...DEFAULT_RECIPE, coverage: { ...DEFAULT_COVERAGE }, maps: {} }
	const rawMaps = isRecord(value.maps) ? value.maps : {}
	const maps: Partial<Record<SurfaceMapChannel, MediaAssetBinding>> = {}
	for (const channel of SURFACE_CHANNELS) {
		const binding = parseMediaAssetBinding(rawMaps[channel], rodderMediaInterpretation(`surface-${channel}`))
		if (binding) maps[channel] = binding
	}
	const rawSeed = finiteNumber(value.seed)
	const parsedClass = enumValue(value.class, ['rocky', 'terrestrial', 'gas', 'ice'], '')
	return {
		version: SURFACE_RECIPE_VERSION,
		fallback: enumValue(value.fallback, ['procedural', 'flat'], DEFAULT_RECIPE.fallback),
		class: parsedClass || null,
		seed: rawSeed == null ? null : Math.trunc(rawSeed),
		coverage: parseCoverage(value),
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

function channel(source: SurfaceSourceKind, binding: MediaAssetBinding | null = null): SurfaceChannelPlan {
	return { source, filename: binding?.filename ?? null, binding }
}

function coverageDiagnostics(
	surfaceClass: SurfaceClass,
	temperatureK: number | null,
	coverage: SurfaceCoverage,
): SurfaceDiagnostic[] {
	const diagnostics: SurfaceDiagnostic[] = []
	if (coverage.vegetation != null && coverage.vegetation > 0 && surfaceClass !== 'terrestrial') {
		diagnostics.push({ code: 'incompatible-coverage', message: 'Vegetation coverage requires the terrestrial surface class and is currently inactive.' })
	}
	if (coverage.surfaceWater != null && coverage.surfaceWater > 0 && !['rocky', 'terrestrial'].includes(surfaceClass)) {
		diagnostics.push({ code: 'incompatible-coverage', message: 'Surface-water coverage is inactive for this surface class.' })
	}
	if (coverage.permanentSnowIce != null && coverage.permanentSnowIce > 0 && !['rocky', 'terrestrial'].includes(surfaceClass)) {
		diagnostics.push({ code: 'incompatible-coverage', message: 'Permanent snow and ice coverage is inactive for this surface class.' })
	}
	if (temperatureK != null && coverage.vegetation != null && coverage.vegetation > 0
		&& (temperatureK < 240 || temperatureK > 330)) {
		diagnostics.push({
			code: 'profile-vegetation-temperature',
			message: 'Vegetation placement is outside the Earthlike illustrative placement profile; the authored target is still honored.',
		})
	}
	if (temperatureK != null && coverage.permanentSnowIce != null
		&& coverage.permanentSnowIce > 0 && temperatureK > 310) {
		diagnostics.push({
			code: 'profile-snow-temperature',
			message: 'Snow and ice placement is outside the Earthlike illustrative placement profile; the authored target is still honored.',
		})
	}
	return diagnostics
}

export function composeSurfacePlan(body: SurfaceBodyInput, rawRecipe: unknown): SurfacePlan {
	const recipe = parseSurfaceRecipe(rawRecipe)
	const surfaceClass = recipe.class ?? 'rocky'
	const procedural = recipe.fallback === 'procedural'
	const generatedRelief = procedural && surfaceClass !== 'gas'
	const temperatureK = typeof body.temperatureK === 'number' && Number.isFinite(body.temperatureK) && body.temperatureK > 0
		? body.temperatureK
		: null
	const uploaded = (mapChannel: SurfaceMapChannel) => recipe.maps[mapChannel]
	const choose = (mapChannel: SurfaceMapChannel, fallback: SurfaceSourceKind): SurfaceChannelPlan => {
		const binding = uploaded(mapChannel)
		return binding ? channel('uploaded', binding) : channel(fallback)
	}
	const compatibleCoverage: SurfaceCoverage = {
		surfaceWater: ['rocky', 'terrestrial'].includes(surfaceClass) ? recipe.coverage.surfaceWater : null,
		vegetation: surfaceClass === 'terrestrial' ? recipe.coverage.vegetation : null,
		permanentSnowIce: ['rocky', 'terrestrial'].includes(surfaceClass) ? recipe.coverage.permanentSnowIce : null,
	}
	return {
		recipe,
		class: surfaceClass,
		classSource: recipe.class == null ? 'default' : 'explicit',
		seed: recipe.seed ?? stableSeed(`${body.id}:${body.slug}`),
		temperatureK,
		coverage: compatibleCoverage,
		coverageSource: Object.fromEntries(
			(Object.keys(DEFAULT_COVERAGE) as SurfaceCoverageKey[])
				.map(key => [key, recipe.coverage[key] == null ? 'unknown' : 'explicit']),
		) as SurfacePlan['coverageSource'],
		diagnostics: coverageDiagnostics(surfaceClass, temperatureK, recipe.coverage),
		channels: {
			albedo: choose('albedo', procedural ? 'procedural' : 'constant'),
			elevation: choose('elevation', generatedRelief ? 'procedural' : 'unavailable'),
			normal: choose('normal', generatedRelief ? 'procedural' : 'unavailable'),
			roughness: choose('roughness', procedural ? 'procedural' : 'constant'),
			emissive: choose('emissive', 'unavailable'),
		},
	}
}

export function surfaceMediaUrl(asset: MediaAssetBinding | string): string {
	return typeof asset === 'string'
		? mediaContentUrl(asset)
		: mediaAssetContentUrl(asset)
}

export type SurfacePlanSummary = 'Provided' | 'Mixed' | 'Illustrative' | 'Flat'

export function summarizeSurfacePlan(plan: SurfacePlan): SurfacePlanSummary {
	const sources = new Set(SURFACE_CHANNELS.map(name => plan.channels[name].source))
	const uploaded = sources.has('uploaded')
	const procedural = sources.has('procedural')
	if (uploaded && procedural) return 'Mixed'
	if (uploaded) return 'Provided'
	if (procedural) return 'Illustrative'
	return 'Flat'
}

export function describeSurfacePlan(plan: SurfacePlan): string {
	const summary = summarizeSurfacePlan(plan)
	if (summary === 'Provided') return 'Provided surface data'
	if (summary === 'Mixed') return 'Mixed provided and illustrative surface data'
	if (summary === 'Illustrative') return `Illustrative procedural ${plan.class} surface`
	return 'Flat surface'
}
