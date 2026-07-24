import type { PageServerLoad } from './$types.js'
import { error } from '@sveltejs/kit'
import { requireAdmin } from '$lib/server/guards.js'
import {
	getMapForRegionsAdmin,
	listKnowPageOptions,
	listMapRegionsForAdmin,
	listSvgMedia,
} from '$lib/server/services/maps.js'

export const load: PageServerLoad = async (event) => {
	requireAdmin(event)
	const { slug } = event.params

	const map = await getMapForRegionsAdmin(slug)
	if (!map) throw error(404, 'Map not found')

	const regionRows = await listMapRegionsForAdmin(map.id as number)

	const groupedRegions = new Map<number, {
		id: number
		hexColor: string
		label: string | null
		countryId: number | null
		countrySlug: string | null
		countryName: string | null
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}>()

	for (const row of regionRows) {
		const current = groupedRegions.get(row.id)
		if (!current) {
			groupedRegions.set(row.id, {
				id: row.id,
				hexColor: row.hexColor,
				label: row.label,
				countryId: row.countryId,
				countrySlug: row.countrySlug,
				countryName: row.countryName,
				pageSlug: row.pageSlug,
				paths: [],
			})
			if (row.pathData) {
				let d = row.pathData
				let transform = null
				if (d.startsWith('T:')) {
					const splitIndex = d.indexOf('|')
					if (splitIndex !== -1) {
						transform = d.slice(2, splitIndex).trim()
						d = d.slice(splitIndex + 1).trim()
					}
				}
				groupedRegions.get(row.id)!.paths.push({ d, transform })
			}
			continue
		}

		if (row.pathData) {
			let d = row.pathData
			let transform = null
			if (d.startsWith('T:')) {
				const splitIndex = d.indexOf('|')
				if (splitIndex !== -1) {
					transform = d.slice(2, splitIndex).trim()
					d = d.slice(splitIndex + 1).trim()
				}
			}
			current.paths.push({ d, transform })
		}
	}

	const [knowPages, svgMedia] = await Promise.all([
		listKnowPageOptions(),
		listSvgMedia(),
	])

	const regions = [...groupedRegions.values()]
	const assignedCount = regions.filter(row => row.pageSlug && String(row.pageSlug).trim().length > 0).length

	return {
		map,
		regions,
		knowPages,
		svgMedia,
		assignedCount,
		unassignedCount: regions.length - assignedCount,
	}
}
