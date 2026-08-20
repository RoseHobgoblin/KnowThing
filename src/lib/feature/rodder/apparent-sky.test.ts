import { describe, expect, it } from 'vitest'
import {
	apparentMagnitudeFromAbsolute,
	apparentSkyDirectionForRenderer,
	buildApparentSky,
	distanceToParsecs,
	NAKED_EYE_MAGNITUDE_LIMIT,
	resolveApparentSkyVisual,
	type ApparentSkyMemberInput,
	type ApparentSkyObserver,
	type ApparentSkyRootInput,
} from './apparent-sky.js'

const observer: ApparentSkyObserver = {
	rootId: 1,
	sectorId: 7,
	sectorName: 'Reach',
	sectorSlug: 'reach',
	units: 'ly',
	handedness: 'right-handed',
	referenceEpoch: 'Static epoch',
	x: 2,
	y: -1,
	z: 3,
}

function star(overrides: Partial<ApparentSkyMemberInput> = {}): ApparentSkyMemberInput {
	return {
		id: 20,
		name: 'Aster',
		slug: 'aster',
		spectralType: 'G2V',
		temperatureK: 5_772,
		luminosityW: 3.828e26,
		radiusM: null,
		absoluteMagnitude: null,
		...overrides,
	}
}

function root(overrides: Partial<ApparentSkyRootInput> = {}): ApparentSkyRootInput {
	return {
		rootId: 2,
		rootName: 'Elsewhere',
		rootSlug: 'elsewhere',
		rootKind: 'system',
		x: 5,
		y: 3,
		z: 3,
		positionProvenance: 'authored',
		positionUncertainty: 0.01,
		stars: [star()],
		...overrides,
	}
}

