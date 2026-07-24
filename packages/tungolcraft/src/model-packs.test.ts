import { describe, expect, it } from 'vitest'
import {
	DIAGNOSTIC_CODES,
	EARTH_MASS_KG,
	EARTH_RADIUS_M,
	MODEL_IDS,
	SOLAR_LUMINOSITY,
	SOLAR_MASS_KG,
	computeBlackbodyEquilibriumTemperatureK,
	computeConstantQEccentricityDampingTimeS,
	computeKopparapu2014ConservativeHabitableZone,
	computeStellarIrradianceWm2,
	estimateEker2018MainSequence,
	estimateZeng2016RockyRadius,
	evaluateBlackbodyEquilibriumTemperature,
	evaluateConstantQEccentricityDamping,
	evaluateEkerMainSequenceScreen,
	evaluateKopparapuConservativeHabitableZone,
	evaluateStellarIrradiance,
	evaluateZengRockyRadius,
	getModelPack,
	listModelPacks,
	propagateCatalogueUncertainty,
	type ModelResult,
} from './index.js'

function expectFailure(result: ModelResult<unknown>, code: string): void {
	expect(result.ok).toBe(false)
	if (result.ok) throw new Error('Expected failure')
	expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }))
}

function expectFiniteJson(value: unknown): void {
	const json = JSON.stringify(value)
	expect(json).not.toMatch(/NaN|Infinity/)
	expect(() => JSON.parse(json)).not.toThrow()
}

describe('named model packs', () => {
	it('publishes five independently versioned packs containing every Milestone E model', () => {
		const packs = listModelPacks()
		expect(packs).toHaveLength(5)
		expect(new Set(packs.map(pack => pack.id)).size).toBe(packs.length)
		expect(getModelPack('rocky-interiors')?.version).toBe('1.0.0')
		const packedModels = new Set(packs.flatMap(pack => pack.modelIds))
		for (const modelId of [
			MODEL_IDS.ekerMainSequenceScreen,
			MODEL_IDS.stellarIrradiance,
			MODEL_IDS.blackbodyEquilibriumTemperature,
			MODEL_IDS.kopparapuConservativeHabitableZone,
			MODEL_IDS.constantQEccentricityDamping,
			MODEL_IDS.zengRockyRadius,
		]) {
			expect(packedModels.has(modelId)).toBe(true)
		}
	})

	it('keeps the public low-level relations strict outside catalogue use', () => {
		expect(() => computeStellarIrradianceWm2(SOLAR_LUMINOSITY, 0)).toThrow(RangeError)
		expect(() => computeBlackbodyEquilibriumTemperatureK(
			SOLAR_LUMINOSITY,
			1,
			1,
		)).toThrow(RangeError)
		expect(() => estimateZeng2016RockyRadius(0.5 * EARTH_MASS_KG, 0.3)).toThrow(RangeError)
	})
})

describe('stellar screening and planetary energy balance', () => {
	it('uses the Eker low-mass branch at one solar-mass reference unit', () => {
		const expectedSolar = 10 ** -0.007
		const expectedW = expectedSolar * SOLAR_LUMINOSITY
		const estimate = estimateEker2018MainSequence(SOLAR_MASS_KG, expectedW)
		expect(estimate.massDomain).toBe('low')
		expect(estimate.expectedLuminositySolar).toBeCloseTo(expectedSolar, 14)
		expect(estimate.logLuminosityResidualDex).toBeCloseTo(0, 14)
		expect(estimate.withinOneSigma).toBe(true)

		const result = evaluateEkerMainSequenceScreen({
			massKg: SOLAR_MASS_KG,
			luminosityW: expectedW,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected main-sequence screen')
		expect(result.output.expectedLuminosity.unit).toBe('W')
		expect(result.output.intrinsicScatterDex.value).toBe(0.129)
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.mainSequenceEmpiricalFit,
		}))
		expectFiniteJson(result)
	})

	it('warns on luminosity outliers and rejects masses outside the sample', () => {
		const outlier = evaluateEkerMainSequenceScreen({
			massKg: SOLAR_MASS_KG,
			luminosityW: 10 * SOLAR_LUMINOSITY,
		})
		expect(outlier.ok).toBe(true)
		if (!outlier.ok) throw new Error('Expected screen output')
		expect(outlier.output.withinOneSigma).toBe(false)
		expect(outlier.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.mainSequenceLuminosityOutlier,
			severity: 'warning',
		}))
		expectFailure(evaluateEkerMainSequenceScreen({
			massKg: 0.1 * SOLAR_MASS_KG,
			luminosityW: 1e24,
		}), DIAGNOSTIC_CODES.mainSequenceMassOutsideDomain)
	})

	it('computes solar irradiance and globally redistributed equilibrium temperature', () => {
		const irradiance = computeStellarIrradianceWm2(SOLAR_LUMINOSITY, 1)
		expect(irradiance).toBeCloseTo(1361, 0)
		const irradianceResult = evaluateStellarIrradiance({
			luminosityW: SOLAR_LUMINOSITY,
			distanceAu: 1,
		})
		expect(irradianceResult.ok).toBe(true)
		if (!irradianceResult.ok) throw new Error('Expected irradiance')
		expect(irradianceResult.output).toEqual({
			value: expect.closeTo(irradiance, 12),
			unit: 'W/m^2',
		})
		expectFiniteJson(irradianceResult)

		const temperature = computeBlackbodyEquilibriumTemperatureK(
			SOLAR_LUMINOSITY,
			1,
			0.3,
		)
		expect(temperature).toBeCloseTo(255, 0)
		const temperatureResult = evaluateBlackbodyEquilibriumTemperature({
			luminosityW: SOLAR_LUMINOSITY,
			distanceAu: 1,
			bondAlbedo: 0.3,
		})
		expect(temperatureResult.ok).toBe(true)
		if (!temperatureResult.ok) throw new Error('Expected equilibrium temperature')
		expect(temperatureResult.output.value).toBeCloseTo(temperature, 12)
		expect(temperatureResult.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.equilibriumTemperatureScreening,
		}))
		expectFiniteJson(temperatureResult)
	})

	it('rejects a nonphysical Bond albedo', () => {
		expectFailure(evaluateBlackbodyEquilibriumTemperature({
			luminosityW: SOLAR_LUMINOSITY,
			distanceAu: 1,
			bondAlbedo: 1,
		}), DIAGNOSTIC_CODES.bondAlbedoOutOfRange)
	})

	it('inherits interval uncertainty propagation through the catalogue boundary', () => {
		const result = propagateCatalogueUncertainty({
			modelId: 'orbit.stellar-irradiance',
			inputs: {
				luminosityW: {
					value: SOLAR_LUMINOSITY,
					unit: 'W',
					source: 'caller',
				},
				distanceAu: {
					value: 1,
					unit: 'AU',
					source: 'caller',
					uncertainty: {
						kind: 'interval',
						lower: 0.9,
						upper: 1.1,
						unit: 'AU',
					},
				},
			},
		}, { method: 'interval' })
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected propagated irradiance')
		expect(result.uncertainty).toMatchObject({
			kind: 'propagated',
			method: 'interval',
			value: { kind: 'interval', unit: 'W/m^2' },
		})
	})
})

