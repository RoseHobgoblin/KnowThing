import { parseRingSystem, type RingSystemProjection } from './ring-system.js'

export type RingProjectionRow = {
	id: number
	name: string
	slug: string
	bodyType?: string | null
	parentId?: number | null
	ringSystem?: unknown
}

/**
 * Fold ring-system child records into their physical parent for rendering.
 * Ring records deliberately do not remain in the returned body list: they are
 * annular topology and must never fall through to the generic sphere renderer.
 */
export function projectRingSystems<T extends RingProjectionRow>(rows: readonly T[]): Array<T & {
	ringSystems: RingSystemProjection[]
}> {
	const byParent = new Map<number, RingSystemProjection[]>()
	for (const row of rows) {
		if (row.bodyType !== 'ring_system' || row.parentId == null) continue
		const ringSystem = parseRingSystem(row.ringSystem)
		if (!ringSystem) continue
		const systems = byParent.get(row.parentId) ?? []
		systems.push({ id: row.id, name: row.name, slug: row.slug, ringSystem })
		byParent.set(row.parentId, systems)
	}

	return rows
		.filter(row => row.bodyType !== 'ring_system')
		.map((row) => {
			const ringSystems = byParent.get(row.id) ?? []
			return {
				...row,
				ringSystems,
			}
		})
}
