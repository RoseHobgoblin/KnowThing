/**
 * Pure layout core for the root map. Renderer-agnostic: turns rodder rows
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
import { meanAnomaly, partitionBinaryRelativeAxis, rotatePerifocalToInertial, solveKeplerE } from 'tungolcraft'
import { overviewBodyExtent } from './body-sizing.js'
import type { ScaleMode } from './map-settings.js'
import type { SurfaceRecipe } from './surface-model.js'
import type { StellarSurfaceRecipe } from './stellar-surface-model.js'
import type { WeatherRecipe } from './weather-model.js'

export interface MapBody {
	id: number
	name: string
	slug: string
	bodyType: string
	/** Renderer-only entity namespace marker; never persisted. */
	isStar?: boolean
	massKg?: number | null
	radiusM?: number | null
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
	rotationPeriodS?: number | null
	axialTilt?: number | null
	temperatureK?: number | null
	luminosityW?: number | null
	composition?: string | null
	atmosphere?: string | null
	hasRings?: boolean | null
	/** Renderer-only resolved host-star display temperature; never persisted. */
	hostStarTemperatureK?: number | null
	/** Versioned material recipe stored in the entity's extra JSONB. */
	surface?: SurfaceRecipe | null
	/** Illustrative weather settings are independent from canonical surface files. */
	weather?: WeatherRecipe | null
	/** Versioned Starwright photosphere recipe stored in the star's extra JSONB. */
	stellarSurface?: StellarSurfaceRecipe | null
	relativeSemiMajorAxisAu?: number | null
	effectivePeriodSource?: 'stored' | 'derived' | 'unavailable'
	placementProvenance?: 'physical' | 'schematic'
	placementNote?: string | null
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
	/** Signed mass fraction for a resolved two-star relative orbit. */
	binaryFactor?: number
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

export type RootLayout = {
	primaryStar: MapBody | null
	directOrbits: DirectOrbitLayout[]
	/** Topologically ordered: a satellite's parent always precedes it. */
	satellites: SatelliteLayout[]
	effectiveMaxAu: number
	auMin: number
	maxVisualRadius: number
	/** Shared linear scene conversion. Null means the legacy schematic layout. */
	worldUnitsPerAu: number | null
	distanceModel: 'physical' | 'schematic'
}

export type BodyPosition = {
	x: number
	y: number
	angle: number
}

export type BodyPosition3D = BodyPosition & { z: number }

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
export const ORBIT_CLEARANCE = 8

export function keyForBody(body: MapBody, isStar: boolean): EntityKey {
	return `${isStar ? 'star' : 'body'}:${body.id}` as EntityKey
}

export function bodyRadius(body: { isStar: boolean, renderAsSatellite?: boolean }) {
	if (body.isStar) return 6
	if (body.renderAsSatellite) return 2.5
	return 4
}

