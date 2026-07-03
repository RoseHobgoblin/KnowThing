import { error, redirect } from '@sveltejs/kit'
import type { Cookies } from '@sveltejs/kit'
import type { MapBody } from '$lib/celestial/SystemMap.svelte'
import { hasRole } from '$lib/server/auth.js'
import { resolveStructuredData, resolveCelestialModel } from '$lib/server/structured-data.js'
import { planetInfoboxFields, starInfoboxFields } from '$lib/celestial/projections.js'
import type { PlanetModel, StarModel } from '$lib/celestial/models.js'
import {
	findPlanetBySlugOrPageSlug,
	findStarBySlugOrPageSlug,
	findSystemBySlugOrPageSlug,
	getBacklinksForCelestial,
	getBodiesForSystemMap,
	getCalendarsForSystem,
	getStarsForSystemMap,
	getPlanetsForStar,
	listAllStarRefs,
	listAllSystemRefs,
	listAllBodyRefs,
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
		allStars: Awaited<ReturnType<typeof listAllStarRefs>>
		model: StarModel | null
		systemPlanets: Awaited<ReturnType<typeof getPlanetsForStar>>
	})
	| (CelestialBaseData & {
		kind: 'planet'
		body: Awaited<ReturnType<typeof findPlanetBySlugOrPageSlug>>
		allStars: Awaited<ReturnType<typeof listAllStarRefs>>
		siblings: Awaited<ReturnType<typeof listAllBodyRefs>>
		model: PlanetModel | null
		parentStarHz: { inner: number, outer: number } | null
	})

interface CelestialBaseData {
	isEditMode: false
	isConfigureMode: boolean
	infoboxFields: Record<string, string> | null
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

	const system = await findSystemBySlugOrPageSlug(identifier)
	if (system) {
		if (system.slug !== identifier) {
			throw redirect(301, canonicalize(system.slug))
		}
		const systemStars = [...await getStarsForSystemMap(system.id)] as unknown as MapBody[]
		const systemBodies = [...await getBodiesForSystemMap(system.id)] as unknown as MapBody[]
		const systemCalendars = await getCalendarsForSystem(system.id)
		const infoboxFields = await resolveStructuredData('system', system.slug)
		const backlinks = await getBacklinksForCelestial(system.slug)
		return {
			kind: 'system',
			body: system,
			isEditMode: false,
			isConfigureMode,
			systemStars,
			systemBodies,
			systemCalendars,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			backlinks,
		}
	}

	const star = await findStarBySlugOrPageSlug(identifier)
	if (star) {
		if (star.slug !== identifier) {
			throw redirect(301, canonicalize(star.slug))
		}
		const [allSystems, allStars, rawModel, systemPlanets, backlinks] = await Promise.all([
			listAllSystemRefs(), listAllStarRefs(), resolveCelestialModel('star', star.slug), getPlanetsForStar(star.id), getBacklinksForCelestial(star.slug),
		])
		// The infobox (for Know-article embeds) is one projection of the model —
		// derive it here rather than re-fetching, so there's one source of truth.
		const model = rawModel?.kind === 'star' ? rawModel : null
		const infoboxFields = model ? starInfoboxFields(model) : null
		return {
			kind: 'star',
			body: star,
			allSystems,
			allStars,
			model,
			systemPlanets,
			isEditMode: false,
			isConfigureMode,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			backlinks,
		}
	}

	const planet = await findPlanetBySlugOrPageSlug(identifier)
	if (planet) {
		if (planet.slug !== identifier) {
			throw redirect(301, canonicalize(planet.slug))
		}
		const [allStars, siblings, rawModel, backlinks] = await Promise.all([
			listAllStarRefs(), listAllBodyRefs(), resolveCelestialModel('planet', planet.slug), getBacklinksForCelestial(planet.slug),
		])
		const model = rawModel?.kind === 'planet' ? rawModel : null
		const infoboxFields = model ? planetInfoboxFields(model) : null
		// The parent star's habitable zone, so a planet can show whether it sits in it.
		const parentStarModel = model?.star ? await resolveCelestialModel('star', model.star.slug) : null
		const parentStarHz = parentStarModel?.kind === 'star' ? parentStarModel.habitableZoneAu : null
		return {
			kind: 'planet',
			body: planet,
			allStars,
			siblings,
			model,
			parentStarHz,
			isEditMode: false,
			isConfigureMode,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			backlinks,
		}
	}

	throw error(404, 'Celestial body not found')
}

export type _Cookies = Cookies
