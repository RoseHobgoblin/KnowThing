import { describe, it, expect } from 'vitest'
import {
	SIZE,
	CENTER,
	MIN_FIRST_ORBIT,
	MIN_ADJACENT_GAP,
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
	enforceOrbitClearance,
	buildSelectionFamily,
	buildLayout,
	buildPhysicalLayout,
	computePositions,
	computeCameraOffset,
	buildScene,
	blendedSatelliteGeometry,
	computePositions3D,
	resolveSimpleBinary,
	timingUnavailable,
	type MapBody,
	type OrbitBody,
	type EntityKey,
} from './root-layout.js'
import { overviewBodyExtent } from './body-sizing.js'

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
const innerPlanet = body({ id: 10, starId: 1, semiMajorAxisAu: 0.5, orbitalPeriodDays: 100 })
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

	it('proportional maps the visible distance range linearly', () => {
		expect(scaleAuToPixel(auMin, 'proportional', auMin, auMax, rMax)).toBeCloseTo(MIN_FIRST_ORBIT)
		expect(scaleAuToPixel(auMax, 'proportional', auMin, auMax, rMax)).toBeCloseTo(rMax)
		expect(scaleAuToPixel((auMin + auMax) / 2, 'proportional', auMin, auMax, rMax))
			.toBeCloseTo(MIN_FIRST_ORBIT + (rMax - MIN_FIRST_ORBIT) / 2)
	})

	it('inner uses the adaptive logarithmic transform within its selected cluster', () => {
		expect(scaleAuToPixel(auMin, 'inner', auMin, auMax, rMax)).toBeCloseTo(MIN_FIRST_ORBIT)
		expect(scaleAuToPixel(auMax, 'inner', auMin, auMax, rMax)).toBeCloseTo(rMax)
	})

	it('compact: power curve between first orbit and rMax', () => {
		expect(scaleAuToPixel(auMax, 'compact', auMin, auMax, rMax)).toBeCloseTo(rMax)
		const half = scaleAuToPixel(auMax / 2, 'compact', auMin, auMax, rMax)
		// Compact compresses the outer system: half the distance lands past the linear midpoint
		expect(half).toBeGreaterThan(MIN_FIRST_ORBIT + (rMax - MIN_FIRST_ORBIT) / 2)
	})
})

describe('collision-aware orbit lanes', () => {
	it('reserves the rendered body and ring extents in dense systems for every scale', () => {
		const denseBodies = Array.from({ length: 14 }, (_, index) => body({
			id: 100 + index,
			starId: 1,
			semiMajorAxisAu: 0.2 + index * 0.055,
			radiusM: index % 3 === 0 ? 69_900_000 : 6_371_000,
		}))
		for (const mode of ['log', 'proportional', 'compact', 'inner'] as const) {
			const layout = buildLayout([star({ id: 1, radiusM: 695_700_000 })], denseBodies, mode)
			const visible = layout.directOrbits.filter(orbit => !orbit.outOfRange)
			for (let index = 1; index < visible.length; index++) {
				const previous = visible[index - 1]
				const current = visible[index]
				const required = overviewBodyExtent(previous.body, previous.body.isStar, false)
					+ overviewBodyExtent(current.body, current.body.isStar, false)
				expect(current.a - previous.a).toBeGreaterThan(required)
			}
			expect(visible.at(-1)!.a).toBeLessThanOrEqual(layout.maxVisualRadius + 1e-6)
		}
	})

	it('allows coherent co-orbitals to share one lane', () => {
		const coOrbitals = [orbiter(1), orbiter(1), orbiter(2)]
		const result = enforceOrbitClearance(coOrbitals, [40, 40, 42], 300, 7)
		expect(result[0]).toBe(result[1])
		expect(result[2]).toBeGreaterThan(result[1])
	})
})

