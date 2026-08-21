import type { MediaAssetInterpretation, MediaBindingProfile } from '$lib/feature/media/public/media-binding.js'

export type RodderMediaPurpose = 'surface-albedo' | 'surface-elevation' | 'surface-normal' | 'surface-roughness' | 'surface-emissive' | 'stellar-photosphere'

const LABELS: Record<RodderMediaPurpose, string> = {
	'surface-albedo': 'base color map',
	'surface-elevation': 'elevation map',
	'surface-normal': 'normal map',
	'surface-roughness': 'roughness map',
	'surface-emissive': 'emissive map',
	'stellar-photosphere': 'photosphere plate',
}

export function rodderMediaInterpretation(purpose: RodderMediaPurpose): MediaAssetInterpretation {
	const colorSpace = ['surface-albedo', 'surface-emissive', 'stellar-photosphere'].includes(purpose) ? 'srgb' : 'linear'
	const interpretation: MediaAssetInterpretation = { projection: 'equirectangular', colorSpace }
	if (purpose === 'surface-normal') interpretation.normalY = 'up'
	if (purpose === 'surface-elevation') interpretation.elevationUnit = 'relative'
	if (purpose === 'surface-roughness') interpretation.sampleChannel = 'green'
	return interpretation
}

export function rodderMediaProfile(purpose: RodderMediaPurpose): MediaBindingProfile {
	return {
		label: LABELS[purpose],
		interpretation: rodderMediaInterpretation(purpose),
		compatibility: { mimePrefix: 'image/', aspectRatio: 2, aspectRatioTolerance: 0.04, minimumWidth: 1024, minimumHeight: 512, requireContentHash: true },
	}
}
