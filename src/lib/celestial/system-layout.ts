/**
 * Pure layout core for the system map. Renderer-agnostic: turns celestial rows
 * into positioned orbit geometry in a fixed 800×800 world space.
 *
 * The API is split along the animation seam:
 *   buildLayout()      — day-independent geometry (orbit ellipses, gap-enforced
 *                        radii, satellite zones). Rebuild only when data or the
 *                        scale mode changes.
 *   computePositions() — per-day body placement along that geometry. Cheap;
 *                        safe to call every animation frame.
 *   buildScene()       — composes both into the flat scene a renderer consumes.
 */
import { meanAnomaly, solveKeplerE } from 'tungolcraft'
import type { ScaleMode } from './map-settings.js'

export interface MapBody {
	id: number
	name: string
	slug: string
	bodyType: string
	semiMajorAxisAu?: number | null
	eccentricity?: number | null
	/** Orbit orientation (degrees). Absent/null orbits render apsis-right, as before. */
	inclination?: number | null
	longitudeAscendingNode?: number | null
	argumentOfPeriapsis?: number | null
	color?: string | null
	moonCount?: number
	parentStarId?: number | null
	/** Direct parent when the parent is the system — a barycentric orbit. */
	parentSystemId?: number | null
	spectralType?: string | null
	starId?: number | null
	parentId?: number | null
	orbitalPeriodDays?: number | null
	epochPhase?: number | null
}

export type EntityKey = `star:${number}` | `body:${number}`

export type OrbitBody = MapBody & {
	orbitAu: number
	ecc: number
	isStar: boolean
	renderAsSatellite: boolean
	/** Projected apsidal rotation (radians): the sky-plane longitude of periapsis Ω+ω. */
	apseRad: number
}

export type PositionedOrbit = {
	body: OrbitBody
	a: number
	b: number
	angle: number
	rawX: number
	rawY: number
	x: number
	y: number
}

export type PositionedSatellite = {
	body: OrbitBody
	parentKey: EntityKey
	orbitRadius: number
	orbitSemiMinor: number
	focusOffset: number
	parentRawX: number
	parentRawY: number
	rawX: number
	rawY: number
	parentX: number
	parentY: number
	x: number
	y: number
}

export type HitTarget = {
	id: EntityKey
	body: MapBody
	x: number
	y: number
	r: number
}

export type ThemePalette = {
	page: string
	surface: string
	accent: string
	accentLight: string
	secondary: string
	dim: string
	heading: string
	faint: string
}

export type Scene = {
	primaryStar: MapBody | null
	directPositions: PositionedOrbit[]
	satellitePositions: PositionedSatellite[]
	cameraOffset: { x: number, y: number }
	selectionFamily: Set<EntityKey>
	hitTargets: HitTarget[]
	effectiveMaxAu: number
	auMin: number
	maxVisualRadius: number
}

/** Day-independent orbit geometry for a body orbiting the map center. */
export type DirectOrbitLayout = {
	body: OrbitBody
	a: number
	b: number
	/** Even-spacing fallback slot used when no date is set. */
	index: number
	count: number
	/** Inner-mode body beyond the boundary, parked on an oversized circle. */
	outOfRange: boolean
}

/** Day-independent orbit geometry for a satellite, local to its parent anchor. */
export type SatelliteLayout = {
	body: OrbitBody
	parentKey: EntityKey
	orbitRadius: number
	orbitSemiMinor: number
	focusOffset: number
	index: number
	count: number
	/** Outer extent (px) of this satellite's schematic zone. */
	zone: number
	/**
	 * Zone radius proportional to the satellite's real semi-major axis relative
	 * to its siblings — the "unfolded" LOD target when zoomed into a subsystem.
	 */
	proportionalRadius: number
	proportionalSemiMinor: number
	proportionalFocusOffset: number
}

/**
 * Satellite orbit geometry blended between the schematic zone layout (t = 0)
 * and the proportional layout (t = 1). The renderer drives t from how large
 * the subsystem currently appears on screen.
 */
