import {
	parseSurfaceRecipe,
	SURFACE_RECIPE_VERSION,
	type SurfaceMapChannel,
	type SurfaceRecipe,
} from './surface-model.js'
import { parseMediaAssetBinding } from '$lib/feature/media/asset-binding.js'

const SURFACE_CHANNELS: SurfaceMapChannel[] = [
	'albedo', 'elevation', 'normal', 'roughness', 'emissive',
]

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Shared live-preview and persistence projection for the flat form draft. */
export function surfaceRecipeFromDraft(draft: Record<string, unknown>): SurfaceRecipe {
	const maps: SurfaceRecipe['maps'] = {}
	for (const channel of SURFACE_CHANNELS) {
		const binding = parseMediaAssetBinding(draft[`surfaceMap_${channel}`], `surface-${channel}`)
		if (binding) maps[channel] = binding
	}

	return parseSurfaceRecipe({
		version: SURFACE_RECIPE_VERSION,
		fallback: draft.surfaceFallback,
		class: draft.surfaceClass,
		seed: finiteNumber(draft.surfaceSeed),
		coverage: {
			surfaceWater: finiteNumber(draft.surfaceHydrosphere),
			vegetation: finiteNumber(draft.surfaceVegetation),
			permanentSnowIce: finiteNumber(draft.surfaceSnowCoverage),
		},
		maps,
	})
}
