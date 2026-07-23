import { describe, it, expect } from 'vitest'
import {
	annotateEffectivePeriods,
	totalStellarMassKg,
	type EffectiveOrbitStar,
	type EffectiveOrbitBody,
} from './effective-orbits.js'

const SUN_MASS = 1.989e30
const EARTH_MASS = 5.972e24

describe('totalStellarMassKg', () => {
	it('sums positive masses and ignores null/zero', () => {
		expect(totalStellarMassKg([{ massKg: 2e30 }, { massKg: 1e30 }, { massKg: null }, { massKg: 0 }])).toBeCloseTo(3e30, -25)
	})

	it('is null when no star has mass', () => {
		expect(totalStellarMassKg([{ massKg: null }, {}])).toBeNull()
	})
})

describe('annotateEffectivePeriods', () => {
	it('derives a planet period from its star mass (Earth ≈ 365 days)', () => {
		const stars: EffectiveOrbitStar[] = [{ id: 7, massKg: SUN_MASS }]
		const bodies: EffectiveOrbitBody[] = [{ id: 1, starId: 7, semiMajorAxisAu: 1, orbitalPeriodDays: null }]
		const { bodies: [earth] } = annotateEffectivePeriods(stars, bodies)
		expect(earth.orbitalPeriodDays).toBeCloseTo(365, 0)
	})

	it('derives a moon period from its parent body mass, not the star', () => {
		const stars: EffectiveOrbitStar[] = [{ id: 7, massKg: SUN_MASS }]
		const bodies: EffectiveOrbitBody[] = [
			{ id: 1, starId: 7, massKg: EARTH_MASS, semiMajorAxisAu: 1 },
			{ id: 2, starId: 7, parentId: 1, semiMajorAxisAu: 0.00257 },
		]
		const { bodies: [, luna] } = annotateEffectivePeriods(stars, bodies)
		expect(luna.orbitalPeriodDays!).toBeGreaterThan(20)
		expect(luna.orbitalPeriodDays!).toBeLessThan(40)
	})

	it('derives a circumbinary body period from the total stellar mass', () => {
		const stars: EffectiveOrbitStar[] = [
			{ id: 7, massKg: SUN_MASS, parentSystemId: 3, relativeSemiMajorAxisAu: 0.2 },
			{ id: 8, massKg: SUN_MASS, parentSystemId: 3, relativeSemiMajorAxisAu: 0.2 },
		]
		const bodies: EffectiveOrbitBody[] = [{ id: 1, parentSystemId: 3, semiMajorAxisAu: 1 }]
		const { bodies: [tatooine] } = annotateEffectivePeriods(stars, bodies)
		// Twice the solar mass shortens the year by 1/√2 ≈ 258 days.
		expect(tatooine.orbitalPeriodDays).toBeCloseTo(365.25 / Math.SQRT2, 0)
	})

	it('derives a binary period from the relative axis, never a component barycentric radius', () => {
		const stars: EffectiveOrbitStar[] = [
			{ id: 7, massKg: SUN_MASS, parentSystemId: 3, relativeSemiMajorAxisAu: 1 },
			{ id: 8, massKg: SUN_MASS, parentSystemId: 3, relativeSemiMajorAxisAu: 1 },
		]
		const { stars: [a, b] } = annotateEffectivePeriods(stars, [])
		expect(a.orbitalPeriodDays).toBeCloseTo(365.25 / Math.SQRT2, 0)
		expect(a.orbitalPeriodDays).toBeCloseTo(b.orbitalPeriodDays!, 6)
	})

	it('derives a companion star period from the combined pair mass', () => {
		const stars: EffectiveOrbitStar[] = [
			{ id: 7, massKg: SUN_MASS },
			{ id: 8, massKg: SUN_MASS, parentStarId: 7, relativeSemiMajorAxisAu: 1 },
		]
		const { stars: [, companion] } = annotateEffectivePeriods(stars, [])
		// Combined 2 M☉ → 365.25/√2, clearly not the 1 M☉ 365-day year.
		expect(companion.orbitalPeriodDays).toBeCloseTo(365.25 / Math.SQRT2, 0)
	})

	it('never overwrites a stored (user-asserted) period', () => {
		const stars: EffectiveOrbitStar[] = [{ id: 7, massKg: SUN_MASS }]
		const bodies: EffectiveOrbitBody[] = [{ id: 1, starId: 7, semiMajorAxisAu: 1, orbitalPeriodDays: 100 }]
		const { bodies: [b] } = annotateEffectivePeriods(stars, bodies)
		expect(b.orbitalPeriodDays).toBe(100)
	})

	it('leaves rows without enough data untouched', () => {
		const stars: EffectiveOrbitStar[] = [{ id: 7, massKg: null }]
		const bodies: EffectiveOrbitBody[] = [
			{ id: 1, starId: 7, semiMajorAxisAu: 1 },
			{ id: 2, starId: null, parentId: null, semiMajorAxisAu: 2 },
		]
		const { bodies: annotated } = annotateEffectivePeriods(stars, bodies)
		expect(annotated[0].orbitalPeriodDays ?? null).toBeNull()
		expect(annotated[1].orbitalPeriodDays ?? null).toBeNull()
	})
})
