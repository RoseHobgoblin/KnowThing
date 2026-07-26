import { describe, it, expect } from 'vitest'
import {
	SIZE,
	CENTER,
	MIN_FIRST_ORBIT,
	MIN_ADJACENT_GAP,
	R_GUARD,
	SAT_MIN_ZONE,
	SAT_MAX_ZONE,
	keyForBody,
	bodyRadius,
	apseRadOf,
	ellipsePosition,
	parentKeyForBody,
	isBarycentric,
	innerBoundaryAu,
	scaleAuToPixel,
	enforceMinGaps,
	buildSelectionFamily,
	buildLayout,
	computePositions,
	computeCameraOffset,
	buildScene,
	type MapBody,
	type OrbitBody,
	type EntityKey,
} from './system-layout.js'

function star(overrides: Partial<MapBody> & { id: number }): MapBody {
	return {
		name: `Star ${overrides.id}`,
		slug: `star-${overrides.id}`,
		bodyType: 'star',
		...overrides,
	}
}

function body(overrides: Partial<MapBody> & { id: number }): MapBody {
	return {
		name: `Body ${overrides.id}`,
		slug: `body-${overrides.id}`,
		bodyType: 'planet',
		...overrides,
	}
}

function orbiter(orbitAu: number, ecc = 0): OrbitBody {
	return {
		...body({ id: Math.round(orbitAu * 1000) }),
		orbitAu,
		ecc,
		isStar: false,
		renderAsSatellite: false,
		apseRad: 0,
	}
}

// A single-star system: primary + two planets + a moon on the outer planet.
const soleStar = star({ id: 1 })
const innerPlanet = body({ id: 10, starId: 1, semiMajorAxisAu: 0.5 })
const outerPlanet = body({ id: 11, starId: 1, semiMajorAxisAu: 5, eccentricity: 0.2 })
const moon = body({ id: 12, starId: 1, parentId: 11, semiMajorAxisAu: 0.002 })

describe('enforceMinGaps', () => {
	it('pushes the first orbit out to the minimum', () => {
		const result = enforceMinGaps([10, 60], 300)
		expect(result[0]).toBe(MIN_FIRST_ORBIT)
		expect(result[1]).toBe(60)
	})

	it('enforces the adjacent gap between crowded orbits', () => {
		const result = enforceMinGaps([100, 104, 106], 300)
		expect(result[1] - result[0]).toBeGreaterThanOrEqual(MIN_ADJACENT_GAP)
		expect(result[2] - result[1]).toBeGreaterThanOrEqual(MIN_ADJACENT_GAP)
	})

	it('rescales back inside rMax when gap enforcement overflows', () => {
		const radii = [100, 102, 104, 106, 108]
		const rMax = 120
		const result = enforceMinGaps(radii, rMax)
		expect(result.at(-1)!).toBeLessThanOrEqual(rMax + 1e-9)
		// Reduced gap is still proportionally enforced
		for (let index = 1; index < result.length; index++) {
			expect(result[index]).toBeGreaterThan(result[index - 1])
		}
	})

	it('passes through an empty list', () => {
		expect(enforceMinGaps([], 100)).toEqual([])
	})
})

describe('innerBoundaryAu', () => {
	it('cuts at the geometric mean of the largest gap', () => {
		const orbiters = [orbiter(0.4), orbiter(0.7), orbiter(1), orbiter(5.2), orbiter(9.5)]
		// Largest ratio is 5.2/1 → boundary between 1 and 5.2
		expect(innerBoundaryAu(orbiters)).toBeCloseTo(Math.sqrt(1 * 5.2))
	})

	it('returns the outermost orbit when no ratio reaches 2x', () => {
		const orbiters = [orbiter(1), orbiter(1.5), orbiter(2.2)]
		expect(innerBoundaryAu(orbiters)).toBe(2.2)
	})

	it('handles a single orbiter', () => {
		expect(innerBoundaryAu([orbiter(3)])).toBe(3)
	})

	it('handles no orbiters', () => {
		expect(innerBoundaryAu([])).toBe(1)
	})
})

