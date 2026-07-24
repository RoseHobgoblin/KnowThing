import {
	evaluateCatalogueModel,
	readCatalogueQuantity,
	type CatalogueInputValues,
} from './catalogue-runner.js'
import type { ModelId } from './model-registry.js'
import type {
	Diagnostic,
	InputRecord,
	ModelFailure,
	ModelResult,
	ModelSuccess,
	ResultUncertainty,
	Uncertainty,
	UnitSymbol,
} from './model-types.js'
import { SCENARIO_LIMITS } from './scenario-types.js'

export const UNCERTAINTY_DIAGNOSTIC_CODES = {
	inputInvalid: 'uncertainty.input.invalid',
	unitMismatch: 'uncertainty.unit.mismatch',
	methodIncompatible: 'uncertainty.method.incompatible',
	dependenceRequired: 'uncertainty.dependence.required',
	outputInvalid: 'uncertainty.output.invalid',
	resourceLimit: 'uncertainty.resource-limit',
	evaluationFailed: 'uncertainty.evaluation.failed',
} as const

export interface UncertaintyPropagationRequest {
	modelId: ModelId
	inputs: Readonly<Record<string, InputRecord>>
	/** Dot path for a scalar member of a composite output, such as `position.x`. */
	outputPath?: string
}

export type UncertaintyPropagationOptions =
	| {
		method: 'first-order'
		/** Required when two or more uncertain inputs are propagated. */
		assumeIndependent?: true
	}
	| {
		method: 'interval'
	}
	| {
		method: 'monte-carlo'
		seed: number
		sampleCount: number
		samplingPolicy: 'normal' | 'uniform' | 'empirical'
		/** Required when two or more uncertain inputs are sampled. */
		assumeIndependent?: true
	}

interface NumericUncertainInput {
	field: string
	value: number
	unit: UnitSymbol
	uncertainty: Uncertainty
}

function evaluatedInputs(
	inputs: Readonly<Record<string, InputRecord>>,
): Record<string, number | string | boolean> {
	return Object.fromEntries(
		Object.entries(inputs).map(([field, input]) => [field, input.value]),
	)
}

function diagnostic(
	modelId: string,
	code: string,
	message: string,
	fields: readonly string[],
	evidence?: Diagnostic['evidence'],
): Diagnostic {
	return {
		code,
		category: code === UNCERTAINTY_DIAGNOSTIC_CODES.evaluationFailed
			? 'numerical-failure'
			: 'invalid-input',
		severity: 'error',
		message,
		fields,
		...(evidence ? { evidence } : {}),
		modelId,
	}
}

function withSuppliedUncertainty(
	evaluated: Readonly<Record<string, InputRecord>>,
	supplied: Readonly<Record<string, InputRecord>>,
): Readonly<Record<string, InputRecord>> {
	return Object.fromEntries(Object.entries(evaluated).map(([field, input]) => {
		const uncertainty = supplied[field]?.uncertainty
		return [field, uncertainty == null ? input : { ...input, uncertainty }]
	}))
}

function failure(
	result: ModelResult<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	issue: Diagnostic,
): ModelFailure {
	return {
		ok: false,
		model: result.model,
		inputs,
		diagnostics: [...result.diagnostics, issue],
	}
}

function propagated(
	result: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	uncertainty: ResultUncertainty,
): ModelSuccess<unknown> {
	return { ...result, inputs, uncertainty }
}

function validateUncertainty(
	input: InputRecord,
	field: string,
	modelId: string,
): Diagnostic | null {
	const uncertainty = input.uncertainty
	if (uncertainty == null) return null
	if (typeof input.value !== 'number' || input.unit == null) {
		return diagnostic(
			modelId,
			UNCERTAINTY_DIAGNOSTIC_CODES.inputInvalid,
			`${field} uncertainty requires a numeric input with a unit`,
			[field],
		)
	}
	if (uncertainty.unit !== input.unit) {
		return diagnostic(
			modelId,
			UNCERTAINTY_DIAGNOSTIC_CODES.unitMismatch,
			`${field} uncertainty unit must match the evaluated input unit`,
			[field],
			{ inputUnit: input.unit, uncertaintyUnit: uncertainty.unit },
		)
	}
	switch (uncertainty.kind) {
		case 'standard-deviation':
			if (Number.isFinite(uncertainty.value) && uncertainty.value >= 0) return null
			break
		case 'interval':
			if (
				Number.isFinite(uncertainty.lower)
				&& Number.isFinite(uncertainty.upper)
				&& uncertainty.lower <= input.value
				&& input.value <= uncertainty.upper
				&& (uncertainty.confidence == null || (
					Number.isFinite(uncertainty.confidence)
					&& uncertainty.confidence > 0
					&& uncertainty.confidence <= 1
				))
			) return null
			break
		case 'samples':
			if (
				uncertainty.values.length > 0
				&& uncertainty.values.length <= SCENARIO_LIMITS.maxInputSamples
				&& uncertainty.values.every(Number.isFinite)
			) return null
			break
	}
	return diagnostic(
		modelId,
		UNCERTAINTY_DIAGNOSTIC_CODES.inputInvalid,
		`${field} has an invalid ${uncertainty.kind} uncertainty`,
		[field],
	)
}

