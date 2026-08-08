export const MEDIA_ASSET_BINDING_VERSION = 1 as const

export type CelestialMediaPurpose =
	| 'surface-albedo'
	| 'surface-elevation'
	| 'surface-normal'
	| 'surface-roughness'
	| 'surface-emissive'
	| 'stellar-photosphere'

export type MediaAssetInterpretation = {
	projection: 'equirectangular'
	colorSpace: 'srgb' | 'linear'
	normalY?: 'up' | 'down'
	elevationUnit?: 'relative' | 'm' | 'km'
	/** Physical value = normalized texture sample * scale + offset. */
	elevationScale?: number
	elevationOffset?: number
	elevationDatum?: string
	elevationPositiveDirection?: 'up' | 'down'
	sampleChannel?: 'green'
}

/** Stable identity plus an immutable content revision for a selected Media asset. */
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

export type MediaCompatibility = {
	compatible: boolean
	warnings: string[]
	errors: string[]
}

const HASH_PATTERN = /^[\da-f]{64}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function interpretationForPurpose(purpose: CelestialMediaPurpose): MediaAssetInterpretation {
	const colorSpace = purpose === 'surface-albedo'
		|| purpose === 'surface-emissive'
		|| purpose === 'stellar-photosphere'
		? 'srgb'
		: 'linear'
	const interpretation: MediaAssetInterpretation = { projection: 'equirectangular', colorSpace }
	if (purpose === 'surface-normal') interpretation.normalY = 'up'
	if (purpose === 'surface-elevation') interpretation.elevationUnit = 'relative'
	if (purpose === 'surface-roughness') interpretation.sampleChannel = 'green'
	return interpretation
}

/** Accept v2 bindings and legacy v1 filename strings without losing old maps. */
export function parseMediaAssetBinding(
	value: unknown,
	purpose: CelestialMediaPurpose,
): MediaAssetBinding | null {
	if (typeof value === 'string' && value.trim()) {
		return {
			version: MEDIA_ASSET_BINDING_VERSION,
			mediaId: null,
			filename: value.trim(),
			contentHash: null,
			interpretation: interpretationForPurpose(purpose),
		}
	}
	if (!isRecord(value) || typeof value.filename !== 'string' || !value.filename.trim()) return null
	const defaults = interpretationForPurpose(purpose)
	const rawInterpretation = isRecord(value.interpretation) ? value.interpretation : {}
	const interpretation: MediaAssetInterpretation = {
		...defaults,
		projection: 'equirectangular',
		colorSpace: rawInterpretation.colorSpace === 'srgb' || rawInterpretation.colorSpace === 'linear'
			? rawInterpretation.colorSpace
			: defaults.colorSpace,
	}
	if (purpose === 'surface-normal') {
		interpretation.normalY = rawInterpretation.normalY === 'down' ? 'down' : 'up'
	}
	if (purpose === 'surface-elevation') {
		interpretation.elevationUnit = rawInterpretation.elevationUnit === 'm' || rawInterpretation.elevationUnit === 'km'
			? rawInterpretation.elevationUnit
			: 'relative'
		const scale = finiteNumber(rawInterpretation.elevationScale)
		const offset = finiteNumber(rawInterpretation.elevationOffset)
		if (scale != null && scale > 0) interpretation.elevationScale = scale
		if (offset != null) interpretation.elevationOffset = offset
		if (typeof rawInterpretation.elevationDatum === 'string' && rawInterpretation.elevationDatum.trim()) {
			interpretation.elevationDatum = rawInterpretation.elevationDatum.trim()
		}
		if (rawInterpretation.elevationPositiveDirection === 'up' || rawInterpretation.elevationPositiveDirection === 'down') {
			interpretation.elevationPositiveDirection = rawInterpretation.elevationPositiveDirection
		}
	}
	if (purpose === 'surface-roughness') interpretation.sampleChannel = 'green'

	return {
		version: MEDIA_ASSET_BINDING_VERSION,
		mediaId: typeof value.mediaId === 'number' && Number.isInteger(value.mediaId) && value.mediaId > 0
			? value.mediaId
			: null,
		filename: value.filename.trim(),
		contentHash: typeof value.contentHash === 'string' && HASH_PATTERN.test(value.contentHash)
			? value.contentHash.toLowerCase()
			: null,
		interpretation,
	}
}

export function mediaBindingFromItem(
	item: MediaAssetListItem,
	purpose: CelestialMediaPurpose,
): MediaAssetBinding {
	return {
		version: MEDIA_ASSET_BINDING_VERSION,
		mediaId: item.id,
		filename: item.filename,
		contentHash: item.hash,
		interpretation: interpretationForPurpose(purpose),
	}
}

export function assessMediaCompatibility(
	item: Pick<MediaAssetListItem, 'mimeType' | 'width' | 'height' | 'hash'>,
): MediaCompatibility {
	const errors: string[] = []
	const warnings: string[] = []
	if (!item.mimeType?.startsWith('image/')) errors.push('Not a renderable image')
	if (!item.width || !item.height) {
		errors.push('Image dimensions are unavailable')
	} else {
		const ratio = item.width / item.height
		if (Math.abs(ratio - 2) > 0.04) errors.push(`Expected a 2:1 equirectangular plate; this is ${ratio.toFixed(2)}:1`)
		if (item.width < 1024 || item.height < 512) warnings.push('Below the recommended 1024 × 512 overview resolution')
	}
	if (!item.hash) errors.push('The asset has no immutable content hash')
	return { compatible: errors.length === 0, warnings, errors }
}

export function mediaAssetContentUrl(binding: MediaAssetBinding): string {
	if (binding.mediaId && binding.contentHash) {
		return `/api/media-assets/${binding.mediaId}/${binding.contentHash}`
	}
	return `/api/media/${encodeURIComponent(binding.filename)}`
}

export function purposeLabel(purpose: CelestialMediaPurpose): string {
	return ({
		'surface-albedo': 'albedo map',
		'surface-elevation': 'elevation map',
		'surface-normal': 'normal map',
		'surface-roughness': 'roughness map',
		'surface-emissive': 'emissive map',
		'stellar-photosphere': 'photosphere plate',
	} satisfies Record<CelestialMediaPurpose, string>)[purpose]
}