export function blendedSatelliteGeometry(
	satellite: SatelliteLayout,
	t: number,
): { radius: number, semiMinor: number, focusOffset: number } {
	const clamped = Math.min(1, Math.max(0, t))
	if (clamped === 0) {
		return { radius: satellite.orbitRadius, semiMinor: satellite.orbitSemiMinor, focusOffset: satellite.focusOffset }
	}
	return {
		radius: satellite.orbitRadius + (satellite.proportionalRadius - satellite.orbitRadius) * clamped,
		semiMinor: satellite.orbitSemiMinor + (satellite.proportionalSemiMinor - satellite.orbitSemiMinor) * clamped,
		focusOffset: satellite.focusOffset + (satellite.proportionalFocusOffset - satellite.focusOffset) * clamped,
	}
}

export type SystemLayout = {
	primaryStar: MapBody | null
	directOrbits: DirectOrbitLayout[]
	/** Topologically ordered: a satellite's parent always precedes it. */
	satellites: SatelliteLayout[]
	effectiveMaxAu: number
	auMin: number
	maxVisualRadius: number
}

export type BodyPosition = {
	x: number
	y: number
	angle: number
}

export const DEG = Math.PI / 180
export const SIZE = 800
export const CENTER = SIZE / 2
export const PADDING = 80
export const MIN_FIRST_ORBIT = 36
export const MIN_ADJACENT_GAP = 14
export const R_GUARD = 30
export const COMPACT_EXPONENT = 0.4
export const SAT_INNER_MARGIN = 10
export const SAT_MIN_ZONE = 20
export const SAT_MAX_ZONE = 80
export const SAT_ZONE_FRACTION = 0.4

export function keyForBody(body: MapBody, isStar: boolean): EntityKey {
	return `${isStar ? 'star' : 'body'}:${body.id}` as EntityKey
}

export function bodyRadius(body: { isStar: boolean, renderAsSatellite?: boolean }) {
	if (body.isStar) return 6
	if (body.renderAsSatellite) return 2.5
	return 4
}

