/**
 * Explainable, non-throwing model catalogue over the low-level numerical core.
 * These evaluators are the boundary for user-supplied scientific inputs.
 */

import {
	computeDensity,
	computeEscapeVelocity,
	computeHabitableZoneAu,
	computeHillSphereAu,
	computeLuminosity,
	computeMeanOrbitalSpeed,
	computeOrbitalPeriodDays,
	computeOrbitalSpeedAtRadius,
	computeParentBarycenterDistanceM,
	computeRocheLimitM,
	computeRotationalBreakupPeriodS,
	computeSurfaceGravity,
	estimateSatelliteStabilityLimitAu,
	type SatelliteOrbitSense,
} from './physics.js'
import {
	KEPLER_SOLVER_TOLERANCE,
	KeplerConvergenceError,
	meanAnomaly,
	meanMotion,
	solveKeplerE,
	stateVectorAtTrueAnomaly,
	trueAnomaly,
	validateOrbitalElements,
	type OrbitalElements,
} from './orbit.js'
import { MODEL_IDS, getModelReference } from './model-registry.js'
import {
	computeBlackbodyEquilibriumTemperatureK,
	computeConstantQEccentricityDampingTimeS,
	computeKopparapu2014ConservativeHabitableZone,
	computeStellarIrradianceWm2,
	estimateEker2018MainSequence,
	estimateZeng2016RockyRadius,
	type KopparapuPlanetMassClass,
} from './model-packs.js'
import { EARTH_MASS_KG, SOLAR_MASS_KG } from './constants.js'
import { au, days, kelvin, kg, m, mu, watts } from './units.js'
import type { KgPerCubicMetre } from './units.js'
import type {
	Diagnostic,
	HabitableZoneOutput,
	InputRecord,
	KopparapuHabitableZoneOutput,
	MainSequenceScreenOutput,
	ModelFailure,
	ModelReference,
	ModelResult,
	ModelSuccess,
	QuantityRecord,
	RockyRadiusOutput,
	SatelliteStabilityOutput,
	StateVectorOutput,
	UnitSymbol,
} from './model-types.js'

export const DIAGNOSTIC_CODES = {
	nonFiniteInput: 'input.number.non-finite',
	massNonPositive: 'body.mass.non-positive',
	radiusNonPositive: 'body.radius.non-positive',
	orbitSemiMajorAxisInvalid: 'orbit.semi-major-axis.invalid',
	orbitEccentricityOutOfRange: 'orbit.eccentricity.out-of-range',
	orbitAngleNonFinite: 'orbit.angle.non-finite',
	orbitEpochPhaseOutOfRange: 'orbit.epoch-phase.out-of-range',
	orbitMuInvalid: 'orbit.mu.invalid',
	orbitAbsoluteDayNonFinite: 'orbit.absolute-day.non-finite',
	orbitFrameInvalid: 'orbit.frame.invalid',
	keplerNonConvergence: 'orbit.kepler.non-convergence',
	orbitEvaluationFailed: 'orbit.evaluation.failed',
	hillRadiusInvalid: 'satellite.hill-radius.invalid',
	parentEccentricityOutOfRange: 'satellite.parent-eccentricity.out-of-range',
	satelliteEccentricityOutOfRange: 'satellite.eccentricity.out-of-range',
	orbitSenseInvalid: 'satellite.orbit-sense.invalid',
	stabilityOutsideDomain: 'satellite.stability.outside-model-domain',
	stabilityEmpiricalFit: 'satellite.stability.empirical-fit',
	densityNonPositive: 'body.density.non-positive',
	orbitalPeriodInvalid: 'orbit.period.invalid',
	orbitalRadiusInvalid: 'orbit.radius.invalid',
	visVivaOutsideDomain: 'orbit.vis-viva.outside-domain',
	binarySeparationInvalid: 'binary.separation.invalid',
	parentMassNonPositive: 'body.parent-mass.non-positive',
	companionMassNonPositive: 'body.companion-mass.non-positive',
	parentRadiusNonPositive: 'satellite.parent-radius.non-positive',
	parentDensityNonPositive: 'satellite.parent-density.non-positive',
	satelliteDensityNonPositive: 'satellite.density.non-positive',
	rigidityInvalid: 'satellite.rigidity.invalid',
	temperatureNonPositive: 'star.temperature.non-positive',
	luminosityNonPositive: 'star.luminosity.non-positive',
	rotationalBreakupScreening: 'body.rotational-breakup.screening',
	meanSpeedApproximation: 'orbit.mean-speed.approximation',
	hillRadiusApproximation: 'orbit.hill-radius.approximation',
	rocheLimitScreening: 'satellite.roche-limit.screening',
	habitableZoneApproximation: 'star.habitable-zone.approximation',
	mainSequenceMassOutsideDomain: 'star.main-sequence.mass.outside-domain',
	mainSequenceEmpiricalFit: 'star.main-sequence.empirical-fit',
	mainSequenceLuminosityOutlier: 'star.main-sequence.luminosity.outlier',
	bondAlbedoOutOfRange: 'planet.bond-albedo.out-of-range',
	equilibriumTemperatureScreening: 'planet.equilibrium-temperature.screening',
	kopparapuTemperatureOutsideDomain: 'star.kopparapu.temperature.outside-domain',
	kopparapuMassClassInvalid: 'star.kopparapu.planet-mass-class.invalid',
	kopparapuClimateApproximation: 'star.kopparapu.climate-model.approximation',
	tidalQualityFactorNonPositive: 'satellite.tidal-q.non-positive',
	loveNumberNonPositive: 'satellite.love-number.non-positive',
	tidalTimescaleScreening: 'satellite.tidal-timescale.screening',
	rockyMassOutsideDomain: 'planet.rocky-radius.mass.outside-domain',
	coreMassFractionOutOfRange: 'planet.core-mass-fraction.out-of-range',
	rockyRadiusEmpiricalFit: 'planet.rocky-radius.empirical-fit',
	outputNonFinite: 'model.output.non-finite',
	outputNonPositive: 'model.output.non-positive',
} as const

const NO_UNCERTAINTY = { kind: 'not-provided' } as const

function numericInput(value: number, unit: UnitSymbol, source: InputRecord['source'] = 'caller'): InputRecord {
	return { value: Number.isFinite(value) ? value : String(value), unit, source }
}

