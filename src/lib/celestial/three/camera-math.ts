const radians = (degrees: number) => degrees * Math.PI / 180

function positive(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback
}

/** World-space height represented by one CSS pixel at a perspective depth. */
export function perspectiveWorldUnitsPerPixel(
	depth: number,
	viewportHeight: number,
	verticalFovDeg: number,
): number {
	const safeDepth = positive(depth, Number.EPSILON)
	const safeHeight = positive(viewportHeight, 1)
	const halfFov = radians(positive(verticalFovDeg, 50)) / 2
	return 2 * safeDepth * Math.tan(halfFov) / safeHeight
}

/** Perspective camera depth that matches a requested world-space pixel scale. */
export function perspectiveDistanceForWorldUnitsPerPixel(
	worldUnitsPerPixel: number,
	viewportHeight: number,
	verticalFovDeg: number,
): number {
	const safeScale = positive(worldUnitsPerPixel, Number.EPSILON)
	const safeHeight = positive(viewportHeight, 1)
	const halfFov = radians(positive(verticalFovDeg, 50)) / 2
	return safeScale * safeHeight / (2 * Math.tan(halfFov))
}

/**
 * Distance from the centre of a sphere that fits it within the viewport's
 * short-axis field of view. This accounts for the near edge of the sphere,
 * unlike a flat-plane framing calculation.
 */
export function perspectiveDistanceToFrameSphere(
	radius: number,
	aspect: number,
	verticalFovDeg: number,
	margin = 1.08,
): number {
	const safeRadius = positive(radius, 1)
	const safeAspect = positive(aspect, 1)
	const verticalHalfFov = radians(positive(verticalFovDeg, 50)) / 2
	const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect)
	const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov)
	return safeRadius * Math.max(1, margin) / Math.sin(limitingHalfFov)
}

export function orthographicZoomForWorldUnitsPerPixel(
	verticalWorldSpan: number,
	viewportHeight: number,
	worldUnitsPerPixel: number,
): number {
	const safeSpan = positive(verticalWorldSpan, 1)
	const safeHeight = positive(viewportHeight, 1)
	const safeScale = positive(worldUnitsPerPixel, Number.EPSILON)
	return safeSpan / (safeHeight * safeScale)
}