export function computeAngle(body: OrbitBody, index: number, total: number, currentAbsoluteDay?: number | null) {
	if (currentAbsoluteDay != null && body.orbitAu > 0) {
		const periodDays = body.orbitalPeriodDays ?? (body.orbitAu ** 1.5 * 365.25)
		const M = meanAnomaly(periodDays, body.epochPhase ?? 0, currentAbsoluteDay)
		return solveKeplerE(M, body.ecc)
	}
	return (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
}

// Projected sky-plane longitude of periapsis (Ω + ω) in radians. On a flat
// top-down map inclination is not modelled, so only the apsidal sum is
// meaningful; a null/absent orientation leaves periapsis pointing +x as before.
export function apseRadOf(body: MapBody): number {
	return (((body.longitudeAscendingNode ?? 0) + (body.argumentOfPeriapsis ?? 0)) % 360) * DEG
}

// Place a body at eccentric anomaly `angle` on an ellipse whose focus sits at
// (cx, cy), then rotate the whole orbit about that focus by `apseRad` so the
// apsides point along Ω+ω instead of always toward +x.
export function ellipsePosition(a: number, b: number, angle: number, cx: number, cy: number, apseRad = 0) {
	const focusOffset = Math.sqrt(Math.max(a * a - b * b, 0))
	const relativeX = a * Math.cos(angle) - focusOffset
	const relativeY = b * Math.sin(angle)
	if (apseRad === 0) return { x: cx + relativeX, y: cy + relativeY }
	const cos = Math.cos(apseRad), sin = Math.sin(apseRad)
	return { x: cx + relativeX * cos - relativeY * sin, y: cy + relativeX * sin + relativeY * cos }
}

export function parentKeyForBody(body: MapBody, primaryStarId: number | null): EntityKey | null {
	// planetaryBodies.parentId always references another planetary body, never a star.
	// Star and body ids share no namespace, so don't check star ids here — numeric
	// collisions between a body id and a star id were rerouting moons under the wrong star.
	if (body.parentId != null) return `body:${body.parentId}` as EntityKey
	if (body.starId != null && body.starId !== primaryStarId) return `star:${body.starId}` as EntityKey
	return null
}

export function buildSelectionFamily(
	stars: MapBody[],
	bodies: MapBody[],
	selectedId: EntityKey | null,
	primaryStar: MapBody | null,
): Set<EntityKey> {
	if (selectedId == null) return new Set<EntityKey>()

	const ids = new Set<EntityKey>([selectedId])
	const [selectedKind, rawId] = selectedId.split(':')
	const selectedNumericId = Number(rawId)
	const selectedStar = selectedKind === 'star'
		? stars.find(star => star.id === selectedNumericId)
		: null
	const selectedBody = selectedKind === 'body'
		? bodies.find(body => body.id === selectedNumericId)
		: null

	if (selectedStar) {
		for (const body of bodies) {
			if (body.starId === selectedStar.id) {
				ids.add(keyForBody(body, false))
				for (const moon of bodies) {
					if (moon.parentId === body.id) ids.add(keyForBody(moon, false))
				}
			}
		}
		if (!selectedStar.parentStarId && primaryStar) ids.add(keyForBody(primaryStar, true))
		if (selectedStar.parentStarId) {
			const parentStar = stars.find(star => star.id === selectedStar.parentStarId)
			if (parentStar) ids.add(keyForBody(parentStar, true))
		}
		return ids
	}

	if (selectedBody) {
		if (selectedBody.starId) {
			const parentStar = stars.find(star => star.id === selectedBody.starId)
			if (parentStar) ids.add(keyForBody(parentStar, true))
		}
		if (selectedBody.parentId) {
			// parentId always references a planetary body — never a star.
			const parentBody = bodies.find(body => body.id === selectedBody.parentId)
			if (parentBody) ids.add(keyForBody(parentBody, false))
		}
		for (const child of bodies) {
			if (child.parentId === selectedBody.id) ids.add(keyForBody(child, false))
		}
	}

	return ids
}

export function innerBoundaryAu(orbiters: OrbitBody[]): number {
	if (orbiters.length <= 1) return orbiters[0]?.orbitAu ?? 1
	let maxRatio = 0
	let boundaryIndex = -1
	for (let index = 0; index < orbiters.length - 1; index++) {
		const ratio = orbiters[index + 1].orbitAu / Math.max(orbiters[index].orbitAu, 0.001)
		if (ratio > maxRatio) {
			maxRatio = ratio
			boundaryIndex = index
		}
	}
	// No meaningful gap — return the outermost orbit so inner view shows everything
	if (maxRatio < 2 || boundaryIndex < 0) {
		return orbiters.at(-1)!.orbitAu
	}
	// Geometric mean of the two bounding orbits — proportional cut across the gap
	return Math.sqrt(orbiters[boundaryIndex].orbitAu * orbiters[boundaryIndex + 1].orbitAu)
}

export function scaleAuToPixel(au: number, scale: ScaleMode, auMin: number, auMax: number, rMax: number): number {
	switch (scale) {
		case 'log': {
			if (auMin >= auMax) return (MIN_FIRST_ORBIT + rMax) / 2
			const logMin = Math.log(auMin)
			const logRange = Math.log(auMax) - logMin
			const t = (Math.log(au) - logMin) / logRange
			return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
		}
		case 'proportional':
		case 'inner':
			return R_GUARD + (au / auMax) * (rMax - R_GUARD)
		case 'compact': {
			const t = (au / auMax) ** COMPACT_EXPONENT
			return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
		}
	}
}

export function enforceMinGaps(radii: number[], rMax: number): number[] {
	const result = [...radii]
	if (result.length === 0) return result

	result[0] = Math.max(result[0], MIN_FIRST_ORBIT)

	for (let index = 1; index < result.length; index++) {
		result[index] = Math.max(result[index], result[index - 1] + MIN_ADJACENT_GAP)
	}

	if (result.at(-1)! > rMax) {
		const factor = rMax / result.at(-1)!
		for (let index = 0; index < result.length; index++) result[index] *= factor
		const reducedGap = MIN_ADJACENT_GAP * factor
		for (let index = 1; index < result.length; index++) {
			result[index] = Math.max(result[index], result[index - 1] + reducedGap)
		}
	}

	return result
}

// A star orbiting the system barycenter (binary component) is never the
// center of the map — with a true barycentric pair the center is empty.
export function isBarycentric(star: MapBody): boolean {
	return star.parentSystemId != null && star.semiMajorAxisAu != null && star.semiMajorAxisAu > 0
}

export function buildLayout(stars: MapBody[], bodies: MapBody[], scale: ScaleMode): SystemLayout {
	const centerCandidate = stars.find(star => !star.parentStarId && !isBarycentric(star))
	const primaryStar = centerCandidate ?? (stars.some(isBarycentric) ? null : stars[0] ?? null)
	const primaryStarId = primaryStar?.id ?? null
	const companionStars = stars.filter(star => star.parentStarId)
	const directOrbiters: OrbitBody[] = []
	const seen = new Set<EntityKey>()

	// Barycentric components orbit the (empty or stub) center directly.
	for (const star of stars) {
		const key = keyForBody(star, true)
		if (!isBarycentric(star) || star.id === primaryStarId || seen.has(key)) continue
		seen.add(key)
		directOrbiters.push({ ...star, orbitAu: star.semiMajorAxisAu!, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: false, apseRad: apseRadOf(star) })
	}

	const deepCompanionStars: OrbitBody[] = []
	for (const star of companionStars) {
		const key = keyForBody(star, true)
		if (!star.semiMajorAxisAu || seen.has(key)) continue
		if (star.parentStarId === primaryStarId) {
			seen.add(key)
			directOrbiters.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: false, apseRad: apseRadOf(star) })
		} else {
			deepCompanionStars.push({ ...star, orbitAu: star.semiMajorAxisAu, ecc: star.eccentricity ?? 0, isStar: true, renderAsSatellite: true, apseRad: apseRadOf(star) })
		}
	}

	for (const body of bodies) {
		const key = keyForBody(body, false)
		// parentId always references another planetary body, never a star, so it must
		// not be compared against a star id (their id spaces overlap → wrong routing).
		const orbitsPrimaryStarDirectly =
			body.semiMajorAxisAu != null
			&& (
				(body.starId != null && body.starId === primaryStarId && body.parentId == null)
				|| (body.starId == null && body.parentId == null)
			)
		if (orbitsPrimaryStarDirectly && !seen.has(key)) {
			seen.add(key)
			directOrbiters.push({ ...body, orbitAu: body.semiMajorAxisAu!, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: false, apseRad: apseRadOf(body) })
		}
	}

	directOrbiters.sort((a, b) => a.orbitAu - b.orbitAu)

	const maxAu = Math.max(...directOrbiters.map(body => body.orbitAu), 1)

	const effectiveMaxAu = scale === 'inner'
		? innerBoundaryAu(directOrbiters)
		: maxAu

	const visibleOrbiters = scale === 'inner'
		? directOrbiters.filter(body => body.orbitAu <= effectiveMaxAu)
		: directOrbiters

	const outermostVisibleEcc = visibleOrbiters.at(-1)?.ecc ?? 0
	const maxVisualRadius = (CENTER - PADDING) / (1 + outermostVisibleEcc)

	const auMin = visibleOrbiters[0]?.orbitAu ?? 1
	const rawRadii = visibleOrbiters.map(body =>
		scaleAuToPixel(body.orbitAu, scale, auMin, effectiveMaxAu, maxVisualRadius),
	)
	const finalRadii = enforceMinGaps(rawRadii, maxVisualRadius)

	const directOrbits: DirectOrbitLayout[] = []
	for (const [index, body] of visibleOrbiters.entries()) {
		const gapDelta = finalRadii[index] - rawRadii[index]
		const periPx = scaleAuToPixel(body.orbitAu * (1 - body.ecc), scale, auMin, effectiveMaxAu, maxVisualRadius) + gapDelta
		const apoPx = scaleAuToPixel(body.orbitAu * (1 + body.ecc), scale, auMin, effectiveMaxAu, maxVisualRadius) + gapDelta
		const a = (periPx + apoPx) / 2
		const c = (apoPx - periPx) / 2
		const b = Math.sqrt(Math.max(a * a - c * c, 0))
		directOrbits.push({ body, a, b, index, count: visibleOrbiters.length, outOfRange: false })
	}

	if (scale === 'inner') {
		for (const body of directOrbiters) {
			if (body.orbitAu > effectiveMaxAu) {
				const a = maxVisualRadius * 2
				directOrbits.push({ body, a, b: a, index: 0, count: 1, outOfRange: true })
			}
		}
	}

	// Anchored entities that satellites can resolve against: the center plus
	// every direct orbiter, growing as satellites themselves get placed.
	const anchored = new Set<EntityKey>()
	if (primaryStar) anchored.add(keyForBody(primaryStar, true))
	for (const orbit of directOrbits) {
		anchored.add(keyForBody(orbit.body, orbit.body.isStar))
	}

	// Lookup from entity key to gap-enforced radius for satellite zone sizing
	const orbiterRadiiByKey = new Map<EntityKey, number>()
	for (const [index, body] of visibleOrbiters.entries()) {
		orbiterRadiiByKey.set(keyForBody(body, body.isStar), finalRadii[index])
	}

	const pendingItems: OrbitBody[] = [
		...deepCompanionStars,
		...bodies
			.filter(body => body.semiMajorAxisAu != null && !seen.has(keyForBody(body, false)))
			.map(body => ({ ...body, orbitAu: body.semiMajorAxisAu!, ecc: body.eccentricity ?? 0, isStar: false, renderAsSatellite: true, apseRad: apseRadOf(body) })),
	]

	const satellites: SatelliteLayout[] = []
	while (pendingItems.length > 0) {
		const groups = new Map<EntityKey, OrbitBody[]>()
		const unresolved: OrbitBody[] = []

		for (const item of pendingItems) {
			let parentKey: EntityKey | null
			if (item.isStar && item.parentStarId != null) {
				parentKey = `star:${item.parentStarId}` as EntityKey
			} else {
				parentKey = parentKeyForBody(item, primaryStarId)
			}
			if (!parentKey || !anchored.has(parentKey)) {
				unresolved.push(item)
				continue
			}
			const existing = groups.get(parentKey) ?? []
			existing.push(item)
			groups.set(parentKey, existing)
		}

		if (groups.size === 0) break
		pendingItems.length = 0
		pendingItems.push(...unresolved)

		for (const [parentKey, groupSatellites] of groups.entries()) {
			groupSatellites.sort((a, b) => a.orbitAu - b.orbitAu)

			// Dynamic zone sizing based on gap to nearest neighbour
			const parentR = orbiterRadiiByKey.get(parentKey)
			let zone = SAT_MIN_ZONE
			if (parentR != null) {
				let gapBelow = parentR
				let gapAbove = Infinity
				const radii = [...orbiterRadiiByKey.values()]
				for (let radiiIndex = 0; radiiIndex < radii.length; radiiIndex++) {
					if (Math.abs(radii[radiiIndex] - parentR) < 0.1) {
						if (radiiIndex > 0) gapBelow = radii[radiiIndex] - radii[radiiIndex - 1]
						if (radiiIndex < radii.length - 1) gapAbove = radii[radiiIndex + 1] - radii[radiiIndex]
						break
					}
				}
				const halfGap = Math.min(gapBelow, gapAbove) * SAT_ZONE_FRACTION
				const minZone = Math.max(SAT_MIN_ZONE, groupSatellites.length * 6)
				zone = Math.min(Math.max(halfGap, minZone), SAT_MAX_ZONE)
			}

			const groupMaxAu = Math.max(...groupSatellites.map(satellite => satellite.orbitAu), 0)

			for (const [index, satellite] of groupSatellites.entries()) {
				const t = groupSatellites.length === 1 ? 0.5 : index / (groupSatellites.length - 1)
				const orbitRadius = SAT_INNER_MARGIN + t * (zone - SAT_INNER_MARGIN)
				const orbitSemiMinor = orbitRadius * Math.sqrt(1 - satellite.ecc * satellite.ecc)
				const focusOffset = orbitRadius * satellite.ecc
				// Unfolded target: radius proportional to the real semi-major axis
				// relative to the outermost sibling. The floor keeps the innermost
				// orbit outside the (screen-constant, tiny-in-world-units) parent dot.
				const proportionalRadius = groupMaxAu > 0 && satellite.orbitAu > 0
					? Math.max(2, (satellite.orbitAu / groupMaxAu) * zone)
					: orbitRadius
				const proportionalSemiMinor = proportionalRadius * Math.sqrt(1 - satellite.ecc * satellite.ecc)
				const proportionalFocusOffset = proportionalRadius * satellite.ecc
				const key = keyForBody(satellite, satellite.isStar)

				satellites.push({
					body: satellite,
					parentKey,
					orbitRadius,
					orbitSemiMinor,
					focusOffset,
					index,
					count: groupSatellites.length,
					zone,
					proportionalRadius,
					proportionalSemiMinor,
					proportionalFocusOffset,
				})
				anchored.add(key)
			}
		}
	}

	return { primaryStar, directOrbits, satellites, effectiveMaxAu, auMin, maxVisualRadius }
}