function categoricalInput(value: string, source: InputRecord['source'] = 'caller'): InputRecord {
	return { value, source }
}

function diagnostic(
	model: ModelReference,
	code: string,
	category: Diagnostic['category'],
	severity: Diagnostic['severity'],
	message: string,
	fields: readonly string[],
	evidence?: Diagnostic['evidence'],
): Diagnostic {
	return {
		code,
		category,
		severity,
		message,
		fields,
		...(evidence ? { evidence } : {}),
		modelId: model.id,
	}
}

function failure(
	model: ModelReference,
	inputs: Readonly<Record<string, InputRecord>>,
	diagnostics: readonly Diagnostic[],
): ModelFailure {
	return { ok: false, model, inputs, diagnostics }
}

function success<T>(
	model: ModelReference,
	inputs: Readonly<Record<string, InputRecord>>,
	output: T,
	diagnostics: readonly Diagnostic[] = [],
	extra: Pick<ModelSuccess<T>, 'numerical'> = {},
): ModelSuccess<T> {
	return {
		ok: true,
		output,
		model,
		inputs,
		diagnostics,
		...extra,
		uncertainty: NO_UNCERTAINTY,
	}
}

function finiteDiagnostic(model: ModelReference, field: string, value: number): Diagnostic | null {
	if (Number.isFinite(value)) return null
	return diagnostic(
		model,
		DIAGNOSTIC_CODES.nonFiniteInput,
		'invalid-input',
		'error',
		`${field} must be finite`,
		[field],
		{ value: String(value) },
	)
}

function nonFiniteOutputFailure(
	model: ModelReference,
	inputs: Readonly<Record<string, InputRecord>>,
	fields: readonly string[],
): ModelFailure {
	return failure(model, inputs, [diagnostic(
		model,
		DIAGNOSTIC_CODES.outputNonFinite,
		'numerical-failure',
		'error',
		'The model produced a non-finite output for finite inputs',
		fields,
	)])
}

function positiveDiagnostic(
	model: ModelReference,
	field: string,
	value: number,
	code: string,
): Diagnostic | null {
	const finiteIssue = finiteDiagnostic(model, field, value)
	if (finiteIssue) return finiteIssue
	if (value > 0) return null
	return diagnostic(
		model,
		code,
		'invalid-input',
		'error',
		`${field} must be greater than zero`,
		[field],
		{ value },
	)
}

function positiveOutputFailure(
	model: ModelReference,
	inputs: Readonly<Record<string, InputRecord>>,
	field: string,
): ModelFailure {
	return failure(model, inputs, [diagnostic(
		model,
		DIAGNOSTIC_CODES.outputNonPositive,
		'numerical-failure',
		'error',
		'The model produced a non-positive output for positive finite inputs',
		[field],
	)])
}

function approximationDiagnostic(
	model: ModelReference,
	code: string,
	message: string,
	fields: readonly string[],
): Diagnostic {
	return diagnostic(model, code, 'approximation', 'info', message, fields)
}

function orbitalEccentricityDiagnostic(
	model: ModelReference,
	field: string,
	value: number,
): Diagnostic | null {
	if (Number.isFinite(value) && value >= 0 && value < 1) return null
	return diagnostic(
		model,
		DIAGNOSTIC_CODES.orbitEccentricityOutOfRange,
		'invalid-input',
		'error',
		`${field} must be finite and in [0, 1)`,
		[field],
		{ value: String(value) },
	)
}

export interface BulkDensityModelInput {
	massKg: number
	radiusM: number
}

export function evaluateBulkDensity(
	input: BulkDensityModelInput,
): ModelResult<QuantityRecord<'kg/m^3'>> {
	const model = getModelReference(MODEL_IDS.bulkDensity)
	const inputs = {
		massKg: numericInput(input.massKg, 'kg'),
		radiusM: numericInput(input.radiusM, 'm'),
	}
	const diagnostics: Diagnostic[] = []
	for (const [field, value] of [
		['massKg', input.massKg],
		['radiusM', input.radiusM],
	] as const) {
		const issue = finiteDiagnostic(model, field, value)
		if (issue) diagnostics.push(issue)
	}
	if (Number.isFinite(input.massKg) && input.massKg <= 0) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.massNonPositive,
			'invalid-input',
			'error',
			'massKg must be greater than zero',
			['massKg'],
			{ value: input.massKg },
		))
	}
	if (Number.isFinite(input.radiusM) && input.radiusM <= 0) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.radiusNonPositive,
			'invalid-input',
			'error',
			'radiusM must be greater than zero',
			['radiusM'],
			{ value: input.radiusM },
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeDensity(kg(input.massKg), m(input.radiusM))
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['massKg', 'radiusM'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'density')
	return success(model, inputs, {
		value,
		unit: 'kg/m^3',
	})
}