describe('published climate, tide and interior prescriptions', () => {
	it('reproduces the solar Kopparapu one-Earth-mass coefficients', () => {
		const zone = computeKopparapu2014ConservativeHabitableZone(
			SOLAR_LUMINOSITY,
			5780,
			'1-earth',
		)
		expect(zone.innerEffectiveFlux).toBe(1.107)
		expect(zone.outerEffectiveFlux).toBe(0.356)
		expect(zone.innerAu).toBeCloseTo(Math.sqrt(1 / 1.107), 14)
		expect(zone.outerAu).toBeCloseTo(Math.sqrt(1 / 0.356), 14)

		const result = evaluateKopparapuConservativeHabitableZone({
			luminosityW: SOLAR_LUMINOSITY,
			effectiveTemperatureK: 5780,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected Kopparapu zone')
		expect(result.inputs.planetMassClass.source).toBe('default')
		expect(result.output.planetMassClass).toBe('1-earth')
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: DIAGNOSTIC_CODES.kopparapuClimateApproximation,
		}))
		expectFiniteJson(result)
	})

	it('enforces the published Kopparapu temperature and mass-class domain', () => {
		expectFailure(evaluateKopparapuConservativeHabitableZone({
			luminosityW: SOLAR_LUMINOSITY,
			effectiveTemperatureK: 2500,
		}), DIAGNOSTIC_CODES.kopparapuTemperatureOutsideDomain)
		expectFailure(evaluateKopparapuConservativeHabitableZone({
			luminosityW: SOLAR_LUMINOSITY,
			effectiveTemperatureK: 5780,
			planetMassClass: '2-earth' as never,
		}), DIAGNOSTIC_CODES.kopparapuMassClassInvalid)
	})

	it('exposes the constant-Q tidal scaling and its assumptions', () => {
		const arguments_ = [0.01, EARTH_RADIUS_M, EARTH_MASS_KG, SOLAR_MASS_KG, 100, 0.3] as const
		const time = computeConstantQEccentricityDampingTimeS(...arguments_)
		const doubledQ = computeConstantQEccentricityDampingTimeS(
			...arguments_.slice(0, 4),
			200,
			0.3,
		)
		expect(doubledQ).toBeCloseTo(2 * time, 10)
		const result = evaluateConstantQEccentricityDamping({
			semiMajorAxisAu: arguments_[0],
			satelliteRadiusM: arguments_[1],
			satelliteMassKg: arguments_[2],
			parentMassKg: arguments_[3],
			tidalQualityFactor: arguments_[4],
			loveNumberK2: arguments_[5],
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected tidal timescale')
		expect(result.output.value).toBeCloseTo(time, 10)
		expect(result.model.sources[0]?.doi).toBe('10.1016/0019-1035(66)90051-0')
		expectFiniteJson(result)
	})

	it('reproduces the Earth-like Zeng identity and enforces composition bounds', () => {
		const estimate = estimateZeng2016RockyRadius(EARTH_MASS_KG, 1 / 3)
		expect(estimate.radiusEarth).toBeCloseTo(1, 14)
		expect(estimate.radiusM).toBeCloseTo(EARTH_RADIUS_M, 7)
		const result = evaluateZengRockyRadius({
			massKg: EARTH_MASS_KG,
			coreMassFraction: 1 / 3,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected rocky radius')
		expect(result.output.compositionClass).toBe('two-layer-rocky')
		expect(result.output.radius.value).toBeCloseTo(EARTH_RADIUS_M, 7)
		expect(result.model.sources[0]?.doi).toBe('10.3847/0004-637X/819/2/127')
		expectFiniteJson(result)

		expectFailure(evaluateZengRockyRadius({
			massKg: EARTH_MASS_KG,
			coreMassFraction: 0.5,
		}), DIAGNOSTIC_CODES.coreMassFractionOutOfRange)
	})
})
