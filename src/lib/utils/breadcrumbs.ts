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

export function knowBreadcrumbs(title: string): Breadcrumb[] {
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

export function celestialBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Celestial Registry' }]
}

export function celestialPathBreadcrumbs(
	pathSegments: { label: string, href: string }[],
	name: string,
): Breadcrumb[] {
	return [
		{ label: 'Celestial Registry', href: '/celestial' },
		...pathSegments,
		{ label: name },
	]
}

export function celestialConfigureBreadcrumbs(
	parentCrumbs: { label: string, href: string }[],
	body: { name: string, slug: string },
): Breadcrumb[] {
	// Celestial canonical URLs are flat /Celestial:Slug (no parent path).
	const viewHref = `/Celestial:${body.slug}`
	return [
		{ label: 'Celestial Registry', href: '/celestial' },
		...parentCrumbs,
		{ label: body.name, href: viewHref },
		{ label: 'Configure' },
	]
}

// ── Calendar ───────────────────────────────────────────────────────────

export function calendarBreadcrumbs(): Breadcrumb[] {
	return [{ label: 'Calendar' }]
}

export function calendarDetailBreadcrumbs(
	name: string,
): Breadcrumb[] {
	return [
		{ label: 'Calendar', href: '/calendar' },
		{ label: name },
	]
}

export function calendarConfigureBreadcrumbs(
	calendar: { name: string, slug: string },
): Breadcrumb[] {
	return [
		{ label: 'Calendar', href: '/calendar' },
		{ label: calendar.name, href: `/Calendar:${calendar.slug}` },
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
