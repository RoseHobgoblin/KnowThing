import {
	parseSurfaceRecipe,
	SURFACE_RECIPE_VERSION,
	type SurfaceMapChannel,
	type SurfaceRecipe,
} from './surface-model.js'

const SURFACE_CHANNELS: SurfaceMapChannel[] = [
	'albedo',
	'elevation',
	'normal',
	'roughness',
	'clouds',
	'emissive',
]

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Compose the versioned surface recipe from the editor's flat working draft.
 * The save path and live preview deliberately share this function so an
 * unsaved preview cannot disagree with what Save will persist.
 */
export function surfaceRecipeFromDraft(draft: Record<string, unknown>): SurfaceRecipe {
	const maps: Partial<Record<SurfaceMapChannel, string>> = {}
	for (const channel of SURFACE_CHANNELS) {
		const filename = draft[`surfaceMap_${channel}`]
		if (typeof filename === 'string' && filename.trim()) maps[channel] = filename.trim()
	}

	return parseSurfaceRecipe({
		version: SURFACE_RECIPE_VERSION,
		fallback: draft.surfaceFallback,
		class: draft.surfaceClass,
		seed: finiteNumber(draft.surfaceSeed),
		hydrosphereFraction: finiteNumber(draft.surfaceHydrosphere),
		cloudCoverage: finiteNumber(draft.surfaceCloudCoverage),
		maps,
	})
}