describe('scaleAuToPixel', () => {
	const auMin = 0.5
	const auMax = 30
	const rMax = 300

	it('log: maps auMin to the first-orbit radius and auMax to rMax', () => {
		expect(scaleAuToPixel(auMin, 'log', auMin, auMax, rMax)).toBeCloseTo(MIN_FIRST_ORBIT)
		expect(scaleAuToPixel(auMax, 'log', auMin, auMax, rMax)).toBeCloseTo(rMax)
	})

	it('log: degenerate range collapses to the midpoint', () => {
		expect(scaleAuToPixel(1, 'log', 2, 2, rMax)).toBeCloseTo((MIN_FIRST_ORBIT + rMax) / 2)
	})

	it('proportional and inner: linear from the guard radius', () => {
		for (const mode of ['proportional', 'inner'] as const) {
			expect(scaleAuToPixel(0, mode, auMin, auMax, rMax)).toBeCloseTo(R_GUARD)
			expect(scaleAuToPixel(auMax, mode, auMin, auMax, rMax)).toBeCloseTo(rMax)
			expect(scaleAuToPixel(auMax / 2, mode, auMin, auMax, rMax)).toBeCloseTo(R_GUARD + (rMax - R_GUARD) / 2)
		}
	})

	it('compact: power curve between first orbit and rMax', () => {
		expect(scaleAuToPixel(auMax, 'compact', auMin, auMax, rMax)).toBeCloseTo(rMax)
		const half = scaleAuToPixel(auMax / 2, 'compact', auMin, auMax, rMax)
		// Compact compresses the outer system: half the distance lands past the linear midpoint
		expect(half).toBeGreaterThan(MIN_FIRST_ORBIT + (rMax - MIN_FIRST_ORBIT) / 2)
	})
})

describe('ellipsePosition', () => {
	it('places angle 0 at periapsis on the +x side of the focus', () => {
		const a = 100
		const b = 80
		const focusOffset = Math.sqrt(a * a - b * b)
		const pos = ellipsePosition(a, b, 0, CENTER, CENTER)
		expect(pos.x).toBeCloseTo(CENTER + a - focusOffset)
		expect(pos.y).toBeCloseTo(CENTER)
	})

	it('rotates the whole orbit about the focus by apseRad', () => {
		const a = 100
		const b = 80
		const focusOffset = Math.sqrt(a * a - b * b)
		const periDistance = a - focusOffset
		const quarterTurn = Math.PI / 2
		const pos = ellipsePosition(a, b, 0, CENTER, CENTER, quarterTurn)
		// Periapsis swings to +y, same distance from the focus
		expect(pos.x).toBeCloseTo(CENTER)
		expect(pos.y).toBeCloseTo(CENTER + periDistance)
	})

	it('degenerates to a circle when a equals b', () => {
		const pos = ellipsePosition(50, 50, Math.PI, 0, 0)
		expect(pos.x).toBeCloseTo(-50)
		expect(pos.y).toBeCloseTo(0)
	})
})

describe('apseRadOf', () => {
	it('sums node and periapsis arguments in degrees', () => {
		expect(apseRadOf(body({ id: 1, longitudeAscendingNode: 90, argumentOfPeriapsis: 45 }))).toBeCloseTo((135 * Math.PI) / 180)
	})

	it('wraps past 360 and defaults absent fields to 0', () => {
		expect(apseRadOf(body({ id: 1, longitudeAscendingNode: 350, argumentOfPeriapsis: 20 }))).toBeCloseTo((10 * Math.PI) / 180)
		expect(apseRadOf(body({ id: 1 }))).toBe(0)
	})
})

describe('parentKeyForBody', () => {
	it('routes parentId to a body key even when a star shares the numeric id', () => {
		// Body id 7 and star id 7 exist; parentId must resolve to the body
		expect(parentKeyForBody(body({ id: 99, parentId: 7 }), 1)).toBe('body:7')
	})

	it('routes starId to a star key when it is not the primary', () => {
		expect(parentKeyForBody(body({ id: 99, starId: 2 }), 1)).toBe('star:2')
	})

	it('returns null for direct orbiters of the primary star', () => {
		expect(parentKeyForBody(body({ id: 99, starId: 1 }), 1)).toBeNull()
		expect(parentKeyForBody(body({ id: 99 }), 1)).toBeNull()
	})
})

describe('isBarycentric', () => {
	it('requires a system parent and a positive orbit', () => {
		expect(isBarycentric(star({ id: 1, parentSystemId: 5, semiMajorAxisAu: 0.2 }))).toBe(true)
		expect(isBarycentric(star({ id: 1, parentSystemId: 5, semiMajorAxisAu: 0 }))).toBe(false)
		expect(isBarycentric(star({ id: 1, semiMajorAxisAu: 0.2 }))).toBe(false)
	})
})