function evaluateMassRadiusQuantity<U extends 'm/s' | 'm/s^2'>(
	model: ModelReference,
	input: BulkDensityModelInput,
	unit: U,
	calculate: (massKg: number, radiusM: number) => number,
): ModelResult<QuantityRecord<U>> {
	const inputs = {
		massKg: numericInput(input.massKg, 'kg'),
		radiusM: numericInput(input.radiusM, 'm'),
	}
	const diagnostics = [
		positiveDiagnostic(model, 'massKg', input.massKg, DIAGNOSTIC_CODES.massNonPositive),
		positiveDiagnostic(model, 'radiusM', input.radiusM, DIAGNOSTIC_CODES.radiusNonPositive),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = calculate(input.massKg, input.radiusM)
	if (!Number.isFinite(value)) return nonFiniteOutputFailure(model, inputs, ['massKg', 'radiusM'])
	if (value <= 0) return positiveOutputFailure(model, inputs, unit)
	return success(model, inputs, { value, unit })
}

export type SurfaceGravityModelInput = BulkDensityModelInput

export function evaluateSurfaceGravity(
	input: SurfaceGravityModelInput,
): ModelResult<QuantityRecord<'m/s^2'>> {
	return evaluateMassRadiusQuantity(
		getModelReference(MODEL_IDS.surfaceGravity),
		input,
		'm/s^2',
		(massKg, radiusM) => computeSurfaceGravity(kg(massKg), m(radiusM)),
	)
}

export type EscapeVelocityModelInput = BulkDensityModelInput

export function evaluateEscapeVelocity(
	input: EscapeVelocityModelInput,
): ModelResult<QuantityRecord<'m/s'>> {
	return evaluateMassRadiusQuantity(
		getModelReference(MODEL_IDS.escapeVelocity),
		input,
		'm/s',
		(massKg, radiusM) => computeEscapeVelocity(kg(massKg), m(radiusM)),
	)
}

export interface RotationalBreakupModelInput {
	densityKgM3: number
}

export function evaluateRotationalBreakup(
	input: RotationalBreakupModelInput,
): ModelResult<QuantityRecord<'s'>> {
	const model = getModelReference(MODEL_IDS.rotationalBreakup)
	const inputs = { densityKgM3: numericInput(input.densityKgM3, 'kg/m^3') }
	const issue = positiveDiagnostic(
		model,
		'densityKgM3',
		input.densityKgM3,
		DIAGNOSTIC_CODES.densityNonPositive,
	)
	if (issue) return failure(model, inputs, [issue])

	const value = computeRotationalBreakupPeriodS(input.densityKgM3 as KgPerCubicMetre)
	if (!Number.isFinite(value)) return nonFiniteOutputFailure(model, inputs, ['densityKgM3'])
	if (value <= 0) return positiveOutputFailure(model, inputs, 'period')
	return success(model, inputs, { value, unit: 's' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.rotationalBreakupScreening,
		'Gravity-only breakup is a screening threshold; material strength and deformation are excluded',
		['densityKgM3'],
	)])
}

export interface KeplerPeriodModelInput {
	semiMajorAxisAu: number
	muM3S2: number
}

export function evaluateKeplerPeriod(
	input: KeplerPeriodModelInput,
): ModelResult<QuantityRecord<'d'>> {
	const model = getModelReference(MODEL_IDS.keplerPeriod)
	const inputs = {
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
		muM3S2: numericInput(input.muM3S2, 'm^3/s^2'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'semiMajorAxisAu',
			input.semiMajorAxisAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
		positiveDiagnostic(model, 'muM3S2', input.muM3S2, DIAGNOSTIC_CODES.orbitMuInvalid),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeOrbitalPeriodDays(au(input.semiMajorAxisAu), mu(input.muM3S2))
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['semiMajorAxisAu', 'muM3S2'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'period')
	return success(model, inputs, { value, unit: 'd' })
}

export interface EllipticalStateModelInput {
	semiMajorAxisAu: number
	eccentricity: number
	inclinationDeg: number
	longitudeAscendingNodeDeg: number
	argumentOfPeriapsisDeg: number
	epochPhase: number
	muM3S2: number
	absoluteDay: number
	/** Identifier supplied by the scenario/frame layer. */
	frameId?: string
}

const ORBIT_CODE_BY_FIELD: Record<keyof OrbitalElements, string> = {
	semiMajorAxisAu: DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
	eccentricity: DIAGNOSTIC_CODES.orbitEccentricityOutOfRange,
	inclinationDeg: DIAGNOSTIC_CODES.orbitAngleNonFinite,
	longitudeAscendingNodeDeg: DIAGNOSTIC_CODES.orbitAngleNonFinite,
	argumentOfPeriapsisDeg: DIAGNOSTIC_CODES.orbitAngleNonFinite,
	epochPhase: DIAGNOSTIC_CODES.orbitEpochPhaseOutOfRange,
	mu: DIAGNOSTIC_CODES.orbitMuInvalid,
}

export function evaluateEllipticalState(
	input: EllipticalStateModelInput,
): ModelResult<StateVectorOutput> {
	const model = getModelReference(MODEL_IDS.ellipticalState)
	const rawFrameId: unknown = input.frameId
	const frameId = rawFrameId == null
		? 'parent-inertial'
		: String(rawFrameId)
	const inputs = {
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
		eccentricity: numericInput(input.eccentricity, '1'),
		inclinationDeg: numericInput(input.inclinationDeg, 'deg'),
		longitudeAscendingNodeDeg: numericInput(input.longitudeAscendingNodeDeg, 'deg'),
		argumentOfPeriapsisDeg: numericInput(input.argumentOfPeriapsisDeg, 'deg'),
		epochPhase: numericInput(input.epochPhase, '1'),
		muM3S2: numericInput(input.muM3S2, 'm^3/s^2'),
		absoluteDay: numericInput(input.absoluteDay, 'd'),
		frameId: categoricalInput(frameId, rawFrameId == null ? 'default' : 'caller'),
	}
	const elements: OrbitalElements = {
		semiMajorAxisAu: au(input.semiMajorAxisAu),
		eccentricity: input.eccentricity,
		inclinationDeg: input.inclinationDeg,
		longitudeAscendingNodeDeg: input.longitudeAscendingNodeDeg,
		argumentOfPeriapsisDeg: input.argumentOfPeriapsisDeg,
		epochPhase: input.epochPhase,
		mu: mu(input.muM3S2),
	}
	const diagnostics = validateOrbitalElements(elements).map(issue => diagnostic(
		model,
		ORBIT_CODE_BY_FIELD[issue.field],
		'invalid-input',
		'error',
		issue.message,
		[issue.field === 'mu' ? 'muM3S2' : issue.field],
	))
	const dayIssue = finiteDiagnostic(model, 'absoluteDay', input.absoluteDay)
	if (dayIssue) {
		diagnostics.push({ ...dayIssue, code: DIAGNOSTIC_CODES.orbitAbsoluteDayNonFinite })
	}
	if ((rawFrameId != null && typeof rawFrameId !== 'string') || frameId.trim().length === 0) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.orbitFrameInvalid,
			'invalid-input',
			'error',
			'frameId must not be empty',
			['frameId'],
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	try {
		const periodDays = (2 * Math.PI) / meanMotion(elements.mu, elements.semiMajorAxisAu) / 86_400
		const meanAnomalyRad = meanAnomaly(periodDays, elements.epochPhase, input.absoluteDay)
		const eccentricAnomalyRad = solveKeplerE(meanAnomalyRad, elements.eccentricity)
		const residual = Math.abs(
			eccentricAnomalyRad
			- elements.eccentricity * Math.sin(eccentricAnomalyRad)
			- meanAnomalyRad,
		)
		const state = stateVectorAtTrueAnomaly(
			elements,
			trueAnomaly(eccentricAnomalyRad, elements.eccentricity),
		)
		const stateNumbers = [
			state.position.x, state.position.y, state.position.z,
			state.velocity.x, state.velocity.y, state.velocity.z,
			residual,
		]
		if (stateNumbers.some(value => !Number.isFinite(value))) {
			return nonFiniteOutputFailure(model, inputs, [
				'semiMajorAxisAu',
				'eccentricity',
				'muM3S2',
				'absoluteDay',
			])
		}
		return success(model, inputs, {
			position: { ...state.position, unit: 'm' },
			velocity: { ...state.velocity, unit: 'm/s' },
			frameId,
		}, [], {
			numerical: {
				method: 'safeguarded-newton-bisection',
				residual,
				tolerance: KEPLER_SOLVER_TOLERANCE,
				converged: residual <= KEPLER_SOLVER_TOLERANCE,
			},
		})
	} catch (error) {
		if (error instanceof KeplerConvergenceError) {
			return failure(model, inputs, [diagnostic(
				model,
				DIAGNOSTIC_CODES.keplerNonConvergence,
				'numerical-failure',
				'error',
				error.message,
				['eccentricity', 'absoluteDay'],
				{ residual: error.residual, iterations: error.iterations },
			)])
		}
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.orbitEvaluationFailed,
			'numerical-failure',
			'error',
			error instanceof Error ? error.message : 'Elliptical state evaluation failed',
			[],
		)])
	}
}

