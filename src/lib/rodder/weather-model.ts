export const WEATHER_RECIPE_VERSION = 1 as const

export type ProceduralCloudRecipe = {
	mode: 'procedural' | 'none'
	/** Representative generated shell coverage, not a dated observation or climatology. */
	meanCover: number | null
	seed: number | null
}

export type WeatherRecipe = {
	version: typeof WEATHER_RECIPE_VERSION
	clouds: ProceduralCloudRecipe
}

export type WeatherPlan = {
	recipe: WeatherRecipe
	clouds: {
		source: 'procedural' | 'unavailable'
		meanCover: number | null
		seed: number
	}
}

const DEFAULT_RECIPE: WeatherRecipe = {
	version: WEATHER_RECIPE_VERSION,
	clouds: { mode: 'none', meanCover: null, seed: null },
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unitFraction(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(1, Math.max(0, value))
		: null
}

function integer(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
}

function stableSeed(value: string): number {
	let hash = 2_166_136_261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.codePointAt(index) ?? 0
		hash = Math.imul(hash, 16_777_619)
	}
	return hash >>> 0
}

/**
 * Parse the independent weather recipe. A legacy surface recipe may be supplied
 * so existing explicit procedural cloud coverage survives one read/save cycle;
 * uploaded cloud masks are intentionally not migrated into permanent weather.
 */
export function parseWeatherRecipe(value: unknown, legacySurface?: unknown): WeatherRecipe {
	const record = isRecord(value) ? value : null
	const clouds = record && isRecord(record.clouds) ? record.clouds : null
	if (clouds) {
		return {
			version: WEATHER_RECIPE_VERSION,
			clouds: {
				mode: clouds.mode === 'procedural' ? 'procedural' : 'none',
				meanCover: unitFraction(clouds.meanCover),
				seed: integer(clouds.seed),
			},
		}
	}

	const legacy = isRecord(legacySurface) ? legacySurface : null
	const legacyCoverage = legacy && isRecord(legacy.coverage) ? legacy.coverage : null
	const legacyMeanCover = unitFraction(legacyCoverage?.clouds ?? legacy?.cloudCoverage)
	if (legacyMeanCover != null) {
		return {
			version: WEATHER_RECIPE_VERSION,
			clouds: { mode: 'procedural', meanCover: legacyMeanCover, seed: null },
		}
	}

	return { ...DEFAULT_RECIPE, clouds: { ...DEFAULT_RECIPE.clouds } }
}

export function composeWeatherPlan(
	body: { id: number, slug: string },
	rawRecipe: unknown,
	legacySurface?: unknown,
): WeatherPlan {
	const recipe = parseWeatherRecipe(rawRecipe, legacySurface)
	const active = recipe.clouds.mode === 'procedural'
		&& recipe.clouds.meanCover != null
		&& recipe.clouds.meanCover > 0
	return {
		recipe,
		clouds: {
			source: active ? 'procedural' : 'unavailable',
			meanCover: recipe.clouds.meanCover,
			seed: recipe.clouds.seed ?? stableSeed(`weather:${body.id}:${body.slug}`),
		},
	}
}