/**
 * Raw (camera-independent) world positions for every entity in the layout,
 * keyed by entity. The primary star is included at the map center.
 *
 * `satelliteBlend` (per-satellite, 0..1) morphs satellite orbits from the
 * schematic zone layout toward the proportional one — the moon-LOD unfold.
 * Omitted, satellites stay schematic (canvas-era parity).
 */
export function computePositions(
	layout: SystemLayout,
	currentAbsoluteDay?: number | null,
	satelliteBlend?: (satellite: SatelliteLayout) => number,
): Map<EntityKey, BodyPosition> {
	const positions = new Map<EntityKey, BodyPosition>()
	if (layout.primaryStar) {
		positions.set(keyForBody(layout.primaryStar, true), { x: CENTER, y: CENTER, angle: 0 })
	}

	for (const orbit of layout.directOrbits) {
		const angle = computeAngle(orbit.body, orbit.index, orbit.count, currentAbsoluteDay)
		const apseRad = orbit.outOfRange ? 0 : orbit.body.apseRad
		const pos = ellipsePosition(orbit.a, orbit.b, angle, CENTER, CENTER, apseRad)
		positions.set(keyForBody(orbit.body, orbit.body.isStar), { x: pos.x, y: pos.y, angle })
	}

	// Satellites are topologically ordered, so a parent's position always
	// exists by the time its satellites are placed.
	for (const satellite of layout.satellites) {
		const parent = positions.get(satellite.parentKey)
		if (!parent) continue
		const angle = computeAngle(satellite.body, satellite.index, satellite.count, currentAbsoluteDay)
		const geometry = blendedSatelliteGeometry(satellite, satelliteBlend?.(satellite) ?? 0)
		const ellipseCx = parent.x - geometry.focusOffset
		const x = ellipseCx + geometry.radius * Math.cos(angle)
		const y = parent.y + geometry.semiMinor * Math.sin(angle)
		positions.set(keyForBody(satellite.body, satellite.body.isStar), { x, y, angle })
	}

	return positions
}

