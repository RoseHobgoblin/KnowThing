/**
 * Route-aware breadcrumb builder.
 *
 * Each domain has a builder that takes route-specific data and returns a
 * crumb trail. The ArticleShell component renders the trail with semantic
 * HTML, structured data (JSON-LD), and the correct root label from siteConfig.
 */

export interface Breadcrumb {
	label: string
	href?: string
}

// ── Know (wiki articles) ───────────────────────────────────────────────

export interface KnowBreadcrumbContext {
	/** This Know article IS the encyclopedia article for a wordbook lexicon entry. */
	wordbookMatch?: { word: string, languageSlug: string, languageName: string } | null
	/** This Know article IS the encyclopedia article for a wordbook language. */
	languageMatch?: { languageSlug: string, languageName: string } | null
	/** Wordbook section label (from siteConfig); only used when a match is present. */
	wordbookName?: string
}

export function knowBreadcrumbs(title: string, ctx: KnowBreadcrumbContext = {}): Breadcrumb[] {
	const wbName = ctx.wordbookName ?? 'Wordbook'

	if (ctx.wordbookMatch) {
		return [
			{ label: wbName, href: '/Wordbook' },
			{ label: ctx.wordbookMatch.languageName, href: `/Wordbook/${ctx.wordbookMatch.languageSlug}` },
			{
				label: ctx.wordbookMatch.word,
				href: `/Wordbook/${ctx.wordbookMatch.languageSlug}/${encodeURIComponent(ctx.wordbookMatch.word)}`,
			},
			{ label: title },
		]
	}

	if (ctx.languageMatch) {
		return [
			{ label: wbName, href: '/Wordbook' },
			{ label: ctx.languageMatch.languageName, href: `/Wordbook/${ctx.languageMatch.languageSlug}` },
			{ label: title },
		]
	}

	return [{ label: title }]
}

// ── Wordbook ───────────────────────────────────────────────────────────

export function wordbookBreadcrumbs(
	wordbookName: string,
): Breadcrumb[] {
	return [{ label: wordbookName }]
}

export function wordbookLanguageBreadcrumbs(
	wordbookName: string,
	language: { name: string },
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: language.name },
	]
}

export function wordbookWordBreadcrumbs(
	wordbookName: string,
	language: { name: string, slug: string },
	word: string,
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: language.name, href: `/Wordbook/${language.slug}` },
		{ label: word },
	]
}

export function wordbookContributeBreadcrumbs(
	wordbookName: string,
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: 'Add Word' },
	]
}

export function wordbookEditBreadcrumbs(
	wordbookName: string,
	word: string,
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: word },
		{ label: 'Edit' },
	]
}

export function wordbookAddLanguageBreadcrumbs(
	wordbookName: string,
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: 'Add Language' },
	]
}

export function wordbookEditLanguageBreadcrumbs(
	wordbookName: string,
	language: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: wordbookName, href: '/Wordbook' },
		{ label: language.name, href: `/Wordbook/${language.slug}` },
		{ label: 'Edit' },
	]
}

// ── Celestial ──────────────────────────────────────────────────────────

/** Hub breadcrumb (e.g. /celestial) */
export function celestialRegistryBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Celestial Registry' }]
}

/** Single-crumb namespaced form: e.g. "Celestial:Sun". */
export function celestialBreadcrumbs(name: string): Breadcrumb[] {
	return [{ label: `Celestial:${name.replaceAll(/\s+/g, '_')}` }]
}

export function celestialConfigureBreadcrumbs(
	_parentCrumbs: { label: string, href: string }[],
	body: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: `Celestial:${body.name.replaceAll(/\s+/g, '_')}`, href: `/Celestial:${body.slug}` },
		{ label: 'Configure' },
	]
}

// ── Calendar ───────────────────────────────────────────────────────────

/** Hub breadcrumb (e.g. /calendar). */
export function calendarBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Calendar' }]
}

/** Single-crumb namespaced form: e.g. "Calendar:Iron_Flowers". */
export function calendarDetailBreadcrumbs(name: string): Breadcrumb[] {
	return [{ label: `Calendar:${name.replaceAll(/\s+/g, '_')}` }]
}

export function calendarConfigureBreadcrumbs(
	calendar: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: `Calendar:${calendar.name.replaceAll(/\s+/g, '_')}`, href: `/Calendar:${calendar.slug}` },
		{ label: 'Configure' },
	]
}

// ── World Map ──────────────────────────────────────────────────────────

export function worldmapBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'World Maps' }]
}

export function worldmapDetailBreadcrumbs(
	name: string,
): Breadcrumb[] {
	return [
		{ label: 'World Maps', href: '/worldmap' },
		{ label: name },
	]
}

export function worldmapRegionAssignmentsBreadcrumbs(
	name: string,
	slug: string,
): Breadcrumb[] {
	return [
		{ label: 'World Maps', href: '/worldmap' },
		{ label: name, href: `/worldmap/${slug}` },
		{ label: 'Region Assignments' },
	]
}

// ── Account ────────────────────────────────────────────────────────────

export function accountBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Account' }]
}

// ── Structured data (JSON-LD) ──────────────────────────────────────────

export function breadcrumbJsonLd(
	rootLabel: string,
	crumbs: Breadcrumb[],
	origin: string = '',
): object {
	const items = [
		{ '@type': 'ListItem', position: 1, name: rootLabel, item: `${origin}/` },
	]

	for (let i = 0; i < crumbs.length; i++) {
		const crumb = crumbs[i]
		const entry: Record<string, unknown> = {
			'@type': 'ListItem',
			position: i + 2,
			name: crumb.label,
		}
		if (crumb.href) entry.item = `${origin}${crumb.href}`
		items.push(entry as typeof items[number])
	}

	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items,
	}
}
