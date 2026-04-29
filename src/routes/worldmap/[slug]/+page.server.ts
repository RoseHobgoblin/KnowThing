import type { PageServerLoad } from './$types.js'
import { error } from '@sveltejs/kit'
import { getMapWithImage, listMapRegionsWithGeometry } from '$lib/server/services/maps.js'

export const load: PageServerLoad = async ({ params }) => {
	const map = await getMapWithImage(params.slug)
	if (!map) throw error(404, 'Map not found')

	const rows = await listMapRegionsWithGeometry(map.id as number)

	const regionMap = new Map<number, {
		id: number
		hexColor: string
		label: string
		countryName: string
		pageSlug: string | null
		paths: Array<{ d: string, transform: string | null }>
	}>()

	for (const row of rows) {
		const current = regionMap.get(row.regionId)
		if (!current) {
			regionMap.set(row.regionId, {
				id: row.regionId,
				hexColor: row.hexColor,
				label: row.label || row.countryName || row.hexColor,
				countryName: row.countryName || row.hexColor,
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
				regionMap.get(row.regionId)!.paths.push({ d, transform })
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

	return {
		map,
		regions: Array.from(regionMap.values()),
	}
}
