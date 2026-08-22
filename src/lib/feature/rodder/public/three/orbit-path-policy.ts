const TWO_PI = Math.PI * 2

export const ORBIT_SEGMENTS = 320
export const ORBIT_LOCAL_REFINEMENT_LEVELS = 10
export const DASH_SIZE_PX = 7
export const DASH_GAP_PX = 5

function normalizedAngle(angle: number): number {
	const normalized = angle % TWO_PI
	return normalized < 0 ? normalized + TWO_PI : normalized
}

/**
 * A stable full-orbit mesh plus a small geometric refinement around each body.
 * This keeps the body exactly on a smooth local arc without rebuilding an
 * enormous camera-dependent geometry while navigation damping settles.
 */
export function closedOrbitAngles(
	segmentCount = ORBIT_SEGMENTS,
	anchors: number[] = [],
	refinementLevels = ORBIT_LOCAL_REFINEMENT_LEVELS,
): number[] {
	const safeSegments = Math.max(4, Math.trunc(segmentCount))
	const angles = Array.from({ length: safeSegments }, (_, index) => index / safeSegments * TWO_PI)
	const baseStep = TWO_PI / safeSegments
	const add = (angle: number) => {
		const normalized = normalizedAngle(angle)
		if (!angles.some(existing => Math.abs(existing - normalized) < 1e-10)) angles.push(normalized)
	}
	for (const anchor of anchors) {
		if (!Number.isFinite(anchor)) continue
		add(anchor)
		for (let level = 1; level <= refinementLevels; level++) {
			const offset = baseStep / 2 ** level
			add(anchor - offset)
			add(anchor + offset)
		}
	}
	angles.sort((a, b) => a - b)
	angles.push(TWO_PI)
	return angles
}

/** Convert Line2's world-distance dash coordinate into CSS-pixel spacing. */
export function screenDashScale(worldUnitsPerPixel: number): number {
	return 1 / Math.max(worldUnitsPerPixel, Number.EPSILON)
}