describe('buildSelectionFamily', () => {
	const stars = [soleStar]
	const bodies = [innerPlanet, outerPlanet, moon]

	it('is empty with no selection', () => {
		expect(buildSelectionFamily(stars, bodies, null, soleStar).size).toBe(0)
	})

	it('selecting the star pulls in its planets and their moons', () => {
		const family = buildSelectionFamily(stars, bodies, 'star:1', soleStar)
		expect(family).toEqual(new Set<EntityKey>(['star:1', 'body:10', 'body:11', 'body:12']))
	})

	it('selecting a moon pulls in its parent body and host star', () => {
		const family = buildSelectionFamily(stars, bodies, 'body:12', soleStar)
		expect(family).toEqual(new Set<EntityKey>(['body:12', 'body:11', 'star:1']))
	})

	it('selecting a planet pulls in its star and children', () => {
		const family = buildSelectionFamily(stars, bodies, 'body:11', soleStar)
		expect(family).toEqual(new Set<EntityKey>(['body:11', 'star:1', 'body:12']))
	})
})

describe('buildLayout', () => {
	it('lays out a simple system: sorted direct orbits, moon as satellite', () => {
		const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon], 'log')
		expect(layout.primaryStar?.id).toBe(1)
		expect(layout.directOrbits.map(orbit => orbit.body.id)).toEqual([10, 11])
		expect(layout.satellites).toHaveLength(1)
		expect(layout.satellites[0].body.id).toBe(12)
		expect(layout.satellites[0].parentKey).toBe('body:11')
		expect(layout.satellites[0].orbitRadius).toBeGreaterThan(0)
		expect(layout.satellites[0].orbitRadius).toBeLessThanOrEqual(SAT_MAX_ZONE)
	})

	it('keeps satellite zones at the minimum for anchors without a ring radius', () => {
		// star4 orbits star3, which is itself a satellite (companion of a companion)
		// and therefore has no direct-orbiter ring radius → minimum zone applies.
		const primary = star({ id: 1 })
		const companion = star({ id: 2, parentStarId: 1, semiMajorAxisAu: 20 })
		const deepCompanion = star({ id: 3, parentStarId: 2, semiMajorAxisAu: 0.5 })
		const deepest = star({ id: 4, parentStarId: 3, semiMajorAxisAu: 0.1 })
		const layout = buildLayout([primary, companion, deepCompanion, deepest], [], 'log')
		const deep = layout.satellites.find(satellite => satellite.body.id === 4)
		expect(deep).toBeDefined()
		expect(deep!.parentKey).toBe('star:3')
		expect(deep!.orbitRadius).toBeLessThanOrEqual(SAT_MIN_ZONE)
	})

	it('barycentric pair: no primary at center, both components orbit directly', () => {
		const a = star({ id: 1, parentSystemId: 100, semiMajorAxisAu: 0.3 })
		const b = star({ id: 2, parentSystemId: 100, semiMajorAxisAu: 0.5 })
		const layout = buildLayout([a, b], [], 'log')
		expect(layout.primaryStar).toBeNull()
		expect(layout.directOrbits.map(orbit => orbit.body.id)).toEqual([1, 2])
	})

	it('inner mode: outer bodies past the boundary are flagged out of range', () => {
		const bodies = [
			body({ id: 20, starId: 1, semiMajorAxisAu: 0.4 }),
			body({ id: 21, starId: 1, semiMajorAxisAu: 0.9 }),
			body({ id: 22, starId: 1, semiMajorAxisAu: 30 }),
		]
		const layout = buildLayout([soleStar], bodies, 'inner')
		const outOfRange = layout.directOrbits.filter(orbit => orbit.outOfRange)
		expect(outOfRange.map(orbit => orbit.body.id)).toEqual([22])
		expect(layout.effectiveMaxAu).toBeCloseTo(Math.sqrt(0.9 * 30))
		// Parked on the oversized circle
		expect(outOfRange[0].a).toBeCloseTo(layout.maxVisualRadius * 2)
		expect(outOfRange[0].b).toBeCloseTo(outOfRange[0].a)
	})

	it('moon of a moon resolves through multi-level satellite placement', () => {
		const submoon = body({ id: 13, starId: 1, parentId: 12, semiMajorAxisAu: 0.0001 })
		const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon, submoon], 'log')
		const keys = layout.satellites.map(satellite => keyForBody(satellite.body, satellite.body.isStar))
		// Parent moon must be placed before its own satellite
		expect(keys.indexOf('body:12')).toBeLessThan(keys.indexOf('body:13'))
		expect(layout.satellites.find(satellite => satellite.body.id === 13)?.parentKey).toBe('body:12')
	})
})

