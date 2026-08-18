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
	/**
	 * For namespaced labels like "Rodder:Therne": link only the prefix
	 * before the first ":" to this href; render the colon and the rest inert.
	 */
	namespaceHref?: string
}

// ── Know (wiki articles) ───────────────────────────────────────────────
// Note: the Know→Wordbook backlink is rendered as in-article panels by
// KnowArticle (wordbookMatch/languageMatch), not as breadcrumbs — a Know
// article isn't hierarchically *under* the Wordbook.

export function knowBreadcrumbs(title: string): Breadcrumb[] {
	return [
		{ label: 'know' },
		{ label: title.replaceAll(/\s+/g, '_') },
	]
}

// ── Wordbook ───────────────────────────────────────────────────────────

export function wordbookBreadcrumbs(
	wordbookName: string,
): Breadcrumb[] {
	return [{ label: wordbookName }]
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

// ── Rodder ──────────────────────────────────────────────────────────

/** Hub breadcrumb (e.g. /rodder) */
export function rodderRegistryBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Rodder' }]
}

/** Single-crumb namespaced form: e.g. "Rodder:Sun". */
export function rodderBreadcrumbs(name: string): Breadcrumb[] {
	return [{ label: `Rodder:${name.replaceAll(/\s+/g, '_')}`, namespaceHref: '/rodder' }]
}

/** Sector page (e.g. /rodder/sector/local-sector). */
export function rodderSectorBreadcrumbs(name: string): Breadcrumb[] {
	return [
		{ label: 'Rodder', href: '/rodder' },
		{ label: name },
	]
}

export function rodderConfigureBreadcrumbs(
	_parentCrumbs: { label: string, href: string }[],
	body: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: `Rodder:${body.name.replaceAll(/\s+/g, '_')}`, href: `/Rodder:${body.slug}`, namespaceHref: '/rodder' },
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
	return [{ label: `Calendar:${name.replaceAll(/\s+/g, '_')}`, namespaceHref: '/calendar' }]
}

export function calendarConfigureBreadcrumbs(
	calendar: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: `Calendar:${calendar.name.replaceAll(/\s+/g, '_')}`, href: `/Calendar:${calendar.slug}`, namespaceHref: '/calendar' },
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
		{ '@type': 'ListItem', 'position': 1, 'name': rootLabel, 'item': `${origin}/` },
	]

	for (let index = 0; index < crumbs.length; index++) {
		const crumb = crumbs[index]
		const entry: Record<string, unknown> = {
			'@type': 'ListItem',
			'position': index + 2,
			'name': crumb.label,
		}
		if (crumb.href) entry.item = `${origin}${crumb.href}`
		items.push(entry as typeof items[number])
	}

	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		'itemListElement': items,
	}
}