export interface SatelliteStabilityModelInput {
	hillRadiusAu: number
	parentEccentricity?: number | null
	satelliteEccentricity?: number | null
	orbitSense?: SatelliteOrbitSense
}

function eccentricityDiagnostic(
	model: ModelReference,
	field: 'parentEccentricity' | 'satelliteEccentricity',
	value: number,
): Diagnostic | null {
	if (Number.isFinite(value) && value >= 0 && value < 1) return null
	return diagnostic(
		model,
		field === 'parentEccentricity'
			? DIAGNOSTIC_CODES.parentEccentricityOutOfRange
			: DIAGNOSTIC_CODES.satelliteEccentricityOutOfRange,
		'invalid-input',
		'error',
		`${field} must be finite and in [0, 1)`,
		[field],
		{ value: String(value) },
	)
}

export function evaluateSatelliteStability(
	input: SatelliteStabilityModelInput,
): ModelResult<SatelliteStabilityOutput> {
	const model = getModelReference(MODEL_IDS.satelliteStability)
	const parentEccentricity = input.parentEccentricity ?? 0
	const satelliteEccentricity = input.satelliteEccentricity ?? 0
	const rawOrbitSense: unknown = input.orbitSense
	const orbitSense = rawOrbitSense == null ? 'prograde' : String(rawOrbitSense)
	const inputs = {
		hillRadiusAu: numericInput(input.hillRadiusAu, 'AU'),
		parentEccentricity: numericInput(
			parentEccentricity,
			'1',
			input.parentEccentricity == null ? 'default' : 'caller',
		),
		satelliteEccentricity: numericInput(
			satelliteEccentricity,
			'1',
			input.satelliteEccentricity == null ? 'default' : 'caller',
		),
		orbitSense: categoricalInput(orbitSense, rawOrbitSense == null ? 'default' : 'caller'),
	}
	const diagnostics: Diagnostic[] = []
	if (!Number.isFinite(input.hillRadiusAu) || input.hillRadiusAu <= 0) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.hillRadiusInvalid,
			'invalid-input',
			'error',
			'hillRadiusAu must be finite and greater than zero',
			['hillRadiusAu'],
			{ value: String(input.hillRadiusAu) },
		))
	}
	const parentIssue = eccentricityDiagnostic(model, 'parentEccentricity', parentEccentricity)
	if (parentIssue) diagnostics.push(parentIssue)
	const satelliteIssue = eccentricityDiagnostic(model, 'satelliteEccentricity', satelliteEccentricity)
	if (satelliteIssue) diagnostics.push(satelliteIssue)
	if (orbitSense !== 'prograde' && orbitSense !== 'retrograde') {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.orbitSenseInvalid,
			'invalid-input',
			'error',
			'orbitSense must be prograde or retrograde',
			['orbitSense'],
			{ value: String(orbitSense) },
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	try {
		const estimate = estimateSatelliteStabilityLimitAu(
			au(input.hillRadiusAu),
			parentEccentricity,
			satelliteEccentricity,
			orbitSense as SatelliteOrbitSense,
		)
		if (!Number.isFinite(estimate.limitAu) || !Number.isFinite(estimate.hillFraction)) {
			return nonFiniteOutputFailure(model, inputs, [
				'hillRadiusAu',
				'parentEccentricity',
				'satelliteEccentricity',
			])
		}
		return success(model, inputs, {
			limit: { value: estimate.limitAu, unit: 'AU' },
			hillFraction: { value: estimate.hillFraction, unit: '1' },
			orbitSense: orbitSense as SatelliteOrbitSense,
		}, [diagnostic(
			model,
			DIAGNOSTIC_CODES.stabilityEmpiricalFit,
			'approximation',
			'info',
			'This is an empirical restricted-three-body screening limit, not an N-body stability guarantee',
			['hillRadiusAu', 'parentEccentricity', 'satelliteEccentricity', 'orbitSense'],
		)])
	} catch (error) {
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.stabilityOutsideDomain,
			'outside-domain',
			'error',
			error instanceof Error ? error.message : 'Inputs are outside the empirical model domain',
			['parentEccentricity', 'satelliteEccentricity', 'orbitSense'],
		)])
	}
}

export interface VisVivaSpeedModelInput {
	muM3S2: number
	radiusAu: number
	semiMajorAxisAu: number
}