describe('physical orrery layout', () => {
	it('anchors an independent body root at the centre and resolves its moon', () => {
		const rogue = body({ id: 300, name: 'Waywain', isRoot: true, radiusM: 6_371_000 })
		const rogueMoon = body({
			id: 301,
			name: 'Hearthling',
			parentId: rogue.id,
			semiMajorAxisAu: 0.00257,
			orbitalPeriodDays: 29.5,
		})
		const layout = buildPhysicalLayout([], [rogue, rogueMoon])
		const positions = computePositions3D(layout, 12_345.5)

		expect(layout.primaryStar).toBeNull()
		expect(layout.rootBody?.id).toBe(rogue.id)
		expect(layout.directOrbits).toHaveLength(0)
		expect(layout.satellites).toHaveLength(1)
		expect(layout.satellites[0].parentKey).toBe('body:300')
		expect(positions.get('body:300')).toMatchObject({ x: CENTER, y: CENTER, z: 0 })
		expect(positions.get('body:301')).toBeDefined()
		expect(layout.worldUnitsPerAu).toBeGreaterThan(0)
	})

	it('frames a solitary body root at a visible physical size', () => {
		const rogue = body({ id: 302, isRoot: true, radiusM: 6_371_000 })
		const layout = buildPhysicalLayout([], [rogue])
		const rootRadiusWorld = rogue.radiusM! / 149_597_870_700 * layout.worldUnitsPerAu!

		expect(rootRadiusWorld).toBeCloseTo((CENTER - 80) / 4)
	})

	it('uses one linear AU conversion for every direct orbit', () => {
		const worlds = [
			body({ id: 201, starId: 1, semiMajorAxisAu: 0.5 }),
			body({ id: 202, starId: 1, semiMajorAxisAu: 1 }),
			body({ id: 203, starId: 1, semiMajorAxisAu: 5 }),
		]
		const layout = buildPhysicalLayout([soleStar], worlds)
		expect(layout.distanceModel).toBe('physical')
		expect(layout.worldUnitsPerAu).not.toBeNull()
		for (const orbit of layout.directOrbits) {
			expect(orbit.a / orbit.body.orbitAu).toBeCloseTo(layout.worldUnitsPerAu!)
		}
		expect(layout.directOrbits[1].a / layout.directOrbits[0].a).toBeCloseTo(2)
		expect(layout.directOrbits[2].a / layout.directOrbits[1].a).toBeCloseTo(5)
	})

	it('uses the same AU conversion for nested satellite vectors', () => {
		const layout = buildPhysicalLayout([soleStar], [outerPlanet, moon])
		const planetOrbit = layout.directOrbits.find(orbit => orbit.body.id === outerPlanet.id)!
		const moonOrbit = layout.satellites.find(orbit => orbit.body.id === moon.id)!
		expect(planetOrbit.a / outerPlanet.semiMajorAxisAu!).toBeCloseTo(layout.worldUnitsPerAu!)
		expect(moonOrbit.orbitRadius / moon.semiMajorAxisAu!).toBeCloseTo(layout.worldUnitsPerAu!)
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

describe('moon-LOD unfold (proportional satellite geometry)', () => {
	// A planet with three moons at 1:2:4 real spacing, circular orbits.
	const planet = body({ id: 20, starId: 1, semiMajorAxisAu: 2 })
	const moons = [
		body({ id: 21, starId: 1, parentId: 20, semiMajorAxisAu: 0.001 }),
		body({ id: 22, starId: 1, parentId: 20, semiMajorAxisAu: 0.002 }),
		body({ id: 23, starId: 1, parentId: 20, semiMajorAxisAu: 0.004 }),
	]
	const layout = buildLayout([soleStar], [planet, ...moons], 'log')
	const byId = (id: number) => layout.satellites.find(satellite => satellite.body.id === id)!

	const distanceToParent = (blend?: () => number) => {
		const positions = computePositions(layout, 42, blend)
		const parent = positions.get('body:20')!
		const moon = positions.get('body:21')!
		return Math.hypot(moon.x - parent.x, moon.y - parent.y)
	}

	it('proportional radii follow real semi-major-axis ratios, outermost at the zone edge', () => {
		const zone = byId(21).zone
		expect(byId(23).proportionalRadius).toBeCloseTo(zone)
		expect(byId(22).proportionalRadius).toBeCloseTo(Math.max(2, zone / 2))
		expect(byId(21).proportionalRadius).toBeCloseTo(Math.max(2, zone / 4))
	})

	it('schematic radii stay evenly spaced (unchanged by the proportional set)', () => {
		const radii = [byId(21).orbitRadius, byId(22).orbitRadius, byId(23).orbitRadius]
		expect(radii[1] - radii[0]).toBeCloseTo(radii[2] - radii[1])
	})

	it('blendedSatelliteGeometry interpolates between the two layouts', () => {
		const satellite = byId(21)
		expect(blendedSatelliteGeometry(satellite, 0).radius).toBeCloseTo(satellite.orbitRadius)
		expect(blendedSatelliteGeometry(satellite, 1).radius).toBeCloseTo(satellite.proportionalRadius)
		expect(blendedSatelliteGeometry(satellite, 0.5).radius).toBeCloseTo(
			(satellite.orbitRadius + satellite.proportionalRadius) / 2,
		)
		// Out-of-range t clamps
		expect(blendedSatelliteGeometry(satellite, 2).radius).toBeCloseTo(satellite.proportionalRadius)
		expect(blendedSatelliteGeometry(satellite, -1).radius).toBeCloseTo(satellite.orbitRadius)
	})

	it('computePositions places satellites at the blended radius', () => {
		const satellite = byId(21)
		expect(distanceToParent()).toBeCloseTo(satellite.orbitRadius)
		expect(distanceToParent(() => 1)).toBeCloseTo(satellite.proportionalRadius)
		const half = distanceToParent(() => 0.5)
		expect(half).toBeCloseTo((satellite.orbitRadius + satellite.proportionalRadius) / 2)
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

	it('freezes honestly when timing is unavailable', () => {
		const fixed = body({ id: 80, starId: 1, semiMajorAxisAu: 1, epochPhase: 0.25, effectivePeriodSource: 'unavailable' })
		const fixedLayout = buildLayout([soleStar], [fixed], 'log')
		const day0 = computePositions(fixedLayout, 0).get('body:80')!
		const day100 = computePositions(fixedLayout, 100).get('body:80')!
		expect(day100).toEqual(day0)
		expect(timingUnavailable(fixed)).toBe(true)
	})
})

describe('computePositions3D', () => {
	it('Plan preserves the current XY placement and flattens z', () => {
		const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon], 'log')
		const flat = computePositions(layout, 42)
		const plan = computePositions3D(layout, 42, 0)
		for (const [key, position] of flat) {
			expect(plan.get(key)?.x).toBeCloseTo(position.x)
			expect(plan.get(key)?.y).toBeCloseTo(position.y)
			expect(plan.get(key)?.z).toBeCloseTo(0)
		}
	})

	it('Orrery applies full inclination and nested moons inherit parent z', () => {
		const tiltedPlanet = body({
			id: 90, starId: 1, semiMajorAxisAu: 2, orbitalPeriodDays: 10,
			inclination: 90, longitudeAscendingNode: 0, argumentOfPeriapsis: 0,
		})
		const tiltedMoon = body({
			id: 91, starId: 1, parentId: 90, semiMajorAxisAu: 0.01, orbitalPeriodDays: 2,
			inclination: 45,
		})
		const layout = buildLayout([soleStar], [tiltedPlanet, tiltedMoon], 'log')
		const positions = computePositions3D(layout, 2.5, 1)
		const planet = positions.get('body:90')!
		const moonPosition = positions.get('body:91')!
		expect(Math.abs(planet.z)).toBeGreaterThan(1)
		expect(moonPosition.z).not.toBeCloseTo(planet.z)
	})
})

describe('resolved stellar binaries', () => {
	it('puts equal masses on equal and opposite sides of the barycenter', () => {
		const primary = star({ id: 100, massKg: 2, parentSystemId: 7, semiMajorAxisAu: 1, orbitalPeriodDays: 10 })
		const secondary = star({ id: 101, massKg: 2, parentSystemId: 7, semiMajorAxisAu: 1, orbitalPeriodDays: 10 })
		const resolution = resolveSimpleBinary([primary, secondary])!
		expect(resolution.primaryFactor).toBeCloseTo(-0.5)
		expect(resolution.secondaryFactor).toBeCloseTo(0.5)
		const positions = computePositions3D(buildLayout([primary, secondary], [], 'log'), 2, 1)
		const p = positions.get('star:100')!
		const s = positions.get('star:101')!
		expect(p.x - CENTER).toBeCloseTo(-(s.x - CENTER))
		expect(p.y - CENTER).toBeCloseTo(-(s.y - CENTER))
		expect(p.z).toBeCloseTo(-s.z)
	})

	it('partitions one coherent relative axis while keeping the weighted barycenter at zero', () => {
		const primary = star({ id: 101, massKg: 3, parentSystemId: 7, semiMajorAxisAu: 2, orbitalPeriodDays: 20 })
		const secondary = star({ id: 102, massKg: 1, parentSystemId: 7, semiMajorAxisAu: 2, orbitalPeriodDays: 20 })
		const resolution = resolveSimpleBinary([primary, secondary])!
		expect(resolution.primaryFactor).toBeCloseTo(-0.25)
		expect(resolution.secondaryFactor).toBeCloseTo(0.75)
		const layout = buildLayout([primary, secondary], [], 'log')
		const positions = computePositions3D(layout, 3, 1)
		const p = positions.get('star:101')!
		const s = positions.get('star:102')!
		expect(3 * (p.x - CENTER) + (s.x - CENTER)).toBeCloseTo(0)
		expect(3 * (p.y - CENTER) + (s.y - CENTER)).toBeCloseTo(0)
		expect(3 * p.z + s.z).toBeCloseTo(0)
	})

	it('rejects conflicting axes and leaves the pair schematic', () => {
		const primary = star({ id: 101, massKg: 1, parentSystemId: 7, semiMajorAxisAu: 1 })
		const secondary = star({ id: 102, massKg: 1, parentSystemId: 7, semiMajorAxisAu: 2 })
		expect(resolveSimpleBinary([primary, secondary])).toBeNull()
		const layout = buildLayout([primary, secondary], [], 'log')
		expect(layout.directOrbits.every(orbit => orbit.binaryFactor == null)).toBe(true)
		expect(layout.directOrbits.every(orbit => orbit.body.placementProvenance === 'schematic')).toBe(true)
		expect(layout.directOrbits[0].body.placementNote).toMatch(/incomplete, conflicting, or higher-order/)
	})
})

describe('scale-mode determinism', () => {
	it.each(['log', 'proportional', 'compact', 'inner'] as const)('%s stays finite, bounded, and deterministic', (scale) => {
		const layout = buildLayout([soleStar], [innerPlanet, outerPlanet, moon], scale)
		const first = computePositions3D(layout, 123.5, 1)
		const second = computePositions3D(layout, 123.5, 1)
		expect(second).toEqual(first)
		for (const position of first.values()) {
			expect([position.x, position.y, position.z, position.angle].every(Number.isFinite)).toBe(true)
			expect(Math.abs(position.x - CENTER)).toBeLessThanOrEqual(SIZE)
			expect(Math.abs(position.y - CENTER)).toBeLessThanOrEqual(SIZE)
			expect(Math.abs(position.z)).toBeLessThanOrEqual(SIZE)
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

	it('never sends ring-system records through body or satellite sphere topology', () => {
		const ringRecord = body({
			id: 13,
			name: 'Outer rings',
			slug: 'outer-rings',
			bodyType: 'ring_system',
			parentId: 11,
			semiMajorAxisAu: 0.001,
		})
		const scene = buildScene({
			stars: [soleStar],
			bodies: [outerPlanet, ringRecord],
			scale: 'log',
			selectedId: null,
			follow: false,
		})
		expect(scene.directPositions.map(position => position.body.id)).not.toContain(13)
		expect(scene.satellitePositions.map(position => position.body.id)).not.toContain(13)
		expect(scene.hitTargets.map(target => target.id)).not.toContain('body:13')
	})
})
