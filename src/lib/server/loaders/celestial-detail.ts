import { error, redirect } from '@sveltejs/kit'
import type { Cookies } from '@sveltejs/kit'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'
import { hasRole } from '$lib/server/auth.js'
import { resolveStructuredData } from '$lib/server/structured-data.js'
import {
	findPlanetBySlugOrPageSlug,
	findStarBySlugOrPageSlug,
	findSystemBySlugOrPageSlug,
	getBodiesForSystemMap,
	getCalendarsForSystem,
	getStarSystemId,
	getStarSystemRef,
	getStarsForSystemMap,
	listAllStarRefs,
	listAllSystemRefs,
	listSiblingBodies,
} from '$lib/server/services/celestial-registry.js'
import { loadEntityBody } from '$lib/server/services/entity-article-loader.js'

export interface CelestialDetailContext {
	identifier: string
	mode: 'view' | 'edit' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string // already-encoded path for /auth/login?redirect=<this>
	canonicalize: (slug: string) => string // builds the canonical view URL from a slug
}

export type ParentCrumb = { label: string, href: string }

export type CelestialDetailData =
	| (CelestialBaseData & {
		kind: 'system'
		body: Awaited<ReturnType<typeof findSystemBySlugOrPageSlug>>
		systemStars: MapBody[]
		systemBodies: MapBody[]
		systemCalendars: Awaited<ReturnType<typeof getCalendarsForSystem>>
	})
	| (CelestialBaseData & {
		kind: 'star'
		body: Awaited<ReturnType<typeof findStarBySlugOrPageSlug>>
		allSystems: Awaited<ReturnType<typeof listAllSystemRefs>>
	})
	| (CelestialBaseData & {
		kind: 'planet'
		body: Awaited<ReturnType<typeof findPlanetBySlugOrPageSlug>>
		allStars: Awaited<ReturnType<typeof listAllStarRefs>>
		siblings: Awaited<ReturnType<typeof listSiblingBodies>>
	})

interface CelestialBaseData {
	isEditMode: boolean
	isConfigureMode: boolean
	parentCrumbs: ParentCrumb[]
	infoboxFields: Record<string, string> | null
	wikiContent: string
	ast: unknown
	contentRecordId: number | null
	resolvedLinks: Record<string, { href: string, exists: boolean }>
}

/**
 * Shared celestial detail loader. Resolves the input identifier (slug or
 * pageSlug) against system → star → planet, returns the discriminated data
 * shape used by both the canonical `/Celestial:Slug` route and the legacy
 * `/celestial/[...path]` redirect stub.
 *
 * Throws SvelteKit redirects on:
 *  - login required for edit/configure
 *  - non-editor user attempting edit/configure (sent back to view)
 *  - canonical-slug mismatch (sent to canonical URL)
 *  - 404 if not found in any celestial table
 */
export async function loadCelestialDetail(ctx: CelestialDetailContext): Promise<CelestialDetailData> {
	const { identifier, mode, user, loginRedirectPath, canonicalize } = ctx

	if (mode !== 'view') {
		if (!user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(loginRedirectPath)}`)
		}
		if (!hasRole(user.role, 'editor')) {
			throw redirect(302, canonicalize(identifier))
		}
	}

	const isEditMode = mode === 'edit'
	const isConfigureMode = mode === 'configure'

	const system = await findSystemBySlugOrPageSlug(identifier)
	if (system) {
		if (system.slug !== identifier && !isEditMode) {
			throw redirect(301, canonicalize(system.slug))
		}
		const article = await loadEntityBody({
			kind: 'system',
			entityId: system.id,
			body: system.body ?? '',
			bodyParsedAst: system.bodyParsedAst,
		})
		const systemStars = [...await getStarsForSystemMap(system.id)] as unknown as MapBody[]
		const systemBodies = [...await getBodiesForSystemMap(system.id)] as unknown as MapBody[]
		const systemCalendars = await getCalendarsForSystem(system.id)
		const infoboxFields = await resolveStructuredData('system', system.slug)
		return {
			kind: 'system',
			body: system,
			isEditMode,
			isConfigureMode,
			systemStars,
			systemBodies,
			systemCalendars,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			parentCrumbs: [],
			...article,
		}
	}

	const star = await findStarBySlugOrPageSlug(identifier)
	if (star) {
		if (star.slug !== identifier && !isEditMode) {
			throw redirect(301, canonicalize(star.slug))
		}
		const parentSystem = star.systemId ? await getStarSystemRef(star.systemId) : null
		const allSystems = await listAllSystemRefs()
		const article = await loadEntityBody({
			kind: 'star',
			entityId: star.id,
			body: star.body ?? '',
			bodyParsedAst: star.bodyParsedAst,
		})
		const parentCrumbs: ParentCrumb[] = []
		if (parentSystem) parentCrumbs.push({ label: parentSystem.name, href: canonicalize(parentSystem.slug) })
		const infoboxFields = await resolveStructuredData('star', star.slug)
		return {
			kind: 'star',
			body: star,
			allSystems,
			isEditMode,
			isConfigureMode,
			parentCrumbs,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			...article,
		}
	}

	const planet = await findPlanetBySlugOrPageSlug(identifier)
	if (planet) {
		if (planet.slug !== identifier && !isEditMode) {
			throw redirect(301, canonicalize(planet.slug))
		}
		let parentSystem: { name: string, slug: string } | null = null
		if (planet.starId) {
			const systemId = await getStarSystemId(planet.starId)
			if (systemId) parentSystem = await getStarSystemRef(systemId)
		}
		const parentCrumbs: ParentCrumb[] = []
		if (parentSystem) parentCrumbs.push({ label: parentSystem.name, href: canonicalize(parentSystem.slug) })

		const allStars = await listAllStarRefs()
		const siblings = planet.starId ? await listSiblingBodies(planet.starId) : []
		const article = await loadEntityBody({
			kind: 'planet',
			entityId: planet.id,
			body: planet.body ?? '',
			bodyParsedAst: planet.bodyParsedAst,
		})
		const infoboxFields = await resolveStructuredData('planet', planet.slug)
		return {
			kind: 'planet',
			body: planet,
			allStars,
			siblings,
			isEditMode,
			isConfigureMode,
			parentCrumbs,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			...article,
		}
	}

	throw error(404, 'Celestial body not found')
}

// Suppress unused-import warning when Cookies is referenced only in JSDoc.
export type _Cookies = Cookies
