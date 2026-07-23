import { describe, expect, it } from 'vitest'
import {
	DIAGNOSTIC_CODES,
	MODEL_IDS,
	NOMINAL_SOLAR_GM,
	evaluateBulkDensity,
	evaluateEllipticalState,
	evaluateSatelliteStability,
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
}

describe('scientific model registry', () => {
	it('publishes unique, versioned model references with provenance and validity', () => {
		const references = listModelReferences()
		expect(references).toHaveLength(3)
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
