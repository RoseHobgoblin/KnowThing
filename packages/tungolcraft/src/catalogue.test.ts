import { describe, expect, it } from 'vitest'
import {
	DIAGNOSTIC_CODES,
	MODEL_IDS,
	NOMINAL_SOLAR_GM,
	SOLAR_LUMINOSITY,
	evaluateBulkDensity,
	evaluateEllipticalState,
	evaluateEscapeVelocity,
	evaluateHillRadius,
	evaluateKeplerPeriod,
	evaluateMeanSpeed,
	evaluateParentBarycenterDistance,
	evaluateRocheLimit,
	evaluateRotationalBreakup,
	evaluateSatelliteStability,
	evaluateSimpleHabitableZone,
	evaluateStefanBoltzmannLuminosity,
	evaluateSurfaceGravity,
	evaluateVisVivaSpeed,
	getModelReference,
	listModelReferences,
	type ModelResult,
} from './index.js'

function expectFiniteJson(value: unknown): void {
	// This intentionally exercises the JSON representation; it is not cloning
	// application state, so structuredClone would test the wrong boundary.
	// eslint-disable-next-line unicorn/prefer-structured-clone
	const parsed: unknown = JSON.parse(JSON.stringify(value))
	const visit = (item: unknown): void => {
		if (typeof item === 'number') {
			expect(Number.isFinite(item)).toBe(true)
			return
		}
		if (Array.isArray(item)) {
			for (const child of item) visit(child)
			return
		}
		if (item && typeof item === 'object') {
			for (const child of Object.values(item)) visit(child)
		}
	}
	visit(parsed)
}

function expectFailure(result: ModelResult<unknown>, code: string): void {
	expect(result.ok).toBe(false)
	if (result.ok) throw new Error('Expected model failure')
	expect(result.diagnostics.some(issue => issue.code === code && issue.severity === 'error')).toBe(true)
	expectFiniteJson(result)
}

describe('scientific model registry', () => {
	it('publishes unique, versioned model references with provenance and validity', () => {
		const references = listModelReferences()
		expect(references).toHaveLength(14)
		expect(references.map(model => model.id)).toEqual(Object.values(MODEL_IDS))
		expect(new Set(references.map(model => model.id)).size).toBe(references.length)
		for (const model of references) {
			expect(model.version).toMatch(/^\d+\.\d+\.\d+$/)
			expect(model.sources.length).toBeGreaterThan(0)
			expect(model.assumptions.length).toBeGreaterThan(0)
			expect(model.validity.length).toBeGreaterThan(0)
		}
	})

	it('returns a stable reference by model ID', () => {
		expect(getModelReference(MODEL_IDS.bulkDensity).id).toBe('body.bulk-density')
		expect(getModelReference(MODEL_IDS.satelliteStability).kind).toBe('empirical-fit')
	})

	it('publishes unique stable diagnostic codes', () => {
		const codes = Object.values(DIAGNOSTIC_CODES)
		expect(new Set(codes).size).toBe(codes.length)
	})
})

describe('evaluateBulkDensity', () => {
	it('returns a unit-bearing, explainable result', () => {
		const result = evaluateBulkDensity({ massKg: 5.972e24, radiusM: 6.371e6 })
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected density success')
		expect(result.output.unit).toBe('kg/m^3')
		expect(result.output.value).toBeCloseTo(5513, 0)
		expect(result.model.id).toBe(MODEL_IDS.bulkDensity)
		expect(result.inputs.massKg).toEqual({ value: 5.972e24, unit: 'kg', source: 'caller' })
		expect(result.uncertainty).toEqual({ kind: 'not-provided' })
		expectFiniteJson(result)
	})

	it('returns structured failures instead of throwing for invalid user input', () => {
		const result = evaluateBulkDensity({ massKg: Number.NaN, radiusM: 0 })
		expectFailure(result, DIAGNOSTIC_CODES.nonFiniteInput)
		expectFailure(result, DIAGNOSTIC_CODES.radiusNonPositive)
		expect(result.inputs.massKg.value).toBe('NaN')
		expectFiniteJson(result)
	})

	it('does not serialize an overflowed calculation as infinity', () => {
		const result = evaluateBulkDensity({ massKg: Number.MAX_VALUE, radiusM: Number.MIN_VALUE })
		expectFailure(result, DIAGNOSTIC_CODES.outputNonFinite)
		expectFiniteJson(result)
	})
})

