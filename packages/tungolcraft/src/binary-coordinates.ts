import type { Diagnostic, StateVectorOutput } from './model-types.js'
import type {
	BinaryAxisPartition,
	BinaryBarycentricStates,
	BinaryState,
	ValidationResult,
} from './scenario-types.js'

export const BINARY_DIAGNOSTIC_CODES = {
	axisInvalid: 'binary.relative-axis.invalid',
	primaryMassInvalid: 'binary.primary-mass.invalid',
	secondaryMassInvalid: 'binary.secondary-mass.invalid',
	stateInvalid: 'binary.relative-state.invalid',
	frameInvalid: 'binary.frame.invalid',
	outputInvalid: 'binary.output.invalid',
} as const

function issue(
	code: string,
	message: string,
	fields: readonly string[],
	evidence?: Diagnostic['evidence'],
): Diagnostic {
	return {
		code,
		category: 'invalid-input',
		severity: 'error',
		message,
		fields,
		...(evidence ? { evidence } : {}),
		modelId: 'binary.coordinates',
	}
}

function positiveIssue(field: string, value: number, code: string): Diagnostic | null {
	if (Number.isFinite(value) && value > 0) return null
	return issue(code, `${field} must be finite and greater than zero`, [field], {
		value: String(value),
	})
}

function massFractions(
	primaryMassKg: number,
	secondaryMassKg: number,
): { primary: number, secondary: number } {
	if (primaryMassKg >= secondaryMassKg) {
		const ratio = secondaryMassKg / primaryMassKg
		return {
			primary: ratio / (1 + ratio),
			secondary: 1 / (1 + ratio),
		}
	}
	const ratio = primaryMassKg / secondaryMassKg
	return {
		primary: 1 / (1 + ratio),
		secondary: ratio / (1 + ratio),
	}
}

export interface PartitionBinaryRelativeAxisInput {
	relativeSemiMajorAxisAu: number
	primaryMassKg: number
	secondaryMassKg: number
}

export function partitionBinaryRelativeAxis(
	input: PartitionBinaryRelativeAxisInput,
): ValidationResult<BinaryAxisPartition> {
	const diagnostics = [
		positiveIssue(
			'relativeSemiMajorAxisAu',
			input.relativeSemiMajorAxisAu,
			BINARY_DIAGNOSTIC_CODES.axisInvalid,
		),
		positiveIssue(
			'primaryMassKg',
			input.primaryMassKg,
			BINARY_DIAGNOSTIC_CODES.primaryMassInvalid,
		),
		positiveIssue(
			'secondaryMassKg',
			input.secondaryMassKg,
			BINARY_DIAGNOSTIC_CODES.secondaryMassInvalid,
		),
	].filter(problem => problem != null)
	if (diagnostics.length > 0) return { ok: false, diagnostics }

	const fractions = massFractions(input.primaryMassKg, input.secondaryMassKg)
	const primary = input.relativeSemiMajorAxisAu * fractions.primary
	const secondary = input.relativeSemiMajorAxisAu * fractions.secondary
	if (![primary, secondary].every(value => Number.isFinite(value) && value > 0)) {
		return {
			ok: false,
			diagnostics: [issue(
				BINARY_DIAGNOSTIC_CODES.outputInvalid,
				'Binary axis partition produced an invalid output',
				['relativeSemiMajorAxisAu', 'primaryMassKg', 'secondaryMassKg'],
			)],
		}
	}
	return {
		ok: true,
		value: {
			relativeSemiMajorAxis: { value: input.relativeSemiMajorAxisAu, unit: 'AU' },
			primaryBarycentricSemiMajorAxis: { value: primary, unit: 'AU' },
			secondaryBarycentricSemiMajorAxis: { value: secondary, unit: 'AU' },
		},
		diagnostics: [],
	}
}

export interface RelativeStateToBarycentricInput {
	relativeState: StateVectorOutput
	primaryMassKg: number
	secondaryMassKg: number
	barycentricFrameId: string
}