function evaluateQuantity(
	modelId: ModelId,
	values: CatalogueInputValues,
	outputPath: string | undefined,
): { result: ModelResult<unknown>, value?: number, unit?: UnitSymbol } {
	const result = evaluateCatalogueModel(modelId, values)
	if (!result.ok) return { result }
	const quantity = readCatalogueQuantity(result.output, outputPath)
	if (quantity == null || !Number.isFinite(quantity.value)) return { result }
	return { result, value: quantity.value, unit: quantity.unit }
}

function evaluationFailure(
	nominal: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	fields: readonly string[],
	evaluation: number,
): ModelFailure {
	return failure(nominal, inputs, diagnostic(
		nominal.model.id,
		UNCERTAINTY_DIAGNOSTIC_CODES.evaluationFailed,
		'An uncertainty evaluation left the model domain or did not produce the requested quantity',
		fields,
		{ evaluation },
	))
}

function dependenceFailure(
	nominal: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	fields: readonly string[],
): ModelFailure {
	return failure(nominal, inputs, diagnostic(
		nominal.model.id,
		UNCERTAINTY_DIAGNOSTIC_CODES.dependenceRequired,
		'Multiple uncertain inputs require assumeIndependent: true; correlations are not inferred',
		fields,
		{ uncertainInputs: fields.length },
	))
}

function propagateFirstOrder(
	request: UncertaintyPropagationRequest,
	options: Extract<UncertaintyPropagationOptions, { method: 'first-order' }>,
	nominal: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	values: Record<string, number | string | boolean>,
	uncertain: readonly NumericUncertainInput[],
	outputUnit: UnitSymbol,
): ModelResult<unknown> {
	if (uncertain.some(item => item.uncertainty.kind !== 'standard-deviation')) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.methodIncompatible,
			'First-order propagation requires standard-deviation input uncertainties',
			uncertain.map(item => item.field),
		))
	}
	if (uncertain.length > 1 && options.assumeIndependent !== true) {
		return dependenceFailure(nominal, inputs, uncertain.map(item => item.field))
	}

	let variance = 0
	let evaluations = 1
	for (const item of uncertain) {
		const sigma = item.uncertainty.kind === 'standard-deviation'
			? item.uncertainty.value
			: 0
		const step = Math.max(Math.abs(item.value) * 1e-6, sigma * 1e-4, 1e-12)
		const lower = evaluateQuantity(
			request.modelId,
			{ ...values, [item.field]: item.value - step },
			request.outputPath,
		)
		const upper = evaluateQuantity(
			request.modelId,
			{ ...values, [item.field]: item.value + step },
			request.outputPath,
		)
		evaluations += 2
		if (
			lower.value == null
			|| upper.value == null
			|| lower.unit !== outputUnit
			|| upper.unit !== outputUnit
		) {
			return evaluationFailure(nominal, inputs, [item.field], evaluations)
		}
		const derivative = (upper.value - lower.value) / (2 * step)
		variance += (derivative * sigma) ** 2
	}
	const standardDeviation = Math.sqrt(variance)
	if (!Number.isFinite(standardDeviation)) {
		return evaluationFailure(nominal, inputs, uncertain.map(item => item.field), evaluations)
	}
	return propagated(nominal, inputs, {
		kind: 'propagated',
		method: 'first-order',
		value: { kind: 'standard-deviation', value: standardDeviation, unit: outputUnit },
		...(request.outputPath == null ? {} : { outputPath: request.outputPath }),
		dependence: uncertain.length === 1 ? 'single-input' : 'independent',
		evaluations,
	})
}