describe('body relation catalogue models', () => {
	const earth = { massKg: 5.972e24, radiusM: 6.371e6 }

	it('evaluates surface gravity against the Earth reference identity', () => {
		const result = evaluateSurfaceGravity(earth)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected surface-gravity success')
		expect(result.output).toEqual({
			value: expect.closeTo(9.82, 1),
			unit: 'm/s^2',
		})
		expect(result.model.id).toBe(MODEL_IDS.surfaceGravity)
		expectFiniteJson(result)
	})

	it('rejects a non-positive mass for surface gravity', () => {
		expectFailure(
			evaluateSurfaceGravity({ ...earth, massKg: 0 }),
			DIAGNOSTIC_CODES.massNonPositive,
		)
	})

	it('evaluates escape velocity against the Earth reference identity', () => {
		const result = evaluateEscapeVelocity(earth)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected escape-velocity success')
		expect(result.output.value / 1000).toBeCloseTo(11.19, 1)
		expect(result.output.unit).toBe('m/s')
		expect(result.model.id).toBe(MODEL_IDS.escapeVelocity)
		expectFiniteJson(result)
	})

	it('rejects a non-finite radius for escape velocity', () => {
		expectFailure(
			evaluateEscapeVelocity({ ...earth, radiusM: Number.NaN }),
			DIAGNOSTIC_CODES.nonFiniteInput,
		)
	})

	it('evaluates and identifies the gravity-only rotational-breakup screen', () => {
		const result = evaluateRotationalBreakup({ densityKgM3: 5514 })
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected rotational-breakup success')
		expect(result.output.value / 3600).toBeCloseTo(1.41, 1)
		expect(result.output.unit).toBe('s')
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.rotationalBreakupScreening,
			category: 'approximation',
		}))
		expectFiniteJson(result)
	})

	it('rejects zero density for rotational breakup', () => {
		expectFailure(
			evaluateRotationalBreakup({ densityKgM3: 0 }),
			DIAGNOSTIC_CODES.densityNonPositive,
		)
	})
})

