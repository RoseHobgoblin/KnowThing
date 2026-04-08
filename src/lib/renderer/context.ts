import { getContext, setContext } from 'svelte'
import { writable, type Writable } from 'svelte/store'
import type { TemplateArg, WikiNode } from '$lib/parser/types.js'
import type { ResolvedDate } from '$lib/calendar/types.js'

const KNOW_CONTEXT_KEY = 'know-render-context'

export interface ResolvedLink {
	href: string
	exists: boolean
}

export interface KnowRenderContext {
	/** Base URL for media files, e.g. '/api/media' */
	mediaBaseUrl: string
	/** Base URL for article pages, e.g. '/know' */
	pageBaseUrl: string
	/** Content domain for this page (know, celestial, calendar) — used for link resolution */
	sourceDomain: string
	/** Footnotes collected by WikiReference, consumed by WikiReferenceList */
	footnotes: Writable<FootnoteEntry[]>
	/** Per-page resolved link map keyed by "domain:slug" */
	resolvedLinks: Map<string, ResolvedLink>
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

export interface FootnoteEntry {
	index: number
	content: WikiNode[]
}

export function createKnowContext(overrides: Partial<KnowRenderContext> = {}): KnowRenderContext {
	const ctx: KnowRenderContext = {
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		sourceDomain: 'know',
		footnotes: writable([]),
		resolvedLinks: new Map(),
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

export function getKnowContext(): KnowRenderContext {
	return getContext<KnowRenderContext>(KNOW_CONTEXT_KEY)
}

// Re-export — callers import slugify from here
export { wikiSlugify as slugify } from '$lib/utils/slugify.js'