export function evaluateVisVivaSpeed(
	input: VisVivaSpeedModelInput,
): ModelResult<QuantityRecord<'m/s'>> {
	const model = getModelReference(MODEL_IDS.visVivaSpeed)
	const inputs = {
		muM3S2: numericInput(input.muM3S2, 'm^3/s^2'),
		radiusAu: numericInput(input.radiusAu, 'AU'),
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
	}
	const diagnostics = [
		positiveDiagnostic(model, 'muM3S2', input.muM3S2, DIAGNOSTIC_CODES.orbitMuInvalid),
		positiveDiagnostic(
			model,
			'radiusAu',
			input.radiusAu,
			DIAGNOSTIC_CODES.orbitalRadiusInvalid,
		),
		positiveDiagnostic(
			model,
			'semiMajorAxisAu',
			input.semiMajorAxisAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	if (input.radiusAu >= 2 * input.semiMajorAxisAu) {
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.visVivaOutsideDomain,
			'outside-domain',
			'error',
			'radiusAu must be less than twice semiMajorAxisAu for a positive bound-orbit speed',
			['radiusAu', 'semiMajorAxisAu'],
			{ maximumRadiusAu: 2 * input.semiMajorAxisAu },
		)])
	}

	const value = computeOrbitalSpeedAtRadius(
		mu(input.muM3S2),
		au(input.radiusAu),
		au(input.semiMajorAxisAu),
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['muM3S2', 'radiusAu', 'semiMajorAxisAu'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'speed')
	return success(model, inputs, { value, unit: 'm/s' })
}

export interface MeanSpeedModelInput {
	semiMajorAxisAu: number
	orbitalPeriodDays: number
	eccentricity?: number | null
}

export function evaluateMeanSpeed(
	input: MeanSpeedModelInput,
): ModelResult<QuantityRecord<'m/s'>> {
	const model = getModelReference(MODEL_IDS.meanSpeed)
	const eccentricity = input.eccentricity ?? 0
	const inputs = {
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
		orbitalPeriodDays: numericInput(input.orbitalPeriodDays, 'd'),
		eccentricity: numericInput(
			eccentricity,
			'1',
			input.eccentricity == null ? 'default' : 'caller',
		),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'semiMajorAxisAu',
			input.semiMajorAxisAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
		positiveDiagnostic(
			model,
			'orbitalPeriodDays',
			input.orbitalPeriodDays,
			DIAGNOSTIC_CODES.orbitalPeriodInvalid,
		),
		orbitalEccentricityDiagnostic(model, 'eccentricity', eccentricity),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeMeanOrbitalSpeed(
		au(input.semiMajorAxisAu),
		days(input.orbitalPeriodDays),
		eccentricity,
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, [
			'semiMajorAxisAu',
			'orbitalPeriodDays',
			'eccentricity',
		])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'speed')
	return success(model, inputs, { value, unit: 'm/s' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.meanSpeedApproximation,
		'The ellipse perimeter uses Ramanujan’s approximation',
		['semiMajorAxisAu', 'orbitalPeriodDays', 'eccentricity'],
	)])
}

export interface HillRadiusModelInput {
	semiMajorAxisAu: number
	bodyMassKg: number
	parentMassKg: number
	eccentricity?: number | null
}

export function evaluateHillRadius(
	input: HillRadiusModelInput,
): ModelResult<QuantityRecord<'AU'>> {
	const model = getModelReference(MODEL_IDS.hillRadius)
	const eccentricity = input.eccentricity ?? 0
	const inputs = {
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
		bodyMassKg: numericInput(input.bodyMassKg, 'kg'),
		parentMassKg: numericInput(input.parentMassKg, 'kg'),
		eccentricity: numericInput(
			eccentricity,
			'1',
			input.eccentricity == null ? 'default' : 'caller',
		),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'semiMajorAxisAu',
			input.semiMajorAxisAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
		positiveDiagnostic(
			model,
			'bodyMassKg',
			input.bodyMassKg,
			DIAGNOSTIC_CODES.massNonPositive,
		),
		positiveDiagnostic(
			model,
			'parentMassKg',
			input.parentMassKg,
			DIAGNOSTIC_CODES.parentMassNonPositive,
		),
		orbitalEccentricityDiagnostic(model, 'eccentricity', eccentricity),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeHillSphereAu(
		au(input.semiMajorAxisAu),
		kg(input.bodyMassKg),
		kg(input.parentMassKg),
		eccentricity,
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, [
			'semiMajorAxisAu',
			'bodyMassKg',
			'parentMassKg',
			'eccentricity',
		])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'hillRadius')
	return success(model, inputs, { value, unit: 'AU' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.hillRadiusApproximation,
		'The Hill radius is a restricted-three-body approximation evaluated at periapsis',
		['semiMajorAxisAu', 'bodyMassKg', 'parentMassKg', 'eccentricity'],
	)])
}

export interface ParentBarycenterDistanceModelInput {
	separationAu: number
	parentMassKg: number
	companionMassKg: number
}

