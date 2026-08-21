import { createContext, type Component } from 'svelte'
import { writable, type Writable } from 'svelte/store'
import type { TemplateArg, WikiNode } from '$lib/parser/types.js'
import type { CalendarConfig, ResolvedDate } from 'rimecraft'
import { CORE_WIKI_TEMPLATES, type BuiltinEntry } from '$lib/templates/registry.js'

export interface MediaRenderProps {
	filename: string
	alt?: string
	caption?: string
	displayWidth?: number
	sizes?: string
	class?: string
	loading?: 'eager' | 'lazy'
	linkable?: boolean
}

const [getRenderContext, setRenderContext] = createContext<KnowRenderContext>()

export interface ResolvedLink {
	href: string
	exists: boolean
}

export interface KnowRenderContext {
	/** Base URL for media files, e.g. '/api/media' */
	mediaBaseUrl: string
	/** Base URL for article pages, e.g. '/know' */
	pageBaseUrl: string
	/** Content domain for this page (know, rodder, calendar) — used for link resolution */
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
	/** Active calendar config (needed to format arbitrary timestamps in {{date}}) */
	calendarConfig: CalendarConfig | null
	/** Pre-fetched structured data for from=slug infobox resolution */
	structuredData: Map<string, Map<string, string>> | null
	/** Pre-fetched array-shaped structured data (phoneme grids, etc) keyed by `${type}:${slug}` */
	structuredCollections: Record<string, Record<string, unknown>[]> | null
	/** Feature-owned serializable resources, keyed by an agreed composition key. */
	extensionResources: ReadonlyMap<string, unknown>
	/** Immutable registry assembled at the route/composition boundary. */
	templateComponents: ReadonlyMap<string, BuiltinEntry>
	/** Media rendering is supplied by composition; the renderer never imports Media. */
	mediaRenderer: Component<MediaRenderProps> | null
}

export interface FootnoteEntry {
	index: number
	content: WikiNode[]
}

function defaultKnowContext(overrides: Partial<KnowRenderContext> = {}): KnowRenderContext {
	return {
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
		calendarConfig: null,
		structuredData: null,
		structuredCollections: null,
		extensionResources: new Map(),
		templateComponents: CORE_WIKI_TEMPLATES,
		mediaRenderer: null,
		...overrides,
	}
}

export function createKnowContext(overrides: Partial<KnowRenderContext> = {}): KnowRenderContext {
	const ctx = defaultKnowContext(overrides)
	setRenderContext(ctx)
	return ctx
}

/**
 * Renderer nodes call this at init. A page that renders wikitext without calling
 * `createKnowContext` (e.g. a listing embedding InlineMarkup) would otherwise get
 * `undefined` and crash SSR on the first wikilink. Fall back to an empty context
 * instead: links resolve to their deterministic redlink hrefs, and the page renders.
 */
export function getKnowContext(): KnowRenderContext {
	try {
		return getRenderContext() ?? defaultKnowContext()
	} catch {
		return defaultKnowContext()
	}
}

// Re-export — callers import slugify from here
export { wikiSlugify as slugify } from '$lib/utils/slugify.js'