export function computeCameraOffset(
	_layout: SystemLayout,
	positions: Map<EntityKey, BodyPosition>,
	selectedId: EntityKey | null,
	follow: boolean,
): { x: number, y: number } {
	if (!follow || selectedId == null) return { x: 0, y: 0 }
	const target = positions.get(selectedId)
	if (!target) return { x: 0, y: 0 }
	return { x: CENTER - target.x, y: CENTER - target.y }
}

export type BuildSceneArgs = {
	stars: MapBody[]
	bodies: MapBody[]
	scale: ScaleMode
	selectedId: EntityKey | null
	follow: boolean
	currentAbsoluteDay?: number | null
}

/** Compose layout + positions + camera into the flat scene a renderer consumes. */
export function buildScene({ stars, bodies, scale, selectedId, follow, currentAbsoluteDay }: BuildSceneArgs): Scene {
	const layout = buildLayout(stars, bodies, scale)
	const positions = computePositions(layout, currentAbsoluteDay)
	const cameraOffset = computeCameraOffset(layout, positions, selectedId, follow)
	const selectionFamily = buildSelectionFamily(stars, bodies, selectedId, layout.primaryStar)

	const project = (x: number, y: number) => ({
		x: x + cameraOffset.x,
		y: y + cameraOffset.y,
	})

	const directPositions: PositionedOrbit[] = layout.directOrbits.map((orbit) => {
		const raw = positions.get(keyForBody(orbit.body, orbit.body.isStar))!
		const projected = project(raw.x, raw.y)
		return {
			body: orbit.body,
			a: orbit.a,
			b: orbit.b,
			angle: raw.angle,
			rawX: raw.x,
			rawY: raw.y,
			x: projected.x,
			y: projected.y,
		}
	})

	const satellitePositions: PositionedSatellite[] = []
	for (const satellite of layout.satellites) {
		const raw = positions.get(keyForBody(satellite.body, satellite.body.isStar))
		const parentRaw = positions.get(satellite.parentKey)
		if (!raw || !parentRaw) continue
		const projected = project(raw.x, raw.y)
		const projectedParent = project(parentRaw.x, parentRaw.y)
		satellitePositions.push({
			body: satellite.body,
			parentKey: satellite.parentKey,
			orbitRadius: satellite.orbitRadius,
			orbitSemiMinor: satellite.orbitSemiMinor,
			focusOffset: satellite.focusOffset,
			parentRawX: parentRaw.x,
			parentRawY: parentRaw.y,
			rawX: raw.x,
			rawY: raw.y,
			parentX: projectedParent.x,
			parentY: projectedParent.y,
			x: projected.x,
			y: projected.y,
		})
	}

	const hitTargets: HitTarget[] = []
	if (layout.primaryStar) {
		const projected = project(CENTER, CENTER)
		hitTargets.push({
			id: keyForBody(layout.primaryStar, true),
			body: layout.primaryStar,
			x: projected.x,
			y: projected.y,
			r: 12,
		})
	}

	for (const position of directPositions) {
		hitTargets.push({
			id: keyForBody(position.body, position.body.isStar),
			body: position.body,
			x: position.x,
			y: position.y,
			r: Math.max(8, bodyRadius(position.body) + 5),
		})
	}

	for (const position of satellitePositions) {
		hitTargets.push({
			id: keyForBody(position.body, position.body.isStar),
			body: position.body,
			x: position.x,
			y: position.y,
			r: 8,
		})
	}

	return {
		primaryStar: layout.primaryStar,
		directPositions,
		satellitePositions,
		cameraOffset,
		selectionFamily,
		hitTargets,
		effectiveMaxAu: layout.effectiveMaxAu,
		auMin: layout.auMin,
		maxVisualRadius: layout.maxVisualRadius,
	}
}