function validateRelativeState(
	state: StateVectorOutput,
	diagnostics: Diagnostic[],
): void {
	if (
		state == null
		|| typeof state !== 'object'
		|| state.position?.unit !== 'm'
		|| state.velocity?.unit !== 'm/s'
	) {
		diagnostics.push(issue(
			BINARY_DIAGNOSTIC_CODES.stateInvalid,
			'relativeState must contain metre position and metre-per-second velocity vectors',
			['relativeState'],
		))
		return
	}
	const values = [
		state.position.x,
		state.position.y,
		state.position.z,
		state.velocity.x,
		state.velocity.y,
		state.velocity.z,
	]
	if (!values.every(Number.isFinite)) {
		diagnostics.push(issue(
			BINARY_DIAGNOSTIC_CODES.stateInvalid,
			'relativeState vector components must be finite',
			['relativeState'],
		))
	}
	if (typeof state.frameId !== 'string' || state.frameId.trim().length === 0) {
		diagnostics.push(issue(
			BINARY_DIAGNOSTIC_CODES.frameInvalid,
			'relativeState.frameId must be a non-empty string',
			['relativeState.frameId'],
		))
	}
}

function scaleState(
	state: StateVectorOutput,
	factor: number,
	frameId: string,
): BinaryState {
	return {
		position: {
			x: state.position.x * factor,
			y: state.position.y * factor,
			z: state.position.z * factor,
			unit: 'm',
		},
		velocity: {
			x: state.velocity.x * factor,
			y: state.velocity.y * factor,
			z: state.velocity.z * factor,
			unit: 'm/s',
		},
		frameId,
	}
}

export function relativeStateToBarycentric(
	input: RelativeStateToBarycentricInput,
): ValidationResult<BinaryBarycentricStates> {
	const diagnostics = [
		positiveIssue(
			'primaryMassKg',
			input.primaryMassKg,
			BINARY_DIAGNOSTIC_CODES.primaryMassInvalid,
		),
		positiveIssue(
			'secondaryMassKg',
			input.secondaryMassKg,
			BINARY_DIAGNOSTIC_CODES.secondaryMassInvalid,
		),
	].filter(problem => problem != null)
	validateRelativeState(input.relativeState, diagnostics)
	if (
		typeof input.barycentricFrameId !== 'string'
		|| input.barycentricFrameId.trim().length === 0
	) {
		diagnostics.push(issue(
			BINARY_DIAGNOSTIC_CODES.frameInvalid,
			'barycentricFrameId must be a non-empty string',
			['barycentricFrameId'],
		))
	}
	if (diagnostics.length > 0) return { ok: false, diagnostics }

	const fractions = massFractions(input.primaryMassKg, input.secondaryMassKg)
	const primary = scaleState(input.relativeState, -fractions.primary, input.barycentricFrameId)
	const secondary = scaleState(
		input.relativeState,
		fractions.secondary,
		input.barycentricFrameId,
	)
	const values = [
		primary.position.x,
		primary.position.y,
		primary.position.z,
		primary.velocity.x,
		primary.velocity.y,
		primary.velocity.z,
		secondary.position.x,
		secondary.position.y,
		secondary.position.z,
		secondary.velocity.x,
		secondary.velocity.y,
		secondary.velocity.z,
	]
	if (!values.every(Number.isFinite)) {
		return {
			ok: false,
			diagnostics: [issue(
				BINARY_DIAGNOSTIC_CODES.outputInvalid,
				'Binary state conversion produced a non-finite output',
				['relativeState', 'primaryMassKg', 'secondaryMassKg'],
			)],
		}
	}
	return {
		ok: true,
		value: {
			primary,
			secondary,
			relativeFrameId: input.relativeState.frameId,
			barycentricFrameId: input.barycentricFrameId,
		},
		diagnostics: [],
	}
}