export function computeAngle(body: OrbitBody, index: number, total: number, currentAbsoluteDay?: number | null) {
	if (currentAbsoluteDay != null && body.orbitAu > 0 && body.orbitalPeriodDays != null && body.orbitalPeriodDays > 0) {
		const M = meanAnomaly(body.orbitalPeriodDays, body.epochPhase ?? 0, currentAbsoluteDay)
		return solveKeplerE(M, body.ecc)
	}
	if (currentAbsoluteDay != null && body.epochPhase != null) {
		return solveKeplerE(body.epochPhase * Math.PI * 2, body.ecc)
	}
	return (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
}

export function timingUnavailable(body: MapBody): boolean {
	if (body.semiMajorAxisAu == null || body.semiMajorAxisAu <= 0) return false
	return body.effectivePeriodSource === 'unavailable'
		|| body.orbitalPeriodDays == null
		|| body.orbitalPeriodDays <= 0
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
		case 'log':
		case 'inner': {
			if (auMin >= auMax) return (MIN_FIRST_ORBIT + rMax) / 2
			const logMin = Math.log(auMin)
			const logRange = Math.log(auMax) - logMin
			const t = Math.min(1, Math.max(0, (Math.log(Math.max(au, auMin)) - logMin) / logRange))
			return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
		}
		case 'proportional': {
			if (auMin >= auMax) return (MIN_FIRST_ORBIT + rMax) / 2
			const t = Math.min(1, Math.max(0, (au - auMin) / (auMax - auMin)))
			return MIN_FIRST_ORBIT + t * (rMax - MIN_FIRST_ORBIT)
		}
		case 'compact': {
			if (auMin >= auMax) return (MIN_FIRST_ORBIT + rMax) / 2
			const t = Math.min(1, Math.max(0, (au - auMin) / (auMax - auMin))) ** COMPACT_EXPONENT
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

/**
 * Fit orbit lanes using the solid extents that Three.js actually renders.
 * Bodies sharing the same real semi-major axis share a lane (co-orbitals and
 * resolved binary components), while distinct lanes cannot touch at a circular
 * cross-section. Distance transforms remain preferences rather than permission
 * to overlap.
 */
export function enforceOrbitClearance(
	orbiters: OrbitBody[],
	desiredRadii: number[],
	rMax: number,
	centerExtent = 0,
): number[] {
	if (orbiters.length === 0) return []
	type Lane = { orbitAu: number, extent: number, desired: number, indices: number[] }
	const lanes: Lane[] = []
	for (const [index, body] of orbiters.entries()) {
		const extent = overviewBodyExtent(body, body.isStar, body.renderAsSatellite)
		const previous = lanes.at(-1)
		if (previous && Math.abs(previous.orbitAu - body.orbitAu) <= Math.max(1e-9, body.orbitAu * 1e-8)) {
			previous.extent = Math.max(previous.extent, extent)
			previous.desired = Math.max(previous.desired, desiredRadii[index] ?? MIN_FIRST_ORBIT)
			previous.indices.push(index)
		} else {
			lanes.push({
				orbitAu: body.orbitAu,
				extent,
				desired: desiredRadii[index] ?? MIN_FIRST_ORBIT,
				indices: [index],
			})
		}
	}

	const structuralWidth = centerExtent + lanes[0].extent + lanes.slice(1).reduce(
		(total, lane, index) => total + lanes[index].extent + lane.extent,
		0,
	)
	const clearance = Math.min(
		ORBIT_CLEARANCE,
		Math.max(0.75, (rMax - structuralWidth) / lanes.length),
	)
	const minimums = Array.from({ length: lanes.length }, () => 0)
	minimums[0] = Math.max(MIN_FIRST_ORBIT, centerExtent + lanes[0].extent + clearance)
	for (let index = 1; index < lanes.length; index++) {
		minimums[index] = minimums[index - 1]
			+ lanes[index - 1].extent
			+ lanes[index].extent
			+ clearance
	}

	const fit = (preferenceWeight: number) => {
		const result = minimums.map((minimum, index) =>
			minimum + Math.max(0, lanes[index].desired - minimum) * preferenceWeight,
		)
		for (let index = 1; index < result.length; index++) {
			result[index] = Math.max(
				result[index],
				result[index - 1] + lanes[index - 1].extent + lanes[index].extent + clearance,
			)
		}
		return result
	}

	let laneRadii = fit(1)
	if (laneRadii.at(-1)! > rMax && minimums.at(-1)! <= rMax) {
		let low = 0
		let high = 1
		for (let iteration = 0; iteration < 32; iteration++) {
			const middle = (low + high) / 2
			if (fit(middle).at(-1)! <= rMax) low = middle
			else high = middle
		}
		laneRadii = fit(low)
	}

	const result = Array.from({ length: orbiters.length }, () => 0)
	for (const [laneIndex, lane] of lanes.entries()) {
		for (const bodyIndex of lane.indices) result[bodyIndex] = laneRadii[laneIndex]
	}
	return result
}

export type ResolvedBinary = {
	primary: MapBody
	secondary: MapBody
	relativeSemiMajorAxisAu: number
	eccentricity: number
	inclination: number
	longitudeAscendingNode: number
	argumentOfPeriapsis: number
	orbitalPeriodDays: number | null
	epochPhase: number | null
	primaryFactor: number
	secondaryFactor: number
}

const approximatelyEqual = (left: number, right: number) =>
	Math.abs(left - right) <= Math.max(1e-9, Math.abs(left), Math.abs(right)) * 1e-8

function coherentValue(
	left: number | null | undefined,
	right: number | null | undefined,
): { ok: boolean, value: number | null } {
	if (left != null && right != null && !approximatelyEqual(left, right)) return { ok: false, value: null }
	return { ok: true, value: left ?? right ?? null }
}

/** Resolve only the two binary shapes whose semantics are unambiguous. */
export function resolveSimpleBinary(stars: MapBody[]): ResolvedBinary | null {
	if (stars.length !== 2) return null
	let primary: MapBody
	let secondary: MapBody
	const [first, second] = stars
	const sameSystemPair = first.parentSystemId != null
		&& first.parentSystemId === second.parentSystemId
	const parentChildPair = second.parentStarId === first.id || first.parentStarId === second.id
	if (sameSystemPair) {
		;[primary, secondary] = [first, second]
	} else if (parentChildPair) {
		primary = second.parentStarId === first.id ? first : second
		secondary = primary === first ? second : first
	} else {
		return null
	}
	if (primary.massKg == null || primary.massKg <= 0 || secondary.massKg == null || secondary.massKg <= 0) {
		return null
	}

	const axis = coherentValue(
		primary.relativeSemiMajorAxisAu ?? primary.semiMajorAxisAu,
		secondary.relativeSemiMajorAxisAu ?? secondary.semiMajorAxisAu,
	)
	const eccentricity = coherentValue(primary.eccentricity, secondary.eccentricity)
	const inclination = coherentValue(primary.inclination, secondary.inclination)
	const node = coherentValue(primary.longitudeAscendingNode, secondary.longitudeAscendingNode)
	const periapsis = coherentValue(primary.argumentOfPeriapsis, secondary.argumentOfPeriapsis)
	const period = coherentValue(primary.orbitalPeriodDays, secondary.orbitalPeriodDays)
	const phase = coherentValue(primary.epochPhase, secondary.epochPhase)
	if (![axis, eccentricity, inclination, node, periapsis, period, phase].every(field => field.ok)) return null
	if (axis.value == null || axis.value <= 0) return null

	const partition = partitionBinaryRelativeAxis({
		relativeSemiMajorAxisAu: axis.value,
		primaryMassKg: primary.massKg,
		secondaryMassKg: secondary.massKg,
	})
	if (!partition.ok) return null
	return {
		primary,
		secondary,
		relativeSemiMajorAxisAu: axis.value,
		eccentricity: eccentricity.value ?? 0,
		inclination: inclination.value ?? 0,
		longitudeAscendingNode: node.value ?? 0,
		argumentOfPeriapsis: periapsis.value ?? 0,
		orbitalPeriodDays: period.value,
		epochPhase: phase.value,
		primaryFactor: -partition.value.primaryBarycentricSemiMajorAxis.value / axis.value,
		secondaryFactor: partition.value.secondaryBarycentricSemiMajorAxis.value / axis.value,
	}
}

export function buildLayout(stars: MapBody[], bodies: MapBody[], scale: ScaleMode): RootLayout {
	const resolvedBinary = resolveSimpleBinary(stars)
	const hasStellarOrbitShape = stars.some(star => star.parentStarId != null || star.parentSystemId != null)
	const layoutStars = !resolvedBinary && hasStellarOrbitShape
		? stars.map(star => ({
			...star,
			placementProvenance: 'schematic' as const,
			placementNote: 'Schematic stellar placement—binary data is incomplete, conflicting, or higher-order.',
		}))
		: stars
	const centerCandidate = resolvedBinary ? undefined : layoutStars.find(star => !star.parentStarId && !isBarycentric(star))
	const primaryStar = centerCandidate ?? (layoutStars.some(isBarycentric) ? null : layoutStars[0] ?? null)
	const resolvedPrimaryStar = resolvedBinary ? null : primaryStar
	const primaryStarId = resolvedPrimaryStar?.id ?? null
	const companionStars = layoutStars.filter(star => star.parentStarId)
	const directOrbiters: OrbitBody[] = []
	const seen = new Set<EntityKey>()

	if (resolvedBinary) {
		const shared = {
			semiMajorAxisAu: resolvedBinary.relativeSemiMajorAxisAu,
			orbitAu: resolvedBinary.relativeSemiMajorAxisAu,
			eccentricity: resolvedBinary.eccentricity,
			ecc: resolvedBinary.eccentricity,
			inclination: resolvedBinary.inclination,
			longitudeAscendingNode: resolvedBinary.longitudeAscendingNode,
			argumentOfPeriapsis: resolvedBinary.argumentOfPeriapsis,
			orbitalPeriodDays: resolvedBinary.orbitalPeriodDays,
			epochPhase: resolvedBinary.epochPhase,
			isStar: true as const,
			renderAsSatellite: false as const,
			placementProvenance: 'physical' as const,
			placementNote: 'Mass-partitioned about the binary barycenter',
		}
		for (const star of [resolvedBinary.primary, resolvedBinary.secondary]) seen.add(keyForBody(star, true))
		directOrbiters.push(
			{ ...resolvedBinary.primary, ...shared, apseRad: apseRadOf({ ...resolvedBinary.primary, ...shared }) },
			{ ...resolvedBinary.secondary, ...shared, apseRad: apseRadOf({ ...resolvedBinary.secondary, ...shared }) },
		)
	}

	// Barycentric components orbit the (empty or stub) center directly.
	for (const star of layoutStars) {
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

	const sortedDirectOrbiters = directOrbiters.toSorted((a, b) => a.orbitAu - b.orbitAu)

	const maxAu = Math.max(...sortedDirectOrbiters.map(body => body.orbitAu), 1)

	const effectiveMaxAu = scale === 'inner'
		? innerBoundaryAu(sortedDirectOrbiters)
		: maxAu

	const visibleOrbiters = scale === 'inner'
		? sortedDirectOrbiters.filter(body => body.orbitAu <= effectiveMaxAu)
		: sortedDirectOrbiters

	const maximumVisibleEcc = Math.max(...visibleOrbiters.map(body => body.ecc), 0)
	const maxVisualRadius = (CENTER - PADDING) / (1 + maximumVisibleEcc)

	const auMin = visibleOrbiters[0]?.orbitAu ?? 1
	const uniqueOrbitAxes = [...new Set(visibleOrbiters.map(body => body.orbitAu))]
	const rawRadii = visibleOrbiters.map((body) => {
		if (scale !== 'compact') {
			return scaleAuToPixel(body.orbitAu, scale, auMin, effectiveMaxAu, maxVisualRadius)
		}
		const slot = uniqueOrbitAxes.indexOf(body.orbitAu)
		const t = uniqueOrbitAxes.length === 1 ? 0.5 : slot / (uniqueOrbitAxes.length - 1)
		return MIN_FIRST_ORBIT + t * (maxVisualRadius - MIN_FIRST_ORBIT)
	})
	const centerExtent = resolvedPrimaryStar
		? overviewBodyExtent(resolvedPrimaryStar, true, false)
		: 0
	const finalRadii = enforceOrbitClearance(visibleOrbiters, rawRadii, maxVisualRadius, centerExtent)

	const directOrbits: DirectOrbitLayout[] = []
	for (const [index, body] of visibleOrbiters.entries()) {
		const a = finalRadii[index]
		const b = a * Math.sqrt(Math.max(0, 1 - body.ecc * body.ecc))
		directOrbits.push({ body, a, b, index, count: visibleOrbiters.length, outOfRange: false })
	}

	if (scale === 'inner') {
		for (const body of sortedDirectOrbiters) {
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
			const sortedSatellites = groupSatellites.toSorted((a, b) => a.orbitAu - b.orbitAu)

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
				const minZone = Math.max(SAT_MIN_ZONE, sortedSatellites.length * 6)
				zone = Math.min(Math.max(halfGap, minZone), SAT_MAX_ZONE)
			}

			const groupMaxAu = Math.max(...sortedSatellites.map(satellite => satellite.orbitAu), 0)

			for (const [index, satellite] of sortedSatellites.entries()) {
				const t = sortedSatellites.length === 1 ? 0.5 : index / (sortedSatellites.length - 1)
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
					count: sortedSatellites.length,
					zone,
					proportionalRadius,
					proportionalSemiMinor,
					proportionalFocusOffset,
				})
				anchored.add(key)
			}
		}
	}

	if (resolvedBinary && directOrbits.length >= 2) {
		const reference = directOrbits.find(orbit => orbit.body.isStar && orbit.body.id === resolvedBinary.primary.id)
		for (const orbit of directOrbits) {
			if (!orbit.body.isStar || (orbit.body.id !== resolvedBinary.primary.id && orbit.body.id !== resolvedBinary.secondary.id)) continue
			if (reference) {
				orbit.a = reference.a
				orbit.b = reference.b
			}
			if (orbit.body.id === resolvedBinary.primary.id) orbit.binaryFactor = resolvedBinary.primaryFactor
			if (orbit.body.id === resolvedBinary.secondary.id) orbit.binaryFactor = resolvedBinary.secondaryFactor
		}
	}

	return {
		primaryStar: resolvedPrimaryStar,
		directOrbits,
		satellites,
		effectiveMaxAu,
		auMin,
		maxVisualRadius,
		worldUnitsPerAu: null,
		distanceModel: 'schematic',
	}
}

/**
 * Data-faithful orrery geometry. Every local vector uses the same linear AU to
 * world-unit conversion; no body or orbit is moved to create visual clearance.
 * Overview visibility belongs to the renderer's screen-space marker LOD.
 */
export function buildPhysicalLayout(stars: MapBody[], bodies: MapBody[]): RootLayout {
	// Reuse the thoroughly tested parent/binary topology, then discard every
	// schematic radius it produced.
	const topology = buildLayout(stars, bodies, 'proportional')
	const centralRadiusAu = topology.primaryStar?.radiusM != null && topology.primaryStar.radiusM > 0
		? topology.primaryStar.radiusM / 149_597_870_700
		: 0
	const maximumApoapsisAu = Math.max(
		...topology.directOrbits
			.filter(orbit => !orbit.outOfRange)
			.map(orbit => orbit.body.orbitAu * (1 + orbit.body.ecc) * Math.abs(orbit.binaryFactor ?? 1)),
		centralRadiusAu * 4,
		0.05,
	)
	const worldUnitsPerAu = (CENTER - PADDING) / maximumApoapsisAu
	const directOrbits = topology.directOrbits
		.filter(orbit => !orbit.outOfRange)
		.map((orbit) => {
			const a = orbit.body.orbitAu * worldUnitsPerAu
			return {
				...orbit,
				a,
				b: a * Math.sqrt(Math.max(0, 1 - orbit.body.ecc * orbit.body.ecc)),
				outOfRange: false,
			}
		})
	const satellites = topology.satellites.map((satellite) => {
		const orbitRadius = satellite.body.orbitAu * worldUnitsPerAu
		const orbitSemiMinor = orbitRadius * Math.sqrt(Math.max(0, 1 - satellite.body.ecc * satellite.body.ecc))
		return {
			...satellite,
			orbitRadius,
			orbitSemiMinor,
			focusOffset: orbitRadius * satellite.body.ecc,
			zone: orbitRadius * (1 + satellite.body.ecc),
			proportionalRadius: orbitRadius,
			proportionalSemiMinor: orbitSemiMinor,
			proportionalFocusOffset: orbitRadius * satellite.body.ecc,
		}
	})
	return {
		...topology,
		directOrbits,
		satellites,
		maxVisualRadius: maximumApoapsisAu * worldUnitsPerAu,
		worldUnitsPerAu,
		distanceModel: 'physical',
	}
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
	layout: RootLayout,
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
		const factor = orbit.binaryFactor ?? 1
		positions.set(keyForBody(orbit.body, orbit.body.isStar), {
			x: CENTER + (pos.x - CENTER) * factor,
			y: CENTER + (pos.y - CENTER) * factor,
			angle,
		})
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

function rotateOrbitVector(
	body: OrbitBody,
	vector: { x: number, y: number, z: number },
	viewBlend: number,
): { x: number, y: number, z: number } {
	const plan = rotatePerifocalToInertial(vector, {
		inclinationDeg: 0,
		longitudeAscendingNodeDeg: body.longitudeAscendingNode ?? 0,
		argumentOfPeriapsisDeg: body.argumentOfPeriapsis ?? 0,
	})
	if (viewBlend <= 0) return plan
	const orrery = rotatePerifocalToInertial(vector, {
		inclinationDeg: body.inclination ?? 0,
		longitudeAscendingNodeDeg: body.longitudeAscendingNode ?? 0,
		argumentOfPeriapsisDeg: body.argumentOfPeriapsis ?? 0,
	})
	const t = Math.min(1, Math.max(0, viewBlend))
	return {
		x: plan.x + (orrery.x - plan.x) * t,
		y: plan.y + (orrery.y - plan.y) * t,
		z: plan.z + (orrery.z - plan.z) * t,
	}
}

/** 3D body positions in the same 800-unit world, with Plan at z=0. */
export function computePositions3D(
	layout: RootLayout,
	currentAbsoluteDay?: number | null,
	viewBlend = 1,
	satelliteBlend?: (satellite: SatelliteLayout) => number,
): Map<EntityKey, BodyPosition3D> {
	const positions = new Map<EntityKey, BodyPosition3D>()
	if (layout.primaryStar) {
		positions.set(keyForBody(layout.primaryStar, true), { x: CENTER, y: CENTER, z: 0, angle: 0 })
	}

	for (const orbit of layout.directOrbits) {
		const angle = computeAngle(orbit.body, orbit.index, orbit.count, currentAbsoluteDay)
		const focusOffset = orbit.outOfRange ? 0 : Math.sqrt(Math.max(orbit.a * orbit.a - orbit.b * orbit.b, 0))
		const local = { x: orbit.a * Math.cos(angle) - focusOffset, y: orbit.b * Math.sin(angle), z: 0 }
		const rotated = orbit.outOfRange ? local : rotateOrbitVector(orbit.body, local, viewBlend)
		const factor = orbit.binaryFactor ?? 1
		positions.set(keyForBody(orbit.body, orbit.body.isStar), {
			x: CENTER + rotated.x * factor,
			y: CENTER + rotated.y * factor,
			z: rotated.z * factor,
			angle,
		})
	}

	for (const satellite of layout.satellites) {
		const parent = positions.get(satellite.parentKey)
		if (!parent) continue
		const angle = computeAngle(satellite.body, satellite.index, satellite.count, currentAbsoluteDay)
		const geometry = blendedSatelliteGeometry(satellite, satelliteBlend?.(satellite) ?? 0)
		const local = {
			x: geometry.radius * Math.cos(angle) - geometry.focusOffset,
			y: geometry.semiMinor * Math.sin(angle),
			z: 0,
		}
		const rotated = rotateOrbitVector(satellite.body, local, viewBlend)
		positions.set(keyForBody(satellite.body, satellite.body.isStar), {
			x: parent.x + rotated.x,
			y: parent.y + rotated.y,
			z: parent.z + rotated.z,
			angle,
		})
	}
	return positions
}

export function orbitPoint3D(
	body: OrbitBody,
	a: number,
	b: number,
	eccentricAnomaly: number,
	viewBlend: number,
	binaryFactor = 1,
): { x: number, y: number, z: number } {
	const focusOffset = Math.sqrt(Math.max(a * a - b * b, 0))
	const rotated = rotateOrbitVector(body, {
		x: a * Math.cos(eccentricAnomaly) - focusOffset,
		y: b * Math.sin(eccentricAnomaly),
		z: 0,
	}, viewBlend)
	return { x: rotated.x * binaryFactor, y: rotated.y * binaryFactor, z: rotated.z * binaryFactor }
}

export function computeCameraOffset(
	_layout: RootLayout,
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
