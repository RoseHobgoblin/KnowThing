import { mediaContentUrl, pinnedMediaContentUrl } from './media-urls.js'

export const MEDIA_ASSET_BINDING_VERSION = 1 as const

export type MediaAssetInterpretation = {
	projection: 'equirectangular'
	colorSpace: 'srgb' | 'linear'
	normalY?: 'up' | 'down'
	elevationUnit?: 'relative' | 'm' | 'km'
	elevationScale?: number
	elevationOffset?: number
	elevationDatum?: string
	elevationPositiveDirection?: 'up' | 'down'
	sampleChannel?: 'green'
}

export type MediaAssetBinding = {
	version: typeof MEDIA_ASSET_BINDING_VERSION
	mediaId: number | null
	filename: string
	contentHash: string | null
	interpretation: MediaAssetInterpretation
}

export type MediaAssetListItem = {
	id: number
	filename: string
	mimeType: string | null
	width: number | null
	height: number | null
	sizeBytes: number | null
	description: string | null
	hash: string | null
	hasThumb150: boolean | null
	hasThumb300: boolean | null
	hasThumb600: boolean | null
	uploadedAt: string
	usageCount: number
}

export type MediaCompatibility = { compatible: boolean, warnings: string[], errors: string[] }

export type MediaCompatibilityConstraints = {
	mimePrefix?: string
	aspectRatio?: number
	aspectRatioTolerance?: number
	minimumWidth?: number
	minimumHeight?: number
	requireContentHash?: boolean
}

export type MediaBindingProfile = {
	label: string
	interpretation: MediaAssetInterpretation
	compatibility: MediaCompatibilityConstraints
}

const HASH_PATTERN = /^[\da-f]{64}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function parseMediaAssetBinding(value: unknown, defaults: MediaAssetInterpretation): MediaAssetBinding | null {
	if (typeof value === 'string' && value.trim()) {
		return { version: MEDIA_ASSET_BINDING_VERSION, mediaId: null, filename: value.trim(), contentHash: null, interpretation: { ...defaults } }
	}
	if (!isRecord(value) || typeof value.filename !== 'string' || !value.filename.trim()) return null
	const rawInterpretation = isRecord(value.interpretation) ? value.interpretation : {}
	const interpretation: MediaAssetInterpretation = {
		...defaults,
		projection: 'equirectangular',
		colorSpace: rawInterpretation.colorSpace === 'srgb' || rawInterpretation.colorSpace === 'linear' ? rawInterpretation.colorSpace : defaults.colorSpace,
	}
	if (defaults.normalY !== undefined) interpretation.normalY = rawInterpretation.normalY === 'down' ? 'down' : 'up'
	if (defaults.elevationUnit !== undefined) {
		interpretation.elevationUnit = rawInterpretation.elevationUnit === 'm' || rawInterpretation.elevationUnit === 'km' ? rawInterpretation.elevationUnit : 'relative'
		const scale = finiteNumber(rawInterpretation.elevationScale)
		const offset = finiteNumber(rawInterpretation.elevationOffset)
		if (scale != null && scale > 0) interpretation.elevationScale = scale
		if (offset != null) interpretation.elevationOffset = offset
		if (typeof rawInterpretation.elevationDatum === 'string' && rawInterpretation.elevationDatum.trim()) interpretation.elevationDatum = rawInterpretation.elevationDatum.trim()
		if (rawInterpretation.elevationPositiveDirection === 'up' || rawInterpretation.elevationPositiveDirection === 'down') interpretation.elevationPositiveDirection = rawInterpretation.elevationPositiveDirection
	}
	if (defaults.sampleChannel !== undefined) interpretation.sampleChannel = defaults.sampleChannel
	return {
		version: MEDIA_ASSET_BINDING_VERSION,
		mediaId: typeof value.mediaId === 'number' && Number.isInteger(value.mediaId) && value.mediaId > 0 ? value.mediaId : null,
		filename: value.filename.trim(),
		contentHash: typeof value.contentHash === 'string' && HASH_PATTERN.test(value.contentHash) ? value.contentHash.toLowerCase() : null,
		interpretation,
	}
}

export function mediaBindingFromItem(item: MediaAssetListItem, interpretation: MediaAssetInterpretation): MediaAssetBinding {
	return { version: MEDIA_ASSET_BINDING_VERSION, mediaId: item.id, filename: item.filename, contentHash: item.hash, interpretation: { ...interpretation } }
}

export function assessMediaCompatibility(
	item: Pick<MediaAssetListItem, 'mimeType' | 'width' | 'height' | 'hash'>,
	constraints: MediaCompatibilityConstraints,
): MediaCompatibility {
	const errors: string[] = []
	const warnings: string[] = []
	if (constraints.mimePrefix && !item.mimeType?.startsWith(constraints.mimePrefix)) errors.push('Not a renderable image')
	if (!item.width || !item.height) {
		errors.push('Image dimensions are unavailable')
	} else {
		const ratio = item.width / item.height
		if (constraints.aspectRatio != null && Math.abs(ratio - constraints.aspectRatio) > (constraints.aspectRatioTolerance ?? 0)) errors.push(`Expected a ${constraints.aspectRatio}:1 plate; this is ${ratio.toFixed(2)}:1`)
		if ((constraints.minimumWidth && item.width < constraints.minimumWidth) || (constraints.minimumHeight && item.height < constraints.minimumHeight)) warnings.push(`Below the recommended ${constraints.minimumWidth ?? 0} × ${constraints.minimumHeight ?? 0} overview resolution`)
	}
	if (constraints.requireContentHash && !item.hash) errors.push('The asset has no immutable content hash')
	return { compatible: errors.length === 0, warnings, errors }
}

export function mediaAssetContentUrl(binding: MediaAssetBinding): string {
	if (binding.mediaId && binding.contentHash) return pinnedMediaContentUrl(binding.mediaId, binding.contentHash)
	return mediaContentUrl(binding.filename)
}
