const radians = (degrees: number) => degrees * Math.PI / 180

function positive(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback
}

type MutablePoint3D = { x: number, y: number, z: number }

/**
 * Pushes a camera position to the near side of a spherical body when a dolly
 * would place it inside. The previous position supplies a stable outward
 * direction so a large zoom step cannot snap the camera through the centre.
 */
export function constrainPointOutsideSphere(
	point: MutablePoint3D,
	previousPoint: MutablePoint3D,
	centre: MutablePoint3D,
	radius: number,
): boolean {
	const safeRadius = positive(radius, 0)
	if (safeRadius === 0) return false
	const x = point.x - centre.x
	const y = point.y - centre.y
	const z = point.z - centre.z
	const radiusSquared = safeRadius * safeRadius
	const previousX = previousPoint.x - centre.x
	const previousY = previousPoint.y - centre.y
	const previousZ = previousPoint.z - centre.z
	const moveX = x - previousX
	const moveY = y - previousY
	const moveZ = z - previousZ
	const moveSquared = moveX * moveX + moveY * moveY + moveZ * moveZ
	const previousSquared = previousX * previousX + previousY * previousY + previousZ * previousZ

	// Stop at the first surface intersection. This also catches one unusually
	// large dolly step that would otherwise emerge beyond the far side.
	if (previousSquared >= radiusSquared && moveSquared > Number.EPSILON) {
		const inward = previousX * moveX + previousY * moveY + previousZ * moveZ
		const discriminant = inward * inward - moveSquared * (previousSquared - radiusSquared)
		if (inward < 0 && discriminant >= 0) {
			const intersection = (-inward - Math.sqrt(discriminant)) / moveSquared
			if (intersection >= 0 && intersection <= 1) {
				point.x = centre.x + previousX + moveX * intersection
				point.y = centre.y + previousY + moveY * intersection
				point.z = centre.z + previousZ + moveZ * intersection
				return true
			}
		}
	}

	// A stationary point on the surface should not keep the render loop alive.
	if (x * x + y * y + z * z >= radiusSquared * (1 - 1e-12)) return false

	let outwardX = previousX
	let outwardY = previousY
	let outwardZ = previousZ
	let outwardLength = Math.hypot(outwardX, outwardY, outwardZ)
	if (outwardLength <= Number.EPSILON) {
		outwardX = x
		outwardY = y
		outwardZ = z
		outwardLength = Math.hypot(outwardX, outwardY, outwardZ)
	}
	if (outwardLength <= Number.EPSILON) {
		outwardX = 0
		outwardY = 0
		outwardZ = 1
		outwardLength = 1
	}
	point.x = centre.x + outwardX / outwardLength * safeRadius
	point.y = centre.y + outwardY / outwardLength * safeRadius
	point.z = centre.z + outwardZ / outwardLength * safeRadius
	return true
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
