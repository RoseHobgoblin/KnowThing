import { requestJson } from '$lib/transport/json.js'

export function saveRodderEntity<T>(slug: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
	return requestJson<T>(method, `/api/rodder/${encodeURIComponent(slug)}`, body)
}

export function rodderDownloadRoute(slug: string) {
	return ['/api/rodder/[slug]?download=1', { slug }] as const
}
