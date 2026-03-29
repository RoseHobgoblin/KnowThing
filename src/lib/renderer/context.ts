import { getContext, setContext } from 'svelte'
import { writable, type Writable } from 'svelte/store'
import type { TemplateArg, WikiNode } from '$lib/parser/types.js'
import type { ResolvedDate } from '$lib/calendar/types.js'

const KNOW_CONTEXT_KEY = 'know-render-context'

export interface KnowRenderContext {
	/** Base URL for media files, e.g. '/api/media' */
	mediaBaseUrl: string
	/** Base URL for article pages, e.g. '/know' */
	pageBaseUrl: string
	/** Footnotes collected by WikiReference, consumed by WikiReferenceList */
	footnotes: Writable<FootnoteEntry[]>
	/** Set of existing page slugs for red-link detection (know domain) */
	existingPages: Set<string>
	/** All existing content across domains for cross-domain red-link detection */
	existingContent: Map<string, Set<string>>
	/** Resolve a simple (DB-stored) template — returns expanded AST or null */
	templateResolver: ((name: string, args: TemplateArg[]) => WikiNode[] | null) | null
	/** Current page name (for magic words like {{PAGENAME}}) */
	pageName: string
	/** Current namespace (e.g. 'Template', 'Category', or '') */
	namespace: string
	/** Pre-expanded DB templates keyed by lowercase name */
	templates: Map<string, string> | null
	/** Resolved calendar date for calendar magic words */
	calendarDate: ResolvedDate | null
	/** Pre-fetched structured data for from=slug infobox resolution */
	structuredData: Map<string, Map<string, string>> | null
	/** Pre-fetched system map data for {{System map|slug}} */
	systemMaps: Record<string, { systemName: string, stars: any[], bodies: any[] }> | null
}

/** @deprecated Use KnowRenderContext */
export type WikiRenderContext = KnowRenderContext

export interface FootnoteEntry {
	index: number
	content: WikiNode[]
}

export function createKnowContext(overrides: Partial<KnowRenderContext> = {}): KnowRenderContext {
	const ctx: KnowRenderContext = {
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		footnotes: writable([]),
		existingPages: new Set(),
		existingContent: new Map(),
		templateResolver: null,
		pageName: '',
		namespace: '',
		templates: null,
		calendarDate: null,
		structuredData: null,
		systemMaps: null,
		...overrides,
	}
	setContext(KNOW_CONTEXT_KEY, ctx)
	return ctx
}

/** @deprecated Use createKnowContext */
export const createWikiContext = createKnowContext

export function getKnowContext(): KnowRenderContext {
	return getContext<KnowRenderContext>(KNOW_CONTEXT_KEY)
}

/** @deprecated Use getKnowContext */
export const getWikiContext = getKnowContext

/** Alias used by WikiTemplate dispatch chain */
export const getRenderContext = getKnowContext

/** Convert a page title to a URL slug — first letter uppercase, rest preserved */
export function slugify(title: string): string {
	const cleaned = title
		.trim()
		.normalize('NFC')
		.replaceAll(' ', '_')
		.replaceAll(/[^\p{L}\p{N}_().\-]/gu, '')
	if (!cleaned) return cleaned
	return cleaned[0].toUpperCase() + cleaned.slice(1)
}
