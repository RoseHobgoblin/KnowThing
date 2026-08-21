/**
 * Sector-root position handling shared by the create and update write paths.
 *
 * A root's position in its sector frame is a complete (x, y, z) triple or
 * nothing — a partial position cannot be placed on the sector map and must not
 * be silently zero-filled. Updates are field-wise patches (the configure form
 * sends every field, the API may send any subset), so the patch is merged over
 * the stored position before the completeness rule is applied. Legacy rows
 * migrated from the old galactic_x/y/z columns may hold partial triples; they
 * are readable but any write that leaves the triple partial is rejected.
 */

export interface SectorPosition {
	x: number | null
	y: number | null
	z: number | null
}

/** Patch fields as parsed by the system Zod schema: absent = untouched. */
export interface SectorPositionPatch {
	sectorX?: number | null
	sectorY?: number | null
	sectorZ?: number | null
}

export type SectorPositionMerge =
	| { kind: 'unchanged' }
	| { kind: 'set', x: number, y: number, z: number }
	| { kind: 'clear' }
	| { kind: 'invalid', message: string }

const AXES = [['sectorX', 'x'], ['sectorY', 'y'], ['sectorZ', 'z']] as const

/**
 * Merge a patch over the currently stored position and classify the result.
 * `current` is null when the root record has no stored position yet.
 */
export function mergeSectorPosition(
	current: SectorPosition | null,
	patch: SectorPositionPatch,
): SectorPositionMerge {
	if (AXES.every(([key]) => patch[key] === undefined)) return { kind: 'unchanged' }

	const merged: SectorPosition = { x: null, y: null, z: null }
	for (const [patchKey, axis] of AXES) {
		merged[axis] = patch[patchKey] === undefined ? current?.[axis] ?? null : patch[patchKey] ?? null
	}

	const set = AXES.filter(([, axis]) => merged[axis] != null).length
	if (set === 0) return { kind: 'clear' }
	if (set < AXES.length) {
		return {
			kind: 'invalid',
			message: 'Sector position must set all three of X, Y, and Z (or clear all three) — a partial position cannot be placed in the sector frame',
		}
	}
	return { kind: 'set', x: merged.x!, y: merged.y!, z: merged.z! }
}
