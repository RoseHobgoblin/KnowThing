/**
 * Runtime scientific-result contracts. Unlike the branded numeric `Quantity`
 * type in `units`, these records survive JSON serialization with their units,
 * provenance and evaluation context intact.
 */

export type ModelKind =
	| 'exact-relation'
	| 'numerical-solution'
	| 'approximation'
	| 'empirical-fit'
	| 'screening'

export type UnitSymbol =
	| '1'
	| 'rad'
	| 'deg'
	| 's'
	| 'd'
	| 'm'
	| 'm/s'
	| 'm/s^2'
	| 'kg'
	| 'kg/m^3'
	| 'W'
	| 'm^3/s^2'
	| 'AU'

export interface QuantityRecord<U extends UnitSymbol = UnitSymbol> {
	value: number
	unit: U
}

export type InputSource = 'caller' | 'default' | 'derived'

/** A serialisable evaluated input. Categorical inputs do not carry a unit. */
export interface InputRecord {
	value: number | string | boolean
	unit?: UnitSymbol
	source: InputSource
}

export interface ModelSource {
	type: 'paper' | 'standard' | 'textbook' | 'derivation' | 'documentation'
	citation: string
	doi?: string
	url?: string
}

export type ValidityRule =
	| { field: string, operator: 'finite' }
	| { field: string, operator: 'gt' | 'gte' | 'lt' | 'lte', value: number, unit?: UnitSymbol }
	| { field: string, operator: 'one-of', values: readonly string[] }
	| { description: string }

export interface ModelReference {
	id: string
	version: string
	title: string
	summary: string
	kind: ModelKind
	sources: readonly ModelSource[]
	assumptions: readonly string[]
	validity: readonly ValidityRule[]
}

export type DiagnosticCategory =
	| 'invalid-input'
	| 'missing-input'
	| 'outside-domain'
	| 'numerical-failure'
	| 'approximation'
	| 'physical-warning'

export interface Diagnostic {
	/** Stable public identifier. Consumers must not parse `message`. */
	code: string
	category: DiagnosticCategory
	severity: 'info' | 'warning' | 'error'
	message: string
	fields: readonly string[]
	evidence?: Readonly<Record<string, number | string | boolean>>
	modelId: string
}

export interface NumericalQuality {
	method: string
	iterations?: number
	residual?: number
	tolerance?: number
	converged: boolean
}

export type ResultUncertainty =
	| { kind: 'not-provided' }
	| {
		kind: 'propagated'
		method: 'first-order' | 'interval' | 'monte-carlo'
		value: unknown
	}

interface ModelResultBase {
	model: ModelReference
	inputs: Readonly<Record<string, InputRecord>>
	diagnostics: readonly Diagnostic[]
}

export interface ModelSuccess<T> extends ModelResultBase {
	ok: true
	output: T
	numerical?: NumericalQuality
	uncertainty: ResultUncertainty
}

export interface ModelFailure extends ModelResultBase {
	ok: false
}

export type ModelResult<T> = ModelSuccess<T> | ModelFailure

export interface QuantityVector<U extends UnitSymbol> {
	x: number
	y: number
	z: number
	unit: U
}

export interface StateVectorOutput {
	position: QuantityVector<'m'>
	velocity: QuantityVector<'m/s'>
	frameId: string
}

export interface SatelliteStabilityOutput {
	limit: QuantityRecord<'AU'>
	hillFraction: QuantityRecord<'1'>
	orbitSense: 'prograde' | 'retrograde'
}