describe('orbital relation catalogue models', () => {
	it('evaluates the one-AU nominal-solar Kepler period', () => {
		const result = evaluateKeplerPeriod({
			semiMajorAxisAu: 1,
			muM3S2: NOMINAL_SOLAR_GM,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected Kepler-period success')
		expect(result.output.value).toBeCloseTo(365.25, 0)
		expect(result.output.unit).toBe('d')
		expectFiniteJson(result)
	})

	it('rejects a zero gravitational parameter for the Kepler period', () => {
		expectFailure(evaluateKeplerPeriod({
			semiMajorAxisAu: 1,
			muM3S2: 0,
		}), DIAGNOSTIC_CODES.orbitMuInvalid)
	})

	it('reduces vis-viva to circular speed when radius equals semi-major axis', () => {
		const result = evaluateVisVivaSpeed({
			muM3S2: NOMINAL_SOLAR_GM,
			radiusAu: 1,
			semiMajorAxisAu: 1,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected vis-viva success')
		expect(result.output.value / 1000).toBeCloseTo(29.78, 1)
		expect(result.output.unit).toBe('m/s')
		expectFiniteJson(result)
	})

	it('reports radii beyond the real vis-viva domain as outside-domain', () => {
		const result = evaluateVisVivaSpeed({
			muM3S2: NOMINAL_SOLAR_GM,
			radiusAu: 2.01,
			semiMajorAxisAu: 1,
		})
		expectFailure(result, DIAGNOSTIC_CODES.visVivaOutsideDomain)
		if (result.ok) throw new Error('Expected vis-viva failure')
		expect(result.diagnostics[0]?.category).toBe('outside-domain')
	})

	it('evaluates circular mean speed and records the eccentricity default', () => {
		const result = evaluateMeanSpeed({
			semiMajorAxisAu: 1,
			orbitalPeriodDays: 365.25,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected mean-speed success')
		expect(result.output.value / 1000).toBeCloseTo(29.78, 1)
		expect(result.inputs.eccentricity).toEqual({ value: 0, unit: '1', source: 'default' })
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.meanSpeedApproximation,
			category: 'approximation',
		}))
		expectFiniteJson(result)
	})

	it('rejects the parabolic eccentricity boundary for mean speed', () => {
		expectFailure(evaluateMeanSpeed({
			semiMajorAxisAu: 1,
			orbitalPeriodDays: 365.25,
			eccentricity: 1,
		}), DIAGNOSTIC_CODES.orbitEccentricityOutOfRange)
	})

	it('applies the periapsis eccentricity factor to the Hill radius', () => {
		const circular = evaluateHillRadius({
			semiMajorAxisAu: 1,
			bodyMassKg: 5.972e24,
			parentMassKg: 1.989e30,
		})
		const eccentric = evaluateHillRadius({
			semiMajorAxisAu: 1,
			bodyMassKg: 5.972e24,
			parentMassKg: 1.989e30,
			eccentricity: 0.25,
		})
		expect(circular.ok).toBe(true)
		expect(eccentric.ok).toBe(true)
		if (!circular.ok || !eccentric.ok) throw new Error('Expected Hill-radius success')
		expect(eccentric.output.value).toBeCloseTo(circular.output.value * 0.75, 12)
		expect(circular.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.hillRadiusApproximation,
		}))
		expectFiniteJson(circular)
		expectFiniteJson(eccentric)
	})

	it('rejects zero parent mass for the Hill radius', () => {
		expectFailure(evaluateHillRadius({
			semiMajorAxisAu: 1,
			bodyMassKg: 5.972e24,
			parentMassKg: 0,
		}), DIAGNOSTIC_CODES.parentMassNonPositive)
	})
})

describe('binary, satellite and stellar catalogue models', () => {
	it('places an equal-mass barycenter halfway along the separation', () => {
		const result = evaluateParentBarycenterDistance({
			separationAu: 1,
			parentMassKg: 1e25,
			companionMassKg: 1e25,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected barycenter success')
		expect(result.output.value).toBeCloseTo(1.495_978_707e11 / 2, 3)
		expect(result.output.unit).toBe('m')
		expectFiniteJson(result)
	})

	it('rejects zero companion mass for barycenter geometry', () => {
		expectFailure(evaluateParentBarycenterDistance({
			separationAu: 1,
			parentMassKg: 1e25,
			companionMassKg: 0,
		}), DIAGNOSTIC_CODES.companionMassNonPositive)
	})

	it('evaluates the equal-density rigid Roche identity and records its default', () => {
		const result = evaluateRocheLimit({
			parentRadiusM: 1e7,
			parentDensityKgM3: 5000,
			satelliteDensityKgM3: 5000,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected Roche-limit success')
		expect(result.output.value).toBeCloseTo(Math.cbrt(2) * 1e7, 6)
		expect(result.inputs.rigidity).toEqual({ value: 'rigid', source: 'default' })
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.rocheLimitScreening,
		}))
		expectFiniteJson(result)
	})

	it('rejects an unknown Roche rigidity at the runtime boundary', () => {
		expectFailure(evaluateRocheLimit({
			parentRadiusM: 1e7,
			parentDensityKgM3: 5000,
			satelliteDensityKgM3: 5000,
			rigidity: 'gas' as never,
		}), DIAGNOSTIC_CODES.rigidityInvalid)
	})

	it('evaluates the Sun-like Stefan–Boltzmann luminosity', () => {
		const result = evaluateStefanBoltzmannLuminosity({
			radiusM: 6.9634e8,
			temperatureK: 5778,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected luminosity success')
		expect(result.output.value / SOLAR_LUMINOSITY).toBeCloseTo(1, 1)
		expect(result.output.unit).toBe('W')
		expectFiniteJson(result)
	})

	it('rejects absolute zero for Stefan–Boltzmann luminosity', () => {
		expectFailure(evaluateStefanBoltzmannLuminosity({
			radiusM: 6.9634e8,
			temperatureK: 0,
		}), DIAGNOSTIC_CODES.temperatureNonPositive)
	})

	it('evaluates and discloses the solar-luminosity simple habitable zone', () => {
		const result = evaluateSimpleHabitableZone({ luminosityW: SOLAR_LUMINOSITY })
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected habitable-zone success')
		expect(result.output.inner).toEqual({
			value: expect.closeTo(Math.sqrt(1 / 1.1), 12),
			unit: 'AU',
		})
		expect(result.output.outer).toEqual({
			value: expect.closeTo(Math.sqrt(1 / 0.53), 12),
			unit: 'AU',
		})
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.habitableZoneApproximation,
		}))
		expectFiniteJson(result)
	})

	it('rejects zero luminosity for the simple habitable zone', () => {
		expectFailure(
			evaluateSimpleHabitableZone({ luminosityW: 0 }),
			DIAGNOSTIC_CODES.luminosityNonPositive,
		)
	})
})

describe('evaluateEllipticalState', () => {
	const orbit = {
		semiMajorAxisAu: 1,
		eccentricity: 0.9999,
		inclinationDeg: 7,
		longitudeAscendingNodeDeg: 20,
		argumentOfPeriapsisDeg: 45,
		epochPhase: 0,
		muM3S2: NOMINAL_SOLAR_GM,
		absoluteDay: 0.001,
	}

	it('reports frame, mixed output units, defaults and solver quality', () => {
		const result = evaluateEllipticalState(orbit)
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected orbit success')
		expect(result.output.position.unit).toBe('m')
		expect(result.output.velocity.unit).toBe('m/s')
		expect(result.output.frameId).toBe('parent-inertial')
		expect(result.inputs.frameId.source).toBe('default')
		expect(result.numerical?.method).toBe('safeguarded-newton-bisection')
		expect(result.numerical?.converged).toBe(true)
		expect(result.numerical?.residual).toBeLessThanOrEqual(result.numerical?.tolerance ?? 0)
		expectFiniteJson(result)
	})

	it('is deterministic and preserves a caller-supplied frame ID', () => {
		const input = { ...orbit, frameId: 'invented-system/ecliptic' }
		const first = evaluateEllipticalState(input)
		const second = evaluateEllipticalState(input)
		expect(first).toEqual(second)
		expect(first.inputs.frameId.source).toBe('caller')
	})

	it('returns all domain failures without invoking the propagator', () => {
		const result = evaluateEllipticalState({
			...orbit,
			semiMajorAxisAu: -1,
			eccentricity: 1,
			muM3S2: 0,
			frameId: '',
		})
		expectFailure(result, DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid)
		expectFailure(result, DIAGNOSTIC_CODES.orbitEccentricityOutOfRange)
		expectFailure(result, DIAGNOSTIC_CODES.orbitMuInvalid)
		expectFailure(result, DIAGNOSTIC_CODES.orbitFrameInvalid)
	})
})

describe('evaluateSatelliteStability', () => {
	it('reports provenance, applied defaults and empirical-fit status', () => {
		const result = evaluateSatelliteStability({ hillRadiusAu: 0.01 })
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected stability success')
		expect(result.output.limit).toEqual({ value: 0.004895, unit: 'AU' })
		expect(result.output.hillFraction).toEqual({ value: 0.4895, unit: '1' })
		expect(result.inputs.parentEccentricity.source).toBe('default')
		expect(result.inputs.satelliteEccentricity.source).toBe('default')
		expect(result.inputs.orbitSense.source).toBe('default')
		expect(result.model.sources[0]?.doi).toBe('10.1111/j.1365-2966.2006.11104.x')
		expect(result.diagnostics.some(issue =>
			issue.code === DIAGNOSTIC_CODES.stabilityEmpiricalFit
			&& issue.category === 'approximation')).toBe(true)
		expectFiniteJson(result)
	})

	it('returns invalid eccentricity as a structured failure', () => {
		const result = evaluateSatelliteStability({
			hillRadiusAu: 0.01,
			parentEccentricity: 1,
		})
		expectFailure(result, DIAGNOSTIC_CODES.parentEccentricityOutOfRange)
	})

	it('distinguishes valid inputs outside the empirical fit from invalid input', () => {
		const result = evaluateSatelliteStability({
			hillRadiusAu: 0.01,
			parentEccentricity: 0.95,
			satelliteEccentricity: 0.95,
		})
		expectFailure(result, DIAGNOSTIC_CODES.stabilityOutsideDomain)
		if (result.ok) throw new Error('Expected stability failure')
		expect(result.diagnostics[0]?.category).toBe('outside-domain')
	})
})
