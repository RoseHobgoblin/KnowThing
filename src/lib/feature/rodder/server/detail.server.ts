import { error, redirect } from '@sveltejs/kit'
import type { Cookies } from '@sveltejs/kit'
import type { MapBody } from '$lib/feature/rodder/root-layout.js'
import { hasRole } from '$lib/server/auth.js'
import { resolveRodderModel } from '$lib/feature/rodder/server/models.server.js'
import type { BodyModel, StarModel } from 'tungolcraft'
import { resolveParentStarHz, type ParentStarHz } from '$lib/feature/rodder/server/habitable-zone.server.js'
import { findNearestStarAncestor } from '$lib/feature/rodder/server/hierarchy.server.js'
import {
	findRodderBySlugOrName,
	getBacklinksForRodder,
	getPlanetsForStar,
	getStarHzInputs,
	listAllStarReferences,
	listAllSystemReferences,
	listAllBodyReferences,
} from '$lib/feature/rodder/server/registry.server.js'
import { getSectorContextForRoot, listSectorReferences, type SectorContext } from '$lib/feature/rodder/server/sectors.server.js'
import type { ApparentSkyResult } from '$lib/feature/rodder/apparent-sky.js'
import { buildApparentSky } from '$lib/feature/rodder/apparent-sky.js'
import type { RodderEntityDocument } from '$lib/feature/rodder/consumer-contract.js'
import { resolveRodderEntityDocument } from '$lib/feature/rodder/server/documents.server.js'

export interface RodderDetailContext {
	identifier: string
	mode: 'view' | 'configure'
	user: { id: number, role: string } | null
	loginRedirectPath: string
	canonicalize: (slug: string) => string
}

type RodderRow = NonNullable<Awaited<ReturnType<typeof findRodderBySlugOrName>>>

export type RodderDetailData =
	| (RodderBaseData & {
		kind: 'system'
		// Sector root position rides on the record so the configure form can
		// hydrate/patch it like any other field (the service routes it to the
		// rodder_sector_roots table, not the system row).
		body: RodderRow & { sectorX: number | null, sectorY: number | null, sectorZ: number | null }
		sectorContext: SectorContext | null
		sectors: Awaited<ReturnType<typeof listSectorReferences>>
		rootStars: MapBody[]
		rootBodies: MapBody[]
		apparentSky: ApparentSkyResult
		rootCalendars: NonNullable<RodderEntityDocument['displays']['rootMap']>['calendars']
	})
	| (RodderBaseData & {
		kind: 'star'
		body: RodderRow
		allSystems: Awaited<ReturnType<typeof listAllSystemReferences>>
		allStars: Awaited<ReturnType<typeof listAllStarReferences>>
		model: StarModel | null
		systemPlanets: Awaited<ReturnType<typeof getPlanetsForStar>>
	})
	| (RodderBaseData & {
		kind: 'body'
		body: RodderRow & { sectorX: number | null, sectorY: number | null, sectorZ: number | null }
		allSystems: Awaited<ReturnType<typeof listAllSystemReferences>>
		allStars: Awaited<ReturnType<typeof listAllStarReferences>>
		siblings: Awaited<ReturnType<typeof listAllBodyReferences>>
		model: BodyModel | null
		parentStarHz: ParentStarHz | null
		sectorContext: SectorContext | null
		sectors: Awaited<ReturnType<typeof listSectorReferences>>
		rootStars: MapBody[]
		rootBodies: MapBody[]
		apparentSky: ApparentSkyResult
		rootCalendars: NonNullable<RodderEntityDocument['displays']['rootMap']>['calendars']
	})

interface RodderBaseData {
	isEditMode: false
	isConfigureMode: boolean
	backlinks: Awaited<ReturnType<typeof getBacklinksForRodder>>
	document: RodderEntityDocument
}

export async function loadRodderDetail(ctx: RodderDetailContext): Promise<RodderDetailData> {
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
	// across the rodder domain, so there is no probe order to get wrong.
	const entity = await findRodderBySlugOrName(identifier)
	if (!entity) throw error(404, 'Rodder body not found')
	if (entity.slug !== identifier) {
		throw redirect(301, canonicalize(entity.slug))
	}
	const document = await resolveRodderEntityDocument(entity.slug)
	if (!document) throw error(500, 'Rodder consumer document could not be resolved')

	if (entity.kind === 'system') {
		const [backlinks, sectorContext, sectors] = await Promise.all([
			getBacklinksForRodder(entity.slug),
			getSectorContextForRoot(entity.id),
			isConfigureMode ? listSectorReferences() : Promise.resolve([]),
		])
		const rootMap = document.displays.rootMap
		return {
			kind: 'system',
			body: {
				...entity,
				sectorX: sectorContext?.x ?? null,
				sectorY: sectorContext?.y ?? null,
				sectorZ: sectorContext?.z ?? null,
			},
			sectorContext,
			sectors,
			document,
			isEditMode: false,
			isConfigureMode,
			rootStars: rootMap?.stars as MapBody[] ?? [],
			rootBodies: rootMap?.bodies as MapBody[] ?? [],
			apparentSky: rootMap?.apparentSky ?? buildApparentSky(null, []),
			rootCalendars: rootMap?.calendars ?? [],
			backlinks,
		}
	}

	if (entity.kind === 'star') {
		const [allSystems, allStars, rawModel, systemPlanets, backlinks] = await Promise.all([
			listAllSystemReferences(), listAllStarReferences(), resolveRodderModel('star', entity.slug), getPlanetsForStar(entity.id), getBacklinksForRodder(entity.slug),
		])
		const model = rawModel?.kind === 'star' ? rawModel : null
		return {
			kind: 'star',
			body: entity,
			allSystems,
			allStars,
			model,
			systemPlanets,
			document,
			isEditMode: false,
			isConfigureMode,
			backlinks,
		}
	}

	const [allSystems, allStars, siblings, rawModel, backlinks, nearestStar, sectorContext, sectors] = await Promise.all([
		listAllSystemReferences(),
		listAllStarReferences(),
		listAllBodyReferences(),
		resolveRodderModel('body', entity.slug),
		getBacklinksForRodder(entity.slug),
		entity.parentId == null ? Promise.resolve(null) : findNearestStarAncestor(entity.parentId),
		getSectorContextForRoot(entity.id),
		isConfigureMode ? listSectorReferences() : Promise.resolve([]),
	])
	const rootMap = document.displays.rootMap
	const model = rawModel?.kind === 'body' ? rawModel : null
	// The parent star's habitable zone, so a planet can show whether it sits in
	// it — fetched as just the luminosity inputs, not the star's whole model
	// with its discarded planet/satellite counts.
	const parentStarHzInputs = nearestStar ? await getStarHzInputs(nearestStar.id) : null
	const parentStarHz = parentStarHzInputs ? resolveParentStarHz(parentStarHzInputs) : null
	return {
		kind: 'body',
		body: {
			...entity,
			sectorX: sectorContext?.x ?? null,
			sectorY: sectorContext?.y ?? null,
			sectorZ: sectorContext?.z ?? null,
		},
		allSystems,
		allStars,
		siblings,
		model,
		parentStarHz,
		sectorContext,
		sectors,
		rootStars: rootMap?.stars as MapBody[] ?? [],
		rootBodies: rootMap?.bodies as MapBody[] ?? [],
		apparentSky: rootMap?.apparentSky ?? buildApparentSky(null, []),
		rootCalendars: rootMap?.calendars ?? [],
		document,
		isEditMode: false,
		isConfigureMode,
		backlinks,
	}
}

export type _Cookies = Cookies
