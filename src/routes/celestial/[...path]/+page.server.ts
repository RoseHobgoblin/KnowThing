import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
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
import { loadArticlePage } from '$lib/server/services/article-loader.js'
import { articleSaveAction } from '$lib/server/services/article-actions.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	const pathSegments = params.path.split('/')
	const lastSeg = pathSegments.at(-1)
	const isEditMode = lastSeg === 'edit'
	const isConfigureMode = lastSeg === 'configure'
	if (isEditMode || isConfigureMode) pathSegments.pop()

	const slug = pathSegments.at(-1)!

	if (isEditMode || isConfigureMode) {
		if (!locals.user) {
			throw redirect(302, `/auth/login?redirect=${encodeURIComponent(`/celestial/${params.path}`)}`)
		}
		if (!hasRole(locals.user.role, 'editor')) {
			const viewPath = `/celestial/${pathSegments.join('/')}`
			throw redirect(302, viewPath)
		}
	}

	const system = await findSystemBySlugOrPageSlug(slug)
	if (system) {
		if (system.slug !== slug && !isEditMode) throw redirect(301, `/celestial/${system.slug}`)
		const article = await loadArticlePage({
			domain: 'celestial',
			slug: system.slug,
			title: system.name,
			parentPath: null,
		})
		const systemStars = [...await getStarsForSystemMap(system.id)] as unknown as MapBody[]
		const systemBodies = [...await getBodiesForSystemMap(system.id)] as unknown as MapBody[]
		const systemCalendars = await getCalendarsForSystem(system.id)
		const infoboxFields = await resolveStructuredData('system', system.slug)
		return {
			kind: 'system' as const,
			body: system,
			isEditMode,
			isConfigureMode,
			systemStars,
			systemBodies,
			systemCalendars,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			parentCrumbs: [] as { label: string, href: string }[],
			...article,
		}
	}

	const star = await findStarBySlugOrPageSlug(slug)
	if (star) {
		const parentSystem = star.systemId ? await getStarSystemRef(star.systemId) : null
		const canonicalPath = parentSystem ? `/celestial/${parentSystem.slug}/${star.slug}` : `/celestial/${star.slug}`
		const inputPath = `/celestial/${pathSegments.join('/')}`
		if (canonicalPath !== inputPath && !isEditMode) throw redirect(301, canonicalPath)

		const allSystems = await listAllSystemRefs()
		const article = await loadArticlePage({
			domain: 'celestial',
			slug: star.slug,
			title: star.name,
			parentPath: parentSystem?.slug ?? null,
		})
		const parentCrumbs: { label: string, href: string }[] = []
		if (parentSystem) parentCrumbs.push({ label: parentSystem.name, href: `/celestial/${parentSystem.slug}` })
		const infoboxFields = await resolveStructuredData('star', star.slug)
		return {
			kind: 'star' as const,
			body: star,
			allSystems,
			isEditMode,
			isConfigureMode,
			parentCrumbs,
			infoboxFields: infoboxFields ? Object.fromEntries(infoboxFields) : null,
			...article,
		}
	}

	const planet = await findPlanetBySlugOrPageSlug(slug)
	if (planet) {
		let parentSystem: { name: string, slug: string } | null = null
		if (planet.starId) {
			const systemId = await getStarSystemId(planet.starId)
			if (systemId) parentSystem = await getStarSystemRef(systemId)
		}
		const canonicalPath = parentSystem ? `/celestial/${parentSystem.slug}/${planet.slug}` : `/celestial/${planet.slug}`
		const inputPath = `/celestial/${pathSegments.join('/')}`
		if (canonicalPath !== inputPath && !isEditMode) throw redirect(301, canonicalPath)

		const parentCrumbs: { label: string, href: string }[] = []
		if (parentSystem) parentCrumbs.push({ label: parentSystem.name, href: `/celestial/${parentSystem.slug}` })

		const allStars = await listAllStarRefs()
		const siblings = planet.starId ? await listSiblingBodies(planet.starId) : []
		const article = await loadArticlePage({
			domain: 'celestial',
			slug: planet.slug,
			title: planet.name,
			parentPath: parentSystem?.slug ?? null,
		})
		const infoboxFields = await resolveStructuredData('planet', planet.slug)
		return {
			kind: 'planet' as const,
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

export const actions: Actions = {
	default: articleSaveAction(),
}
