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
import { findPageCaseInsensitive } from '$lib/server/services/pages.js'

export interface CelestialDetailContext {
	identifier: string
	mode: 'view' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string
	canonicalize: (slug: string) => string
}

export type ParentCrumb = { label: string, href: string }

export type KnowMatch = { slug: string, title: string } | null

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
	isEditMode: false
	isConfigureMode: boolean
	parentCrumbs: ParentCrumb[]
	infoboxFields: Record<string, string> | null
	knowMatch: KnowMatch
}

/**
 * Find the matching Know article for a celestial entity. Prefer page_slug,
 * fall back to the entity's slug. Returns null if no Know article exists.
 */
async function findKnowMatch(pageSlug: string | null, entitySlug: string): Promise<KnowMatch> {
	const candidate = pageSlug || entitySlug
	if (!candidate) return null
	const record = await findPageCaseInsensitive('know', candidate)
	if (!record) return null
	return { slug: record.slug, title: record.title }
}

export async function loadCelestialDetail(ctx: CelestialDetailContext): Promise<CelestialDetailData> {
	const { identifier, mode, user, loginRedirectPath, canonicalize } = ctx

	if (mode === 'configure') {
		if (!user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(loginRedirectPath)}`)
		}
		if (!hasRole(user.role, 'editor')) {
			throw redirect(302, canonicalize(identifier))
		}
	}

	const isConfigureMode = mode === 'configure'

	const system = await findSystemBySlugOrPageSlug(identifier)
	if (system) {
		if (system.slug !== identifier) {
			throw redirect(301, canonicalize(system.slug))
		}
		const systemStars = [...await getStarsForSystemMap(system.id)] as unknown as MapBody[]
		const systemBodies = [...await getBodiesForSystemMap(system.id)] as unknown as MapBody[]
		const systemCalendars = await getCalendarsForSystem(system.id)
		const infoboxFields = await resolveStructuredData('system', system.slug)
		const knowMatch = await findKnowMatch(system.pageSlug ?? null, system.slug)
		return {
			kind: 'system',
			body: system,
			isEditMode: false,
			isConfigureMode,
			systemStars,
			systemBodies,
			systemCalendars,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			parentCrumbs: [],
			knowMatch,
		}
	}

	const star = await findStarBySlugOrPageSlug(identifier)
	if (star) {
		if (star.slug !== identifier) {
			throw redirect(301, canonicalize(star.slug))
		}
		const parentSystem = star.systemId ? await getStarSystemRef(star.systemId) : null
		const allSystems = await listAllSystemRefs()
		const parentCrumbs: ParentCrumb[] = []
		if (parentSystem) parentCrumbs.push({ label: parentSystem.name, href: canonicalize(parentSystem.slug) })
		const infoboxFields = await resolveStructuredData('star', star.slug)
		const knowMatch = await findKnowMatch(star.pageSlug ?? null, star.slug)
		return {
			kind: 'star',
			body: star,
			allSystems,
			isEditMode: false,
			isConfigureMode,
			parentCrumbs,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			knowMatch,
		}
	}

	const planet = await findPlanetBySlugOrPageSlug(identifier)
	if (planet) {
		if (planet.slug !== identifier) {
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
		const infoboxFields = await resolveStructuredData('planet', planet.slug)
		const knowMatch = await findKnowMatch(planet.pageSlug ?? null, planet.slug)
		return {
			kind: 'planet',
			body: planet,
			allStars,
			siblings,
			isEditMode: false,
			isConfigureMode,
			parentCrumbs,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			knowMatch,
		}
	}

	throw error(404, 'Celestial body not found')
}

export type _Cookies = Cookies
