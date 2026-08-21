import { requestJson } from '$lib/transport/json.js'
import type { MediaAssetBinding, MediaAssetListItem } from './media-binding.js'
import { mediaContentUrl } from './media-urls.js'

export type MediaAssetPage = { files: MediaAssetListItem[], total: number }

export function mediaAssetMetadataUrl(binding: Pick<MediaAssetBinding, 'mediaId' | 'filename'>): string {
	return binding.mediaId
		? `/api/media-assets/${binding.mediaId}`
		: `/api/media-assets?filename=${encodeURIComponent(binding.filename)}`
}

export function mediaThumbnailUrl(filename: string, width = 300): string {
	return mediaContentUrl(filename, width)
}

export function getMediaAsset(binding: Pick<MediaAssetBinding, 'mediaId' | 'filename'>, signal?: AbortSignal) {
	return requestJson<MediaAssetListItem>('GET', mediaAssetMetadataUrl(binding), undefined, { signal })
}

export function listMediaAssets(params: URLSearchParams, signal?: AbortSignal) {
	return requestJson<MediaAssetPage>('GET', `/api/media?${params}`, undefined, { signal })
}

export function uploadMediaAsset(file: File, signal?: AbortSignal) {
	const formData = new FormData()
	formData.append('file', file)
	return requestJson<MediaAssetListItem>('POST', '/api/media', formData, { signal })
}