describe('apparent sky', () => {
	it('converts units and applies the distance modulus', () => {
		expect(distanceToParsecs(3.26156, 'ly')).toBeCloseTo(1)
		expect(distanceToParsecs(10, 'pc')).toBe(10)
		expect(apparentMagnitudeFromAbsolute(4.83, 10)).toBeCloseTo(4.83)
	})

	it('computes direction from the observer offset rather than the frame origin', () => {
		const result = buildApparentSky(observer, [root()])
		expect(result.status).toBe('available')
		expect(result.sources[0].direction).toEqual([0.6, 0.8, 0])
		expect(result.sources[0].distance).toBe(5)
	})

	it('keeps canonical directions separate from the renderer handedness transform', () => {
		expect(apparentSkyDirectionForRenderer([0.2, 0.8, -0.4], 'right-handed')).toEqual([0.2, 0.8, -0.4])
		expect(apparentSkyDirectionForRenderer([0.2, 0.8, -0.4], 'left-handed')).toEqual([0.2, -0.8, -0.4])
	})

	it('uses a strict numeric absolute magnitude before luminosity', () => {
		const result = buildApparentSky(observer, [root({ stars: [star({ absoluteMagnitude: '4.83', luminosityW: 1e40 })] })])
		expect(result.sources[0].stars[0].brightnessSource).toBe('absolute-magnitude')
		expect(result.sources[0].stars[0].apparentMagnitude).toBeCloseTo(
			apparentMagnitudeFromAbsolute(4.83, result.sources[0].distancePc),
		)
	})

	it('derives luminosity only from physical radius and temperature inputs', () => {
		const result = buildApparentSky(observer, [root({ stars: [star({ luminosityW: null, radiusM: 6.957e8 })] })])
		expect(result.sources[0].stars[0].brightnessSource).toBe('derived-luminosity')
		expect(result.sources[0].apparentMagnitude).not.toBeNull()
	})

	it('keeps an unresolved multiple at one direction and combines only known flux', () => {
		const known = star({ id: 20, absoluteMagnitude: '4', luminosityW: null })
		const missing = star({ id: 21, name: 'Companion', slug: 'companion', absoluteMagnitude: 'not numeric', luminosityW: null, radiusM: null, temperatureK: null })
		const completeSingle = buildApparentSky(observer, [root({ stars: [known] })]).sources[0]
		const unresolved = buildApparentSky(observer, [root({ stars: [known, missing] })]).sources[0]
		expect(unresolved.stars).toHaveLength(2)
		expect(unresolved.direction).toEqual(completeSingle.direction)
		expect(unresolved.apparentMagnitude).toBeCloseTo(completeSingle.apparentMagnitude!)
		expect(unresolved.brightnessStatus).toBe('incomplete')
	})

	it('aggregates member flux and weights colour without inventing angular separation', () => {
		const first = star({ id: 20, absoluteMagnitude: '4', luminosityW: null, temperatureK: 3_000 })
		const second = star({ id: 21, name: 'Blue companion', slug: 'blue-companion', absoluteMagnitude: '4', luminosityW: null, temperatureK: 10_000 })
		const single = buildApparentSky(observer, [root({ stars: [first] })]).sources[0]
		const pair = buildApparentSky(observer, [root({ stars: [first, second] })]).sources[0]
		expect(pair.apparentMagnitude).toBeCloseTo(single.apparentMagnitude! - 2.5 * Math.log10(2))
		expect(pair.direction).toEqual(single.direction)
		expect(pair.displayColor).not.toBe(single.displayColor)
		expect(pair.displayColor).not.toBe(
			buildApparentSky(observer, [root({ stars: [second] })]).sources[0].displayColor,
		)
	})

	it('omits roots that cannot define a truthful direction', () => {
		const result = buildApparentSky(observer, [
			root({ rootId: 1 }),
			root({ rootId: 2, stars: [] }),
			root({ rootId: 3, x: null }),
			root({ rootId: 4, x: observer.x, y: observer.y, z: observer.z }),
		])
		expect(result.sources).toHaveLength(0)
		expect(result.diagnostics).toMatchObject({ observerRoot: 1, starlessRoots: 1, unpositionedRoots: 1, coincidentRoots: 1 })
	})

	it('reports roots in incompatible sectors without attempting to project them', () => {
		const result = buildApparentSky(observer, [root()], { incompatibleSectorRoots: 4 })
		expect(result.sources).toHaveLength(1)
		expect(result.diagnostics.incompatibleSectorRoots).toBe(4)
	})

	it('reports an unavailable observer position locally', () => {
		const result = buildApparentSky({ ...observer, z: null }, [root()])
		expect(result.status).toBe('unavailable')
		expect(result.sources).toEqual([])
		expect(result.reason).toContain('observer root')
	})

	it('uses visibility modes without presenting unknown brightness as physical', () => {
		const unavailable = buildApparentSky(observer, [root({ stars: [star({ luminosityW: null, radiusM: null, temperatureK: null, spectralType: null })] })]).sources[0]
		expect(resolveApparentSkyVisual(unavailable, 'physical').visible).toBe(false)
		expect(resolveApparentSkyVisual(unavailable, 'enhanced').visible).toBe(true)
		expect(resolveApparentSkyVisual(unavailable, 'markers').sizePx).toBeGreaterThan(
			resolveApparentSkyVisual(unavailable, 'enhanced').sizePx,
		)

		const tooDim = { ...unavailable, apparentMagnitude: NAKED_EYE_MAGNITUDE_LIMIT + 0.1, brightnessStatus: 'complete' as const }
		expect(resolveApparentSkyVisual(tooDim, 'physical').visible).toBe(false)
		expect(resolveApparentSkyVisual(tooDim, 'enhanced').visible).toBe(true)

		const extremelyBright = { ...unavailable, apparentMagnitude: -100, brightnessStatus: 'complete' as const }
		const brightVisual = resolveApparentSkyVisual(extremelyBright, 'enhanced')
		expect(brightVisual.sizePx).toBeLessThanOrEqual(12)
		expect(brightVisual.opacity).toBeLessThanOrEqual(1)
	})
})
