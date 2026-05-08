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
	getStarsForSystemMap,
	listAllStarRefs,
	listAllSystemRefs,
	listSiblingBodies,
} from '$lib/server/services/celestial-registry.js'

export interface CelestialDetailContext {
	identifier: string
	mode: 'view' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string
	canonicalize: (slug: string) => string
}

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
	infoboxFields: Record<string, string> | null
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
		return {
			kind: 'system',
			body: system,
			isEditMode: false,
			isConfigureMode,
			systemStars,
			systemBodies,
			systemCalendars,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
		}
	}

	const star = await findStarBySlugOrPageSlug(identifier)
	if (star) {
		if (star.slug !== identifier) {
			throw redirect(301, canonicalize(star.slug))
		}
		const allSystems = await listAllSystemRefs()
		const infoboxFields = await resolveStructuredData('star', star.slug)
		return {
			kind: 'star',
			body: star,
			allSystems,
			isEditMode: false,
			isConfigureMode,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
		}
	}

	const planet = await findPlanetBySlugOrPageSlug(identifier)
	if (planet) {
		if (planet.slug !== identifier) {
			throw redirect(301, canonicalize(planet.slug))
		}
		const allStars = await listAllStarRefs()
		const siblings = planet.starId ? await listSiblingBodies(planet.starId) : []
		const infoboxFields = await resolveStructuredData('planet', planet.slug)
		return {
			kind: 'planet',
			body: planet,
			allStars,
			siblings,
			isEditMode: false,
			isConfigureMode,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
		}
	}

	throw error(404, 'Celestial body not found')
}

export type _Cookies = Cookies
