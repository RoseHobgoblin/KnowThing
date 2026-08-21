import { requestJson } from '$lib/transport/json.js'
import type { WikiNode } from '$lib/parser/types.js'
import type { ResolvedLink } from './context.js'

export type RenderPreviewResponse = {
	ast: WikiNode
	resolvedLinks: Record<string, ResolvedLink>
	rodderEntities: Record<string, unknown>
	rodderSectors: Record<string, unknown>
	rodderDisplayOverflow: number
}

export function renderWikiPreview(content: string, domain: string) {
	return requestJson<RenderPreviewResponse>('POST', '/api/render', { content, domain })
}

export function loadPageSummary<T>(slug: string, domain: string) {
	return requestJson<T>('GET', `/api/pages/summary?slug=${encodeURIComponent(slug)}&domain=${encodeURIComponent(domain)}`)
}
