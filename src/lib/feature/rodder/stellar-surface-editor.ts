import {
	parseStellarSurfaceRecipe,
	STELLAR_SURFACE_RECIPE_VERSION,
	type StellarSurfaceRecipe,
} from './stellar-surface-model.js'
import { parseMediaAssetBinding } from '$lib/feature/media/asset-binding.js'

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Shared Starwright recipe composition for the unsaved preview and save path. */
export function stellarSurfaceRecipeFromDraft(draft: Record<string, unknown>): StellarSurfaceRecipe {
	const binding = parseMediaAssetBinding(draft.stellarPhotosphereMap, 'stellar-photosphere')

	return parseStellarSurfaceRecipe({
		version: STELLAR_SURFACE_RECIPE_VERSION,
		fallback: draft.stellarSurfaceFallback,
		morphology: draft.stellarMorphology,
		seed: finiteNumber(draft.stellarSurfaceSeed),
		activity: finiteNumber(draft.stellarActivity),
		maps: binding ? { photosphere: binding } : {},
	})
}
