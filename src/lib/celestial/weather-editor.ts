import { parseWeatherRecipe, WEATHER_RECIPE_VERSION, type WeatherRecipe } from './weather-model.js'

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Shared live-preview and persistence projection for illustrative weather. */
export function weatherRecipeFromDraft(draft: Record<string, unknown>): WeatherRecipe {
	return parseWeatherRecipe({
		version: WEATHER_RECIPE_VERSION,
		clouds: {
			mode: draft.weatherCloudMode,
			meanCover: finiteNumber(draft.weatherCloudMeanCover),
			seed: finiteNumber(draft.weatherCloudSeed),
		},
	})
}