export function evaluateParentBarycenterDistance(
	input: ParentBarycenterDistanceModelInput,
): ModelResult<QuantityRecord<'m'>> {
	const model = getModelReference(MODEL_IDS.parentBarycenterDistance)
	const inputs = {
		separationAu: numericInput(input.separationAu, 'AU'),
		parentMassKg: numericInput(input.parentMassKg, 'kg'),
		companionMassKg: numericInput(input.companionMassKg, 'kg'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'separationAu',
			input.separationAu,
			DIAGNOSTIC_CODES.binarySeparationInvalid,
		),
		positiveDiagnostic(
			model,
			'parentMassKg',
			input.parentMassKg,
			DIAGNOSTIC_CODES.parentMassNonPositive,
		),
		positiveDiagnostic(
			model,
			'companionMassKg',
			input.companionMassKg,
			DIAGNOSTIC_CODES.companionMassNonPositive,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	if (!Number.isFinite(input.parentMassKg + input.companionMassKg)) {
		return nonFiniteOutputFailure(model, inputs, ['parentMassKg', 'companionMassKg'])
	}

	const value = computeParentBarycenterDistanceM(
		au(input.separationAu),
		kg(input.parentMassKg),
		kg(input.companionMassKg),
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, [
			'separationAu',
			'parentMassKg',
			'companionMassKg',
		])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'distance')
	return success(model, inputs, { value, unit: 'm' })
}

export interface RocheLimitModelInput {
	parentRadiusM: number
	parentDensityKgM3: number
	satelliteDensityKgM3: number
	rigidity?: 'rigid' | 'fluid'
}

export function evaluateRocheLimit(
	input: RocheLimitModelInput,
): ModelResult<QuantityRecord<'m'>> {
	const model = getModelReference(MODEL_IDS.rocheLimit)
	const rawRigidity: unknown = input.rigidity
	const rigidity = rawRigidity == null ? 'rigid' : String(rawRigidity)
	const inputs = {
		parentRadiusM: numericInput(input.parentRadiusM, 'm'),
		parentDensityKgM3: numericInput(input.parentDensityKgM3, 'kg/m^3'),
		satelliteDensityKgM3: numericInput(input.satelliteDensityKgM3, 'kg/m^3'),
		rigidity: categoricalInput(rigidity, rawRigidity == null ? 'default' : 'caller'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'parentRadiusM',
			input.parentRadiusM,
			DIAGNOSTIC_CODES.parentRadiusNonPositive,
		),
		positiveDiagnostic(
			model,
			'parentDensityKgM3',
			input.parentDensityKgM3,
			DIAGNOSTIC_CODES.parentDensityNonPositive,
		),
		positiveDiagnostic(
			model,
			'satelliteDensityKgM3',
			input.satelliteDensityKgM3,
			DIAGNOSTIC_CODES.satelliteDensityNonPositive,
		),
	].filter(issue => issue != null)
	if (rigidity !== 'rigid' && rigidity !== 'fluid') {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.rigidityInvalid,
			'invalid-input',
			'error',
			'rigidity must be rigid or fluid',
			['rigidity'],
			{ value: rigidity },
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeRocheLimitM(
		m(input.parentRadiusM),
		input.parentDensityKgM3 as KgPerCubicMetre,
		input.satelliteDensityKgM3 as KgPerCubicMetre,
		rigidity as 'rigid' | 'fluid',
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, [
			'parentRadiusM',
			'parentDensityKgM3',
			'satelliteDensityKgM3',
		])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'limit')
	return success(model, inputs, { value, unit: 'm' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.rocheLimitScreening,
		'The rigid and fluid Roche limits are idealised gravity-only screening bounds',
		['parentRadiusM', 'parentDensityKgM3', 'satelliteDensityKgM3', 'rigidity'],
	)])
}

export interface StefanBoltzmannLuminosityModelInput {
	radiusM: number
	temperatureK: number
}

export function evaluateStefanBoltzmannLuminosity(
	input: StefanBoltzmannLuminosityModelInput,
): ModelResult<QuantityRecord<'W'>> {
	const model = getModelReference(MODEL_IDS.stefanBoltzmannLuminosity)
	const inputs = {
		radiusM: numericInput(input.radiusM, 'm'),
		temperatureK: numericInput(input.temperatureK, 'K'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'radiusM',
			input.radiusM,
			DIAGNOSTIC_CODES.radiusNonPositive,
		),
		positiveDiagnostic(
			model,
			'temperatureK',
			input.temperatureK,
			DIAGNOSTIC_CODES.temperatureNonPositive,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const value = computeLuminosity(m(input.radiusM), kelvin(input.temperatureK))
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['radiusM', 'temperatureK'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'luminosity')
	return success(model, inputs, { value, unit: 'W' })
}

export interface SimpleHabitableZoneModelInput {
	luminosityW: number
}

export function evaluateSimpleHabitableZone(
	input: SimpleHabitableZoneModelInput,
): ModelResult<HabitableZoneOutput> {
	const model = getModelReference(MODEL_IDS.simpleHabitableZone)
	const inputs = { luminosityW: numericInput(input.luminosityW, 'W') }
	const issue = positiveDiagnostic(
		model,
		'luminosityW',
		input.luminosityW,
		DIAGNOSTIC_CODES.luminosityNonPositive,
	)
	if (issue) return failure(model, inputs, [issue])

	const zone = computeHabitableZoneAu(watts(input.luminosityW))
	if (!Number.isFinite(zone.inner) || !Number.isFinite(zone.outer)) {
		return nonFiniteOutputFailure(model, inputs, ['luminosityW'])
	}
	if (zone.inner <= 0 || zone.outer <= 0) {
		return positiveOutputFailure(model, inputs, 'habitableZone')
	}
	return success(model, inputs, {
		inner: { value: zone.inner, unit: 'AU' },
		outer: { value: zone.outer, unit: 'AU' },
	}, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.habitableZoneApproximation,
		'This fixed-flux annulus is a screening range, not a planetary habitability prediction',
		['luminosityW'],
	)])
}

export interface EkerMainSequenceScreenModelInput {
	massKg: number
	luminosityW: number
}

export function evaluateEkerMainSequenceScreen(
	input: EkerMainSequenceScreenModelInput,
): ModelResult<MainSequenceScreenOutput> {
	const model = getModelReference(MODEL_IDS.ekerMainSequenceScreen)
	const inputs = {
		massKg: numericInput(input.massKg, 'kg'),
		luminosityW: numericInput(input.luminosityW, 'W'),
	}
	const diagnostics = [
		positiveDiagnostic(model, 'massKg', input.massKg, DIAGNOSTIC_CODES.massNonPositive),
		positiveDiagnostic(
			model,
			'luminosityW',
			input.luminosityW,
			DIAGNOSTIC_CODES.luminosityNonPositive,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	const massSolar = input.massKg / SOLAR_MASS_KG
	if (massSolar < 0.179 || massSolar > 31) {
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.mainSequenceMassOutsideDomain,
			'outside-domain',
			'error',
			'Eker et al. 2018 covers 0.179–31 solar-mass reference units',
			['massKg'],
			{ massSolar },
		)])
	}

	const estimate = estimateEker2018MainSequence(input.massKg, input.luminosityW)
	const values = [
		estimate.expectedLuminosityW,
		estimate.expectedLuminositySolar,
		estimate.luminosityRatio,
		estimate.logLuminosityResidualDex,
		estimate.intrinsicScatterDex,
	]
	if (!values.every(Number.isFinite)) {
		return nonFiniteOutputFailure(model, inputs, ['massKg', 'luminosityW'])
	}
	const resultDiagnostics: Diagnostic[] = [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.mainSequenceEmpiricalFit,
		'This is an empirical population screen; age and metallicity can produce real departures',
		['massKg', 'luminosityW'],
	)]
	if (!estimate.withinOneSigma) {
		resultDiagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.mainSequenceLuminosityOutlier,
			'physical-warning',
			'warning',
			'The supplied luminosity lies outside the relation’s intrinsic one-sigma scatter',
			['massKg', 'luminosityW'],
			{
				logLuminosityResidualDex: estimate.logLuminosityResidualDex,
				intrinsicScatterDex: estimate.intrinsicScatterDex,
			},
		))
	}
	return success(model, inputs, {
		expectedLuminosity: { value: estimate.expectedLuminosityW, unit: 'W' },
		expectedLuminositySolar: { value: estimate.expectedLuminositySolar, unit: '1' },
		luminosityRatio: { value: estimate.luminosityRatio, unit: '1' },
		logLuminosityResidualDex: { value: estimate.logLuminosityResidualDex, unit: '1' },
		intrinsicScatterDex: { value: estimate.intrinsicScatterDex, unit: '1' },
		withinOneSigma: estimate.withinOneSigma,
		massDomain: estimate.massDomain,
	}, resultDiagnostics)
}

