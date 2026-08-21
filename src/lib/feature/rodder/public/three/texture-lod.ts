import type { ProceduralTextureSize, TexturePriority } from './procedural-texture-client.js'

export const TEXTURE_LOD_THRESHOLDS = {
	mediumUpgradePx: 96,
	mediumDowngradePx: 72,
	highUpgradePx: 256,
	highDowngradePx: 192,
} as const

export function resolveProceduralTextureLod(
	projectedPhysicalDiameterPx: number,
	current: ProceduralTextureSize,
): ProceduralTextureSize {
	const diameter = Math.max(0, projectedPhysicalDiameterPx)
	if (current === 1024) {
		if (diameter < TEXTURE_LOD_THRESHOLDS.mediumDowngradePx) return 256
		if (diameter < TEXTURE_LOD_THRESHOLDS.highDowngradePx) return 512
		return 1024
	}
	if (current === 512) {
		if (diameter >= TEXTURE_LOD_THRESHOLDS.highUpgradePx) return 1024
		if (diameter < TEXTURE_LOD_THRESHOLDS.mediumDowngradePx) return 256
		return 512
	}
	if (diameter >= TEXTURE_LOD_THRESHOLDS.highUpgradePx) return 1024
	if (diameter >= TEXTURE_LOD_THRESHOLDS.mediumUpgradePx) return 512
	return 256
}

export function texturePriorityForLod(size: ProceduralTextureSize): TexturePriority {
	return size === 1024 ? 'foreground' : (size === 512 ? 'normal' : 'background')
}
