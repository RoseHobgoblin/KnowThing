import { describe, expect, it } from 'vitest'
import {
	CATALOGUE_RUNNER_DIAGNOSTIC_CODES,
	SCENARIO_LIMITS,
	UNCERTAINTY_DIAGNOSTIC_CODES,
	propagateCatalogueUncertainty,
	type InputRecord,
	type ModelResult,
} from './index.js'

function densityInputs(
	massUncertainty?: InputRecord['uncertainty'],
	radiusUncertainty?: InputRecord['uncertainty'],
): Record<string, InputRecord> {
	return {
		massKg: {
			value: 6e24,
			unit: 'kg',
			source: 'caller',
			...(massUncertainty == null ? {} : { uncertainty: massUncertainty }),
		},
		radiusM: {
			value: 6.4e6,
			unit: 'm',
			source: 'caller',
			...(radiusUncertainty == null ? {} : { uncertainty: radiusUncertainty }),
		},
	}
}

function expectSuccess(result: ModelResult<unknown>) {
	expect(result.ok).toBe(true)
	if (!result.ok) throw new Error('Expected successful propagation')
	return result
}

function expectFailure(result: ModelResult<unknown>, code: string) {
	expect(result.ok).toBe(false)
	if (result.ok) throw new Error('Expected failed propagation')
	expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }))
	return result
}

function sphereDensity(mass: number, radius: number): number {
	return mass / ((4 / 3) * Math.PI * radius ** 3)
}