export interface StellarIrradianceModelInput {
	luminosityW: number
	distanceAu: number
}

export function evaluateStellarIrradiance(
	input: StellarIrradianceModelInput,
): ModelResult<QuantityRecord<'W/m^2'>> {
	const model = getModelReference(MODEL_IDS.stellarIrradiance)
	const inputs = {
		luminosityW: numericInput(input.luminosityW, 'W'),
		distanceAu: numericInput(input.distanceAu, 'AU'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'luminosityW',
			input.luminosityW,
			DIAGNOSTIC_CODES.luminosityNonPositive,
		),
		positiveDiagnostic(
			model,
			'distanceAu',
			input.distanceAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	const value = computeStellarIrradianceWm2(input.luminosityW, input.distanceAu)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['luminosityW', 'distanceAu'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'irradiance')
	return success(model, inputs, { value, unit: 'W/m^2' })
}

export interface BlackbodyEquilibriumTemperatureModelInput {
	luminosityW: number
	distanceAu: number
	bondAlbedo: number
}

export function evaluateBlackbodyEquilibriumTemperature(
	input: BlackbodyEquilibriumTemperatureModelInput,
): ModelResult<QuantityRecord<'K'>> {
	const model = getModelReference(MODEL_IDS.blackbodyEquilibriumTemperature)
	const inputs = {
		luminosityW: numericInput(input.luminosityW, 'W'),
		distanceAu: numericInput(input.distanceAu, 'AU'),
		bondAlbedo: numericInput(input.bondAlbedo, '1'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'luminosityW',
			input.luminosityW,
			DIAGNOSTIC_CODES.luminosityNonPositive,
		),
		positiveDiagnostic(
			model,
			'distanceAu',
			input.distanceAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
	].filter(issue => issue != null)
	const albedoIssue = finiteDiagnostic(model, 'bondAlbedo', input.bondAlbedo)
	if (albedoIssue) diagnostics.push(albedoIssue)
	else if (input.bondAlbedo < 0 || input.bondAlbedo >= 1) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.bondAlbedoOutOfRange,
			'invalid-input',
			'error',
			'bondAlbedo must be in [0, 1)',
			['bondAlbedo'],
			{ value: input.bondAlbedo },
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	const value = computeBlackbodyEquilibriumTemperatureK(
		input.luminosityW,
		input.distanceAu,
		input.bondAlbedo,
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, ['luminosityW', 'distanceAu', 'bondAlbedo'])
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'equilibriumTemperature')
	return success(model, inputs, { value, unit: 'K' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.equilibriumTemperatureScreening,
		'Equilibrium temperature excludes greenhouse warming, internal heat and incomplete redistribution',
		['luminosityW', 'distanceAu', 'bondAlbedo'],
	)])
}

export interface KopparapuConservativeHabitableZoneModelInput {
	luminosityW: number
	effectiveTemperatureK: number
	planetMassClass?: KopparapuPlanetMassClass
}

export function evaluateKopparapuConservativeHabitableZone(
	input: KopparapuConservativeHabitableZoneModelInput,
): ModelResult<KopparapuHabitableZoneOutput> {
	const model = getModelReference(MODEL_IDS.kopparapuConservativeHabitableZone)
	const rawMassClass: unknown = input.planetMassClass
	const planetMassClass = rawMassClass == null ? '1-earth' : String(rawMassClass)
	const inputs = {
		luminosityW: numericInput(input.luminosityW, 'W'),
		effectiveTemperatureK: numericInput(input.effectiveTemperatureK, 'K'),
		planetMassClass: categoricalInput(
			planetMassClass,
			rawMassClass == null ? 'default' : 'caller',
		),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'luminosityW',
			input.luminosityW,
			DIAGNOSTIC_CODES.luminosityNonPositive,
		),
	].filter(issue => issue != null)
	const temperatureIssue = finiteDiagnostic(
		model,
		'effectiveTemperatureK',
		input.effectiveTemperatureK,
	)
	if (temperatureIssue) diagnostics.push(temperatureIssue)
	else if (input.effectiveTemperatureK < 2600 || input.effectiveTemperatureK > 7200) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.kopparapuTemperatureOutsideDomain,
			'outside-domain',
			'error',
			'Kopparapu et al. 2014 covers stellar effective temperatures from 2600 K to 7200 K',
			['effectiveTemperatureK'],
			{ value: input.effectiveTemperatureK },
		))
	}
	if (!['0.1-earth', '1-earth', '5-earth'].includes(planetMassClass)) {
		diagnostics.push(diagnostic(
			model,
			DIAGNOSTIC_CODES.kopparapuMassClassInvalid,
			'invalid-input',
			'error',
			'planetMassClass must be 0.1-earth, 1-earth or 5-earth',
			['planetMassClass'],
			{ value: planetMassClass },
		))
	}
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)

	const zone = computeKopparapu2014ConservativeHabitableZone(
		input.luminosityW,
		input.effectiveTemperatureK,
		planetMassClass as KopparapuPlanetMassClass,
	)
	if (![
		zone.innerAu,
		zone.outerAu,
		zone.innerEffectiveFlux,
		zone.outerEffectiveFlux,
	].every(Number.isFinite)) {
		return nonFiniteOutputFailure(
			model,
			inputs,
			['luminosityW', 'effectiveTemperatureK', 'planetMassClass'],
		)
	}
	if (
		zone.innerAu <= 0
		|| zone.outerAu <= zone.innerAu
		|| zone.innerEffectiveFlux <= 0
		|| zone.outerEffectiveFlux <= 0
	) {
		return positiveOutputFailure(model, inputs, 'habitableZone')
	}
	return success(model, inputs, {
		inner: { value: zone.innerAu, unit: 'AU' },
		outer: { value: zone.outerAu, unit: 'AU' },
		innerEffectiveFlux: { value: zone.innerEffectiveFlux, unit: '1' },
		outerEffectiveFlux: { value: zone.outerEffectiveFlux, unit: '1' },
		planetMassClass: zone.planetMassClass,
	}, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.kopparapuClimateApproximation,
		'These one-dimensional climate boundaries are screening limits, not a habitability prediction',
		['luminosityW', 'effectiveTemperatureK', 'planetMassClass'],
	)])
}

