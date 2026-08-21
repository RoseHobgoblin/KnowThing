export const MEDIA_CONTENT_BASE_URL = '/api/media'

export function mediaContentUrl(filename: string, width?: number): string {
	const base = `${MEDIA_CONTENT_BASE_URL}/${encodeURIComponent(filename)}`
	return width ? `${base}?w=${width}` : base
}

export function pinnedMediaContentUrl(mediaId: number, contentHash: string): string {
	return `/api/media-assets/${mediaId}/${contentHash}`
}
