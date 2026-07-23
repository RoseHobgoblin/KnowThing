import type {
	Diagnostic,
	ModelResult,
	QuantityRecord,
	QuantityVector,
} from './model-types.js'

export const SCENARIO_SCHEMA_VERSION = '1.0.0'
export const SCENARIO_REPORT_SCHEMA_VERSION = '1.0.0'

export const SCENARIO_LIMITS = Object.freeze({
	maxBodies: 10_000,
	maxFrames: 1_000,
	maxDependencyDepth: 256,
	maxJsonCharacters: 5_000_000,
})

export type TimeScale = 'model-day' | 'UTC' | 'TAI' | 'TT' | 'TDB'

export interface TimeContext {
	/** Caller-defined epoch label; no implicit time-scale conversion is performed. */
	epoch: string
	scale: TimeScale
	secondsPerDay: number
}

export type ReferencePlane = 'xy-reference' | 'ecliptic' | 'equatorial' | 'custom'

export interface ReferenceFrame {
	id: string
	originBodyId: string
	plane: ReferencePlane
	/** Human-readable positive-axis and orientation definition. */
	direction: string
	handedness: 'right'
}

export type OrbitAxisMeaning =
	| 'parent-centred'
	| 'relative-separation'
	| 'barycentric-component'

export interface EllipticalOrbitRecord {
	kind: 'elliptical'
	primaryId: string
	frameId: string
	semiMajorAxis: QuantityRecord<'AU'>
	axisMeaning: OrbitAxisMeaning
	eccentricity: QuantityRecord<'1'>
	inclination: QuantityRecord<'deg'>
	longitudeAscendingNode: QuantityRecord<'deg'>
	argumentOfPeriapsis: QuantityRecord<'deg'>
	epochPhase: QuantityRecord<'1'>
	mu: QuantityRecord<'m^3/s^2'>
}

export type ScenarioBodyKind =
	| 'star'
	| 'planet'
	| 'moon'
	| 'minor-body'
	| 'barycenter'
	| 'other'

/** Scientific fields only. Names, prose and application classifications live in BodyMetadata. */
export interface ScientificBody {
	id: string
	kind: ScenarioBodyKind
	mass?: QuantityRecord<'kg'>
	radius?: QuantityRecord<'m'>
	luminosity?: QuantityRecord<'W'>
	temperature?: QuantityRecord<'K'>
	orbit?: EllipticalOrbitRecord
}

/** Optional lore/presentation data kept outside the scientific calculation record. */
export interface BodyMetadata {
	bodyId: string
	name?: string
	description?: string
	classifications?: readonly string[]
	fields?: Readonly<Record<string, string | number | boolean>>
}

export interface ScenarioInput {
	schemaVersion: typeof SCENARIO_SCHEMA_VERSION
	scenarioId?: string
	time: TimeContext
	frames: readonly ReferenceFrame[]
	bodies: readonly ScientificBody[]
	metadata?: readonly BodyMetadata[]
}

export interface ScenarioReport {
	schemaVersion: typeof SCENARIO_REPORT_SCHEMA_VERSION
	scenarioId?: string
	time: TimeContext
	frames: readonly ReferenceFrame[]
	results: Readonly<Record<string, ModelResult<unknown>>>
	diagnostics: readonly Diagnostic[]
	dependencyGraph: Readonly<Record<string, readonly string[]>>
}

export type ValidationResult<T> =
	| { ok: true, value: T, diagnostics: readonly Diagnostic[] }
	| { ok: false, diagnostics: readonly Diagnostic[] }

export type SerializationResult =
	| { ok: true, json: string, diagnostics: readonly Diagnostic[] }
	| { ok: false, diagnostics: readonly Diagnostic[] }

export interface BinaryAxisPartition {
	relativeSemiMajorAxis: QuantityRecord<'AU'>
	primaryBarycentricSemiMajorAxis: QuantityRecord<'AU'>
	secondaryBarycentricSemiMajorAxis: QuantityRecord<'AU'>
}

export interface BinaryState {
	position: QuantityVector<'m'>
	velocity: QuantityVector<'m/s'>
	frameId: string
}

export interface BinaryBarycentricStates {
	primary: BinaryState
	secondary: BinaryState
	relativeFrameId: string
	barycentricFrameId: string
}
