import { error, redirect } from '@sveltejs/kit'
import type { Cookies } from '@sveltejs/kit'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'
import { hasRole } from '$lib/server/auth.js'
import { resolveCelestialModel } from '$lib/server/structured-data.js'
import { deriveHabitableZoneAu } from '$lib/celestial/compute.js'
import type { BodyModel, StarModel } from '$lib/celestial/models.js'
import { findNearestStarAncestor } from '$lib/server/celestial/hierarchy.js'
import {
	findCelestialBySlugOrName,
	getBacklinksForCelestial,
	getCalendarsForSystem,
	getSystemMapEntities,
	getPlanetsForStar,
	getStarHzInputs,
	listAllStarReferences,
	listAllSystemReferences,
	listAllBodyReferences,
} from '$lib/server/services/celestial-registry.js'

export interface CelestialDetailContext {
	identifier: string
	mode: 'view' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string
	canonicalize: (slug: string) => string
}

type CelestialRow = NonNullable<Awaited<ReturnType<typeof findCelestialBySlugOrName>>>

export type CelestialDetailData =
	| (CelestialBaseData & {
		kind: 'system'
		body: CelestialRow
		systemStars: MapBody[]
		systemBodies: MapBody[]
		systemCalendars: Awaited<ReturnType<typeof getCalendarsForSystem>>
	})
	| (CelestialBaseData & {
		kind: 'star'
		body: CelestialRow
		allSystems: Awaited<ReturnType<typeof listAllSystemReferences>>
		allStars: Awaited<ReturnType<typeof listAllStarReferences>>
		model: StarModel | null
		systemPlanets: Awaited<ReturnType<typeof getPlanetsForStar>>
	})
	| (CelestialBaseData & {
		kind: 'body'
		body: CelestialRow
		allSystems: Awaited<ReturnType<typeof listAllSystemReferences>>
		allStars: Awaited<ReturnType<typeof listAllStarReferences>>
		siblings: Awaited<ReturnType<typeof listAllBodyReferences>>
		model: BodyModel | null
		parentStarHz: { inner: number, outer: number } | null
	})

interface CelestialBaseData {
	isEditMode: false
	isConfigureMode: boolean
	backlinks: Awaited<ReturnType<typeof getBacklinksForCelestial>>
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

	// One lookup — the row's kind discriminates. Slugs are globally unique
	// across the celestial domain, so there is no probe order to get wrong.
	const entity = await findCelestialBySlugOrName(identifier)
	if (!entity) throw error(404, 'Celestial body not found')
	if (entity.slug !== identifier) {
		throw redirect(301, canonicalize(entity.slug))
	}

	if (entity.kind === 'system') {
		const [mapEntities, systemCalendars, backlinks] = await Promise.all([
			getSystemMapEntities(entity.id),
			getCalendarsForSystem(entity.id),
			getBacklinksForCelestial(entity.slug),
		])
		return {
			kind: 'system',
			body: entity,
			isEditMode: false,
			isConfigureMode,
			systemStars: mapEntities.stars as unknown as MapBody[],
			systemBodies: mapEntities.bodies as unknown as MapBody[],
			systemCalendars,
			backlinks,
		}
	}

	if (entity.kind === 'star') {
		const [allSystems, allStars, rawModel, systemPlanets, backlinks] = await Promise.all([
			listAllSystemReferences(), listAllStarReferences(), resolveCelestialModel('star', entity.slug), getPlanetsForStar(entity.id), getBacklinksForCelestial(entity.slug),
		])
		const model = rawModel?.kind === 'star' ? rawModel : null
		return {
			kind: 'star',
			body: entity,
			allSystems,
			allStars,
			model,
			systemPlanets,
			isEditMode: false,
			isConfigureMode,
			backlinks,
		}
	}

	const [allSystems, allStars, siblings, rawModel, backlinks, nearestStar] = await Promise.all([
		listAllSystemReferences(),
		listAllStarReferences(),
		listAllBodyReferences(),
		resolveCelestialModel('body', entity.slug),
		getBacklinksForCelestial(entity.slug),
		entity.parentId == null ? Promise.resolve(null) : findNearestStarAncestor(entity.parentId),
	])
	const model = rawModel?.kind === 'body' ? rawModel : null
	// The parent star's habitable zone, so a planet can show whether it sits in
	// it — fetched as just the luminosity inputs, not the star's whole model
	// with its discarded planet/satellite counts.
	const parentStarHzInputs = nearestStar ? await getStarHzInputs(nearestStar.id) : null
	const parentStarHz = parentStarHzInputs
		? deriveHabitableZoneAu(parentStarHzInputs.luminosityW, parentStarHzInputs.radiusM, parentStarHzInputs.temperatureK)
		: null
	return {
		kind: 'body',
		body: entity,
		allSystems,
		allStars,
		siblings,
		model,
		parentStarHz,
		isEditMode: false,
		isConfigureMode,
		backlinks,
	}
}

export type _Cookies = Cookies