export interface ConstantQEccentricityDampingModelInput {
	semiMajorAxisAu: number
	satelliteRadiusM: number
	satelliteMassKg: number
	parentMassKg: number
	tidalQualityFactor: number
	loveNumberK2: number
}

export function evaluateConstantQEccentricityDamping(
	input: ConstantQEccentricityDampingModelInput,
): ModelResult<QuantityRecord<'s'>> {
	const model = getModelReference(MODEL_IDS.constantQEccentricityDamping)
	const inputs = {
		semiMajorAxisAu: numericInput(input.semiMajorAxisAu, 'AU'),
		satelliteRadiusM: numericInput(input.satelliteRadiusM, 'm'),
		satelliteMassKg: numericInput(input.satelliteMassKg, 'kg'),
		parentMassKg: numericInput(input.parentMassKg, 'kg'),
		tidalQualityFactor: numericInput(input.tidalQualityFactor, '1'),
		loveNumberK2: numericInput(input.loveNumberK2, '1'),
	}
	const diagnostics = [
		positiveDiagnostic(
			model,
			'semiMajorAxisAu',
			input.semiMajorAxisAu,
			DIAGNOSTIC_CODES.orbitSemiMajorAxisInvalid,
		),
		positiveDiagnostic(
			model,
			'satelliteRadiusM',
			input.satelliteRadiusM,
			DIAGNOSTIC_CODES.radiusNonPositive,
		),
		positiveDiagnostic(
			model,
			'satelliteMassKg',
			input.satelliteMassKg,
			DIAGNOSTIC_CODES.massNonPositive,
		),
		positiveDiagnostic(
			model,
			'parentMassKg',
			input.parentMassKg,
			DIAGNOSTIC_CODES.parentMassNonPositive,
		),
		positiveDiagnostic(
			model,
			'tidalQualityFactor',
			input.tidalQualityFactor,
			DIAGNOSTIC_CODES.tidalQualityFactorNonPositive,
		),
		positiveDiagnostic(
			model,
			'loveNumberK2',
			input.loveNumberK2,
			DIAGNOSTIC_CODES.loveNumberNonPositive,
		),
	].filter(issue => issue != null)
	if (diagnostics.length > 0) return failure(model, inputs, diagnostics)
	const value = computeConstantQEccentricityDampingTimeS(
		input.semiMajorAxisAu,
		input.satelliteRadiusM,
		input.satelliteMassKg,
		input.parentMassKg,
		input.tidalQualityFactor,
		input.loveNumberK2,
	)
	if (!Number.isFinite(value)) {
		return nonFiniteOutputFailure(model, inputs, Object.keys(inputs))
	}
	if (value <= 0) return positiveOutputFailure(model, inputs, 'dampingTime')
	return success(model, inputs, { value, unit: 's' }, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.tidalTimescaleScreening,
		'Constant-Q low-eccentricity damping is a local screening timescale, not an integrated evolution',
		Object.keys(inputs),
	)])
}

export interface ZengRockyRadiusModelInput {
	massKg: number
	coreMassFraction: number
}

export function evaluateZengRockyRadius(
	input: ZengRockyRadiusModelInput,
): ModelResult<RockyRadiusOutput> {
	const model = getModelReference(MODEL_IDS.zengRockyRadius)
	const inputs = {
		massKg: numericInput(input.massKg, 'kg'),
		coreMassFraction: numericInput(input.coreMassFraction, '1'),
	}
	const massIssue = positiveDiagnostic(
		model,
		'massKg',
		input.massKg,
		DIAGNOSTIC_CODES.massNonPositive,
	)
	if (massIssue) return failure(model, inputs, [massIssue])
	const massEarth = input.massKg / EARTH_MASS_KG
	if (massEarth < 1 || massEarth > 8) {
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.rockyMassOutsideDomain,
			'outside-domain',
			'error',
			'Zeng et al. 2016 covers planets from 1 to 8 Earth-mass reference units',
			['massKg'],
			{ massEarth },
		)])
	}
	const coreIssue = finiteDiagnostic(model, 'coreMassFraction', input.coreMassFraction)
	if (coreIssue) return failure(model, inputs, [coreIssue])
	if (input.coreMassFraction < 0 || input.coreMassFraction > 0.4) {
		return failure(model, inputs, [diagnostic(
			model,
			DIAGNOSTIC_CODES.coreMassFractionOutOfRange,
			'outside-domain',
			'error',
			'coreMassFraction must lie in the published range [0, 0.4]',
			['coreMassFraction'],
			{ value: input.coreMassFraction },
		)])
	}
	const estimate = estimateZeng2016RockyRadius(input.massKg, input.coreMassFraction)
	if (![estimate.radiusM, estimate.radiusEarth].every(Number.isFinite)) {
		return nonFiniteOutputFailure(model, inputs, ['massKg', 'coreMassFraction'])
	}
	return success(model, inputs, {
		radius: { value: estimate.radiusM, unit: 'm' },
		radiusEarth: { value: estimate.radiusEarth, unit: '1' },
		massEarth: { value: estimate.massEarth, unit: '1' },
		coreMassFraction: { value: estimate.coreMassFraction, unit: '1' },
		compositionClass: 'two-layer-rocky',
	}, [approximationDiagnostic(
		model,
		DIAGNOSTIC_CODES.rockyRadiusEmpiricalFit,
		'This PREM-based two-layer relation excludes volatile envelopes and broader composition diversity',
		['massKg', 'coreMassFraction'],
	)])
}