describe('computePositions', () => {
	const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon], 'log')

	it('includes the primary star at the center', () => {
		const positions = computePositions(layout)
		expect(positions.get('star:1')).toEqual({ x: CENTER, y: CENTER, angle: 0 })
	})

	it('spaces bodies evenly when no date is set', () => {
		const positions = computePositions(layout, null)
		const inner = positions.get('body:10')!
		// index 0 of 2 → angle -π/2
		expect(inner.angle).toBeCloseTo(-Math.PI / 2)
	})

	it('solves Kepler when a date is set, fractional days included', () => {
		const day0 = computePositions(layout, 0)
		const dayHalf = computePositions(layout, 0.5)
		const day1 = computePositions(layout, 1)
		const inner0 = day0.get('body:10')!
		const innerHalf = dayHalf.get('body:10')!
		const inner1 = day1.get('body:10')!
		// Body advances monotonically along its orbit over a fraction of its period
		expect(innerHalf.angle).not.toBeCloseTo(inner0.angle)
		expect(inner1.angle).not.toBeCloseTo(innerHalf.angle)
		// Fractional day lands strictly between whole days (well inside one period)
		expect(innerHalf.angle).toBeGreaterThan(inner0.angle)
		expect(innerHalf.angle).toBeLessThan(inner1.angle)
	})

	it('places satellites relative to their parent position', () => {
		const positions = computePositions(layout, 42)
		const parent = positions.get('body:11')!
		const moonPos = positions.get('body:12')!
		const satellite = layout.satellites[0]
		const distance = Math.hypot(moonPos.x - parent.x, moonPos.y - parent.y)
		// Within the satellite zone: never farther than orbitRadius + focus offset
		expect(distance).toBeLessThanOrEqual(satellite.orbitRadius + satellite.focusOffset + 1e-9)
		expect(distance).toBeGreaterThan(0)
	})

	it('positions stay inside the padded world square for circular orbits', () => {
		const positions = computePositions(layout, 1234)
		for (const position of positions.values()) {
			expect(position.x).toBeGreaterThanOrEqual(0)
			expect(position.x).toBeLessThanOrEqual(SIZE)
			expect(position.y).toBeGreaterThanOrEqual(0)
			expect(position.y).toBeLessThanOrEqual(SIZE)
		}
	})
})

describe('computeCameraOffset', () => {
	const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon], 'log')
	const positions = computePositions(layout, 42)

	it('is zero when not following or nothing selected', () => {
		expect(computeCameraOffset(layout, positions, 'body:11', false)).toEqual({ x: 0, y: 0 })
		expect(computeCameraOffset(layout, positions, null, true)).toEqual({ x: 0, y: 0 })
	})

	it('centers the selected body', () => {
		const offset = computeCameraOffset(layout, positions, 'body:11', true)
		const target = positions.get('body:11')!
		expect(target.x + offset.x).toBeCloseTo(CENTER)
		expect(target.y + offset.y).toBeCloseTo(CENTER)
	})

	it('is zero for the primary star (already centered)', () => {
		expect(computeCameraOffset(layout, positions, 'star:1', true)).toEqual({ x: 0, y: 0 })
	})
})

describe('buildScene', () => {
	it('assembles a coherent scene with projected positions and hit targets', () => {
		const scene = buildScene({
			stars: [soleStar],
			bodies: [innerPlanet, outerPlanet, moon],
			scale: 'log',
			selectedId: 'body:11',
			follow: true,
			currentAbsoluteDay: 42,
		})
		expect(scene.primaryStar?.id).toBe(1)
		expect(scene.directPositions).toHaveLength(2)
		expect(scene.satellitePositions).toHaveLength(1)

		// Follow projects the selected body onto the center
		const selected = scene.directPositions.find(position => position.body.id === 11)!
		expect(selected.x).toBeCloseTo(CENTER)
		expect(selected.y).toBeCloseTo(CENTER)

		// Satellite parent coordinates are projected consistently
		const satellite = scene.satellitePositions[0]
		expect(satellite.parentX).toBeCloseTo(selected.x)
		expect(satellite.parentY).toBeCloseTo(selected.y)

		// Hit targets: star + 2 direct + 1 satellite, radii per class
		expect(scene.hitTargets).toHaveLength(4)
		expect(scene.hitTargets.find(target => target.id === 'star:1')?.r).toBe(12)
		expect(scene.hitTargets.find(target => target.id === 'body:10')?.r).toBe(Math.max(8, bodyRadius({ isStar: false }) + 5))
		expect(scene.hitTargets.find(target => target.id === 'body:12')?.r).toBe(8)

		expect(scene.selectionFamily).toEqual(new Set<EntityKey>(['body:11', 'star:1', 'body:12']))
	})

	it('embed defaults: no selection, no follow, no date', () => {
		const scene = buildScene({
			stars: [soleStar],
			bodies: [innerPlanet, outerPlanet],
			scale: 'log',
			selectedId: null,
			follow: false,
		})
		expect(scene.cameraOffset).toEqual({ x: 0, y: 0 })
		expect(scene.selectionFamily.size).toBe(0)
		expect(scene.directPositions).toHaveLength(2)
	})
})
