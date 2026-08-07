import {
	parseStellarSurfaceRecipe,
	STELLAR_SURFACE_RECIPE_VERSION,
	type StellarSurfaceRecipe,
} from './stellar-surface-model.js'

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Shared Starwright recipe composition for the unsaved preview and save path. */
export function stellarSurfaceRecipeFromDraft(draft: Record<string, unknown>): StellarSurfaceRecipe {
	const filename = typeof draft.stellarPhotosphereMap === 'string'
		? draft.stellarPhotosphereMap.trim()
		: ''

	return parseStellarSurfaceRecipe({
		version: STELLAR_SURFACE_RECIPE_VERSION,
		fallback: draft.stellarSurfaceFallback,
		morphology: draft.stellarMorphology,
		seed: finiteNumber(draft.stellarSurfaceSeed),
		activity: finiteNumber(draft.stellarActivity),
		maps: filename ? { photosphere: filename } : {},
	})
}