function propagateInterval(
	request: UncertaintyPropagationRequest,
	nominal: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	values: Record<string, number | string | boolean>,
	uncertain: readonly NumericUncertainInput[],
	outputUnit: UnitSymbol,
): ModelResult<unknown> {
	if (uncertain.some(item => item.uncertainty.kind !== 'interval')) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.methodIncompatible,
			'Interval propagation requires interval input uncertainties',
			uncertain.map(item => item.field),
		))
	}
	const cornerCount = 2 ** uncertain.length
	if (cornerCount > SCENARIO_LIMITS.maxIntervalEvaluations) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.resourceLimit,
			`Interval propagation exceeds ${SCENARIO_LIMITS.maxIntervalEvaluations} corner evaluations`,
			uncertain.map(item => item.field),
			{ evaluations: cornerCount, limit: SCENARIO_LIMITS.maxIntervalEvaluations },
		))
	}

	let lower = Number.POSITIVE_INFINITY
	let upper = Number.NEGATIVE_INFINITY
	for (let corner = 0; corner < cornerCount; corner += 1) {
		const sample = { ...values }
		for (const [index, item] of uncertain.entries()) {
			const interval = item.uncertainty
			if (interval.kind !== 'interval') continue
			sample[item.field] = (corner & (1 << index)) === 0
				? interval.lower
				: interval.upper
		}
		const evaluation = evaluateQuantity(request.modelId, sample, request.outputPath)
		if (evaluation.value == null || evaluation.unit !== outputUnit) {
			return evaluationFailure(
				nominal,
				inputs,
				uncertain.map(item => item.field),
				corner + 1,
			)
		}
		lower = Math.min(lower, evaluation.value)
		upper = Math.max(upper, evaluation.value)
	}
	return propagated(nominal, inputs, {
		kind: 'propagated',
		method: 'interval',
		value: { kind: 'interval', lower, upper, unit: outputUnit },
		...(request.outputPath == null ? {} : { outputPath: request.outputPath }),
		dependence: 'bounds-only',
		evaluations: cornerCount + 1,
	})
}

function randomGenerator(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state += 0x6D2B79F5
		let value = state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
	}
}

function standardNormal(random: () => number): number {
	const first = Math.max(random(), Number.EPSILON)
	return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random())
}

function sampleInput(
	item: NumericUncertainInput,
	policy: Extract<UncertaintyPropagationOptions, { method: 'monte-carlo' }>['samplingPolicy'],
	random: () => number,
): number | null {
	const uncertainty = item.uncertainty
	if (policy === 'normal' && uncertainty.kind === 'standard-deviation') {
		return item.value + uncertainty.value * standardNormal(random)
	}
	if (policy === 'uniform' && uncertainty.kind === 'interval') {
		return uncertainty.lower + random() * (uncertainty.upper - uncertainty.lower)
	}
	if (policy === 'empirical' && uncertainty.kind === 'samples') {
		return uncertainty.values[Math.floor(random() * uncertainty.values.length)] ?? null
	}
	return null
}

function propagateMonteCarlo(
	request: UncertaintyPropagationRequest,
	options: Extract<UncertaintyPropagationOptions, { method: 'monte-carlo' }>,
	nominal: ModelSuccess<unknown>,
	inputs: Readonly<Record<string, InputRecord>>,
	values: Record<string, number | string | boolean>,
	uncertain: readonly NumericUncertainInput[],
	outputUnit: UnitSymbol,
): ModelResult<unknown> {
	if (
		!Number.isInteger(options.seed)
		|| options.seed < 0
		|| options.seed > 0xFFFF_FFFF
		|| !Number.isInteger(options.sampleCount)
		|| options.sampleCount < 1
	) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.inputInvalid,
			'Monte Carlo seed must be a uint32 and sampleCount must be a positive integer',
			[],
		))
	}
	if (options.sampleCount > SCENARIO_LIMITS.maxMonteCarloSamples) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.resourceLimit,
			`Monte Carlo sampleCount exceeds ${SCENARIO_LIMITS.maxMonteCarloSamples}`,
			[],
			{ sampleCount: options.sampleCount, limit: SCENARIO_LIMITS.maxMonteCarloSamples },
		))
	}
	if (uncertain.length > 1 && options.assumeIndependent !== true) {
		return dependenceFailure(nominal, inputs, uncertain.map(item => item.field))
	}
	if (uncertain.some(item => sampleInput(item, options.samplingPolicy, () => 0.5) == null)) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.methodIncompatible,
			`Sampling policy ${options.samplingPolicy} does not match every input uncertainty kind`,
			uncertain.map(item => item.field),
		))
	}

	const random = randomGenerator(options.seed)
	const samples: number[] = []
	for (let index = 0; index < options.sampleCount; index += 1) {
		const sample = { ...values }
		for (const item of uncertain) {
			const sampledValue = sampleInput(item, options.samplingPolicy, random)
			if (sampledValue == null) {
				return evaluationFailure(nominal, inputs, [item.field], index + 1)
			}
			sample[item.field] = sampledValue
		}
		const evaluation = evaluateQuantity(request.modelId, sample, request.outputPath)
		if (evaluation.value == null || evaluation.unit !== outputUnit) {
			return evaluationFailure(
				nominal,
				inputs,
				uncertain.map(item => item.field),
				index + 1,
			)
		}
		samples.push(evaluation.value)
	}
	return propagated(nominal, inputs, {
		kind: 'propagated',
		method: 'monte-carlo',
		value: { kind: 'samples', values: samples, unit: outputUnit },
		...(request.outputPath == null ? {} : { outputPath: request.outputPath }),
		dependence: uncertain.length === 1 ? 'single-input' : 'independent',
		seed: options.seed,
		sampleCount: options.sampleCount,
		samplingPolicy: options.samplingPolicy,
		evaluations: options.sampleCount + 1,
	})
}

