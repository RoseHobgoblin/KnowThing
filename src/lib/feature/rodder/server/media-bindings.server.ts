import { parseStellarSurfaceRecipe } from '../public/stellar-surface-model.js'
import { parseSurfaceRecipe, type SurfaceMapChannel } from '../public/surface-model.js'
import { rodderMediaProfile, type RodderMediaPurpose } from '../public/media-binding.js'
import {
	resolvePinnedImageBinding,
	type MediaBindingDatabase,
	type MediaBindingRow,
} from '$lib/feature/media/public/resolve-image.server.js'

const SURFACE_CHANNELS: SurfaceMapChannel[] = ['albedo', 'elevation', 'normal', 'roughness', 'emissive']

function recordValue(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown>
		: {}
}

export async function normalizeRodderMediaBindings(
	database: MediaBindingDatabase,
	ownerId: number,
	kind: 'system' | 'star' | 'body',
	rawExtra: unknown,
): Promise<{ extra: Record<string, unknown>, rows: MediaBindingRow[] } | null> {
	if (kind === 'system') return null
	const extra = { ...recordValue(rawExtra) }
	const rows: MediaBindingRow[] = []

	if (kind === 'body') {
		const recipe = parseSurfaceRecipe(extra.surface)
		const maps: typeof recipe.maps = {}
		for (const channel of SURFACE_CHANNELS) {
			const purpose = `surface-${channel}` as RodderMediaPurpose
			const binding = await resolvePinnedImageBinding(database, recipe.maps[channel], rodderMediaProfile(purpose))
			if (!binding) continue
			maps[channel] = binding
			rows.push({
				mediaId: binding.mediaId!, ownerType: 'rodder', ownerId,
				slot: `surface.${channel}`, contentHash: binding.contentHash!,
				filenameSnapshot: binding.filename, interpretation: binding.interpretation,
			})
		}
		extra.surface = { ...recipe, maps }
	} else {
		const recipe = parseStellarSurfaceRecipe(extra.stellarSurface)
		const binding = await resolvePinnedImageBinding(database, recipe.maps.photosphere, rodderMediaProfile('stellar-photosphere'))
		extra.stellarSurface = { ...recipe, maps: binding ? { photosphere: binding } : {} }
		if (binding) {
			rows.push({
				mediaId: binding.mediaId!, ownerType: 'rodder', ownerId,
				slot: 'stellarSurface.photosphere', contentHash: binding.contentHash!,
				filenameSnapshot: binding.filename, interpretation: binding.interpretation,
			})
		}
	}
	return { extra, rows }
}