describe('catalogue uncertainty propagation', () => {
	it('honestly preserves not-provided when no input uncertainty exists', () => {
		const result = expectSuccess(propagateCatalogueUncertainty({
			modelId: 'body.bulk-density',
			inputs: densityInputs(),
		}, { method: 'first-order' }))
		expect(result.uncertainty).toEqual({ kind: 'not-provided' })
	})

	it('matches the analytic first-order density relation', () => {
		const massSigma = 3e22
		const radiusSigma = 8e3
		const result = expectSuccess(propagateCatalogueUncertainty({
			modelId: 'body.bulk-density',
			inputs: densityInputs(
				{ kind: 'standard-deviation', value: massSigma, unit: 'kg' },
				{ kind: 'standard-deviation', value: radiusSigma, unit: 'm' },
			),
		}, {
			method: 'first-order',
			assumeIndependent: true,
		}))
		expect(result.uncertainty).toMatchObject({
			kind: 'propagated',
			method: 'first-order',
			dependence: 'independent',
			evaluations: 5,
			value: { kind: 'standard-deviation', unit: 'kg/m^3' },
		})
		if (result.uncertainty.kind !== 'propagated') throw new Error('Expected propagation')
		if (result.uncertainty.method !== 'first-order') throw new Error('Expected first order')
		const density = (result.output as { value: number }).value
		const expected = density * Math.hypot(
			massSigma / 6e24,
			3 * radiusSigma / 6.4e6,
		)
		expect(result.uncertainty.value.value).toBeCloseTo(expected, 7)
		expect(result.inputs.massKg?.uncertainty).toEqual({
			kind: 'standard-deviation',
			value: massSigma,
			unit: 'kg',
		})
	})

	it('does not silently assume independent inputs', () => {
		const result = propagateCatalogueUncertainty({
			modelId: 'body.bulk-density',
			inputs: densityInputs(
				{ kind: 'standard-deviation', value: 1e22, unit: 'kg' },
				{ kind: 'standard-deviation', value: 1e3, unit: 'm' },
			),
		}, { method: 'first-order' })
		expectFailure(result, UNCERTAINTY_DIAGNOSTIC_CODES.dependenceRequired)
	})

	it('finds conservative interval corners for a monotonic relation', () => {
		const result = expectSuccess(propagateCatalogueUncertainty({
			modelId: 'body.bulk-density',
			inputs: densityInputs(
				{ kind: 'interval', lower: 5.9e24, upper: 6.1e24, unit: 'kg' },
				{ kind: 'interval', lower: 6.3e6, upper: 6.5e6, unit: 'm' },
			),
		}, { method: 'interval' }))
		if (result.uncertainty.kind !== 'propagated') throw new Error('Expected propagation')
		if (result.uncertainty.method !== 'interval') throw new Error('Expected interval')
		expect(result.uncertainty.value.lower).toBeCloseTo(sphereDensity(5.9e24, 6.5e6), 10)
		expect(result.uncertainty.value.upper).toBeCloseTo(sphereDensity(6.1e24, 6.3e6), 10)
		expect(result.uncertainty).toMatchObject({
			dependence: 'bounds-only',
			evaluations: 5,
		})
	})

	it('propagates a selected scalar path from a composite output', () => {
		const result = expectSuccess(propagateCatalogueUncertainty({
			modelId: 'star.simple-habitable-zone',
			outputPath: 'inner',
			inputs: {
				luminosityW: {
					value: 3.828e26,
					unit: 'W',
					source: 'caller',
					uncertainty: {
						kind: 'interval',
						lower: 3.7e26,
						upper: 3.9e26,
						unit: 'W',
					},
				},
			},
		}, { method: 'interval' }))
		expect(result.uncertainty).toMatchObject({
			kind: 'propagated',
			method: 'interval',
			outputPath: 'inner',
			value: { kind: 'interval', unit: 'AU' },
		})
	})

	it('produces deterministic seeded Monte Carlo samples and finite JSON', () => {
		const request = {
			modelId: 'body.rotational-breakup' as const,
			inputs: {
				densityKgM3: {
					value: 5_500,
					unit: 'kg/m^3' as const,
					source: 'caller' as const,
					uncertainty: {
						kind: 'standard-deviation' as const,
						value: 50,
						unit: 'kg/m^3' as const,
					},
				},
			},
		}
		const options = {
			method: 'monte-carlo' as const,
			seed: 42,
			sampleCount: 128,
			samplingPolicy: 'normal' as const,
		}
		const first = expectSuccess(propagateCatalogueUncertainty(request, options))
		const second = expectSuccess(propagateCatalogueUncertainty(request, options))
		expect(first.uncertainty).toEqual(second.uncertainty)
		expect(first.uncertainty).toMatchObject({
			kind: 'propagated',
			method: 'monte-carlo',
			seed: 42,
			sampleCount: 128,
			samplingPolicy: 'normal',
			dependence: 'single-input',
			evaluations: 129,
			value: { kind: 'samples', unit: 's' },
		})
		expect(JSON.stringify(first)).not.toMatch(/NaN|Infinity/)
	})

	it('rejects incompatible methods, units and resource excess', () => {
		expectFailure(propagateCatalogueUncertainty({
			modelId: 'body.rotational-breakup',
			inputs: {
				densityKgM3: {
					value: 5_500,
					unit: 'kg/m^3',
					source: 'caller',
					uncertainty: { kind: 'interval', lower: 5_400, upper: 5_600, unit: 'kg/m^3' },
				},
			},
		}, {
			method: 'monte-carlo',
			seed: 1,
			sampleCount: 10,
			samplingPolicy: 'normal',
		}), UNCERTAINTY_DIAGNOSTIC_CODES.methodIncompatible)

		const wrongUnit = densityInputs({
			kind: 'standard-deviation',
			value: 1,
			unit: 'm',
		})
		expectFailure(propagateCatalogueUncertainty({
			modelId: 'body.bulk-density',
			inputs: wrongUnit,
		}, { method: 'first-order' }), UNCERTAINTY_DIAGNOSTIC_CODES.unitMismatch)

		expectFailure(propagateCatalogueUncertainty({
			modelId: 'body.rotational-breakup',
			inputs: {
				densityKgM3: {
					value: 5_500,
					unit: 'kg/m^3',
					source: 'caller',
					uncertainty: { kind: 'standard-deviation', value: 50, unit: 'kg/m^3' },
				},
			},
		}, {
			method: 'monte-carlo',
			seed: 1,
			sampleCount: SCENARIO_LIMITS.maxMonteCarloSamples + 1,
			samplingPolicy: 'normal',
		}), UNCERTAINTY_DIAGNOSTIC_CODES.resourceLimit)
	})

	it('returns structured failures for unknown models and malformed output paths', () => {
		expectFailure(propagateCatalogueUncertainty({
			modelId: 'not.registered' as never,
			inputs: {},
		}, { method: 'interval' }), CATALOGUE_RUNNER_DIAGNOSTIC_CODES.modelUnknown)

		expectFailure(propagateCatalogueUncertainty({
			modelId: 'star.simple-habitable-zone',
			outputPath: 'inner..value',
			inputs: {
				luminosityW: {
					value: 3.828e26,
					unit: 'W',
					source: 'caller',
					uncertainty: {
						kind: 'interval',
						lower: 3.7e26,
						upper: 3.9e26,
						unit: 'W',
					},
				},
			},
		}, { method: 'interval' }), UNCERTAINTY_DIAGNOSTIC_CODES.outputInvalid)
	})
})
