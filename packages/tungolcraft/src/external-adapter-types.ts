import type { Diagnostic, QuantityRecord, QuantityVector } from './model-types.js'
import type { ScenarioInput, TimeContext, ValidationResult } from './scenario-types.js'

export const EXTERNAL_RUN_SCHEMA_VERSION = '1.0.0'
export const EXTERNAL_ADAPTER_API_VERSION = '1.0.0'

export const EXTERNAL_ADAPTER_LIMITS = Object.freeze({
	maxBodies: 10_000,
	maxParameters: 1_000,
	maxSamples: 100_000,
	maxChannels: 1_000,
	maxJsonCharacters: 50_000_000,
})

export type ExternalEngineKind = 'dynamics' | 'climate'

export interface ExternalEngineReference {
	id: string
	version: string
	kind: ExternalEngineKind
	/** Human-readable engine or service name. */
	title: string
	url?: string
}

export interface ExternalParameter {
	id: string
	value: number | string | boolean
	/** Required for numeric values; intentionally engine-defined and never inferred. */
	unit?: string
}

export interface ExternalRunWindow {
	startOffset: QuantityRecord<'s'>
	duration: QuantityRecord<'s'>
	outputInterval: QuantityRecord<'s'>
}

export interface ExternalStateVector {
	position: QuantityVector<'m'>
	velocity: QuantityVector<'m/s'>
	frameId: string
}

export interface ExternalDynamicsBody {
	id: string
	mass: QuantityRecord<'kg'>
	initialState: ExternalStateVector
}

interface ExternalRunRequestBase {
	schemaVersion: typeof EXTERNAL_RUN_SCHEMA_VERSION
	requestId: string
	scenarioId?: string
	engine: ExternalEngineReference
	time: TimeContext
	window: ExternalRunWindow
	parameters: readonly ExternalParameter[]
}

export interface ExternalDynamicsRunRequest extends ExternalRunRequestBase {
	kind: 'dynamics'
	engine: ExternalEngineReference & { kind: 'dynamics' }
	frameId: string
	bodies: readonly ExternalDynamicsBody[]
}

export interface ClimateBoundaryCondition {
	id: string
	quantity: { value: number, unit: string }
}

export interface ExternalClimateRunRequest extends ExternalRunRequestBase {
	kind: 'climate'
	engine: ExternalEngineReference & { kind: 'climate' }
	bodyId: string
	boundaryConditions: readonly ClimateBoundaryCondition[]
}

export type ExternalRunRequest = ExternalDynamicsRunRequest | ExternalClimateRunRequest

export interface ExternalDynamicsStateSample {
	timeOffset: QuantityRecord<'s'>
	bodies: readonly ({ id: string } & ExternalStateVector)[]
}

export interface ExternalClimateValueSample {
	timeOffset: QuantityRecord<'s'>
	value: number
}

export interface ExternalClimateChannel {
	id: string
	unit: string
	samples: readonly ExternalClimateValueSample[]
}

export interface ExternalRunProvenance {
	engine: ExternalEngineReference
	adapter: { id: string, version: string }
}

interface ExternalRunResultBase {
	schemaVersion: typeof EXTERNAL_RUN_SCHEMA_VERSION
	requestId: string
	scenarioId?: string
	kind: ExternalEngineKind
	provenance: ExternalRunProvenance
	diagnostics: readonly Diagnostic[]
}

export interface ExternalDynamicsRunSuccess extends ExternalRunResultBase {
	ok: true
	kind: 'dynamics'
	output: {
		frameId: string
		samples: readonly ExternalDynamicsStateSample[]
	}
}

export interface ExternalClimateRunSuccess extends ExternalRunResultBase {
	ok: true
	kind: 'climate'
	output: { channels: readonly ExternalClimateChannel[] }
}

export interface ExternalRunFailure extends ExternalRunResultBase {
	ok: false
}

export type ExternalRunResult =
	| ExternalDynamicsRunSuccess
	| ExternalClimateRunSuccess
	| ExternalRunFailure

export interface PrepareDynamicsRunInput {
	scenario: ScenarioInput
	requestId: string
	engine: ExternalEngineReference & { kind: 'dynamics' }
	window: ExternalRunWindow
	frameId: string
	states: Readonly<Record<string, ExternalStateVector>>
	bodyIds?: readonly string[]
	parameters?: readonly ExternalParameter[]
}

export interface PrepareClimateRunInput {
	scenario: ScenarioInput
	requestId: string
	engine: ExternalEngineReference & { kind: 'climate' }
	window: ExternalRunWindow
	bodyId: string
	boundaryConditions: readonly ClimateBoundaryCondition[]
	parameters?: readonly ExternalParameter[]
}

/**
 * An adapter owns transport and engine-specific encoding. Tungolcraft owns the
 * validated public request and normalized public result on either side.
 */
export interface ExternalEngineAdapter<PreparedRequest = unknown, RawResponse = unknown> {
	id: string
	version: string
	engine: ExternalEngineReference
	prepare(request: ExternalRunRequest): PreparedRequest | Promise<PreparedRequest>
	execute(request: PreparedRequest): RawResponse | Promise<RawResponse>
	interpret(response: RawResponse, request: ExternalRunRequest): unknown | Promise<unknown>
}

export type ExternalPreparationResult<T extends ExternalRunRequest> = ValidationResult<T>
