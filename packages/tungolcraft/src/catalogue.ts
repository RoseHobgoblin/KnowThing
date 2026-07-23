/**
 * Explainable, non-throwing model catalogue over the low-level numerical core.
 * These evaluators are the boundary for user-supplied scientific inputs.
 */

import { computeDensity, estimateSatelliteStabilityLimitAu, type SatelliteOrbitSense } from './physics.js'
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
import { au, kg, m, mu } from './units.js'
import type {
	Diagnostic,
	InputRecord,
	ModelFailure,
	ModelReference,
	ModelResult,
	ModelSuccess,
	QuantityRecord,
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
	outputNonFinite: 'model.output.non-finite',
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
	return success(model, inputs, {
		value,
		unit: 'kg/m^3',
	})
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