/**
 * Propagate declared input uncertainty through one scalar catalogue output.
 * The nominal model output remains the result output; propagation metadata and
 * the output distribution or bound are attached to `result.uncertainty`.
 */
export function propagateCatalogueUncertainty(
	request: UncertaintyPropagationRequest,
	options: UncertaintyPropagationOptions,
): ModelResult<unknown> {
	const values = evaluatedInputs(request.inputs)
	const nominal = evaluateCatalogueModel(request.modelId, values)
	const inputs = withSuppliedUncertainty(nominal.inputs, request.inputs)
	if (!nominal.ok) return { ...nominal, inputs }
	if (
		request.outputPath != null
		&& !/^[A-Z_a-z]\w*(?:\.[A-Z_a-z]\w*)*$/.test(request.outputPath)
	) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.outputInvalid,
			'outputPath must be a non-empty dot-separated field path',
			['outputPath'],
		))
	}

	const quantity = readCatalogueQuantity(nominal.output, request.outputPath)
	if (quantity == null || !Number.isFinite(quantity.value)) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.outputInvalid,
			`Output path ${request.outputPath ?? '<root>'} does not resolve to a finite quantity`,
			[],
		))
	}

	const uncertain: NumericUncertainInput[] = []
	for (const [field, input] of Object.entries(request.inputs)) {
		const issue = validateUncertainty(input, field, nominal.model.id)
		if (issue) return failure(nominal, inputs, issue)
		if (input.uncertainty == null) continue
		const evaluated = nominal.inputs[field]
		if (
			evaluated == null
			|| typeof input.value !== 'number'
			|| input.unit == null
			|| evaluated.unit !== input.unit
		) {
			return failure(nominal, inputs, diagnostic(
				nominal.model.id,
				UNCERTAINTY_DIAGNOSTIC_CODES.unitMismatch,
				`${field} does not match a numeric evaluated model input and unit`,
				[field],
			))
		}
		uncertain.push({
			field,
			value: input.value,
			unit: input.unit,
			uncertainty: input.uncertainty,
		})
	}
	if (uncertain.length === 0) return { ...nominal, inputs }
	if (uncertain.length > SCENARIO_LIMITS.maxUncertainInputs) {
		return failure(nominal, inputs, diagnostic(
			nominal.model.id,
			UNCERTAINTY_DIAGNOSTIC_CODES.resourceLimit,
			`Uncertain input count exceeds ${SCENARIO_LIMITS.maxUncertainInputs}`,
			uncertain.map(item => item.field),
			{ uncertainInputs: uncertain.length, limit: SCENARIO_LIMITS.maxUncertainInputs },
		))
	}

	switch (options.method) {
		case 'first-order':
			return propagateFirstOrder(
				request,
				options,
				nominal,
				inputs,
				values,
				uncertain,
				quantity.unit,
			)
		case 'interval':
			return propagateInterval(
				request,
				nominal,
				inputs,
				values,
				uncertain,
				quantity.unit,
			)
		case 'monte-carlo':
			return propagateMonteCarlo(
				request,
				options,
				nominal,
				inputs,
				values,
				uncertain,
				quantity.unit,
			)
	}
}
