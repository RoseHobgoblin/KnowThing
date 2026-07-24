import {
	evaluateCatalogueModel,
	isUnitSymbol,
	readCatalogueQuantity,
} from './catalogue-runner.js'
import { getModelReference, type ModelId } from './model-registry.js'
import type {
	InputRecord,
	ModelResult,
	ModelSource,
	QuantityRecord,
} from './model-types.js'

export interface BenchmarkTolerance {
	absolute?: number
	relative?: number
}

export interface BenchmarkFixture {
	id: string
	modelId: ModelId
	modelVersion: string
	inputs: Readonly<Record<string, InputRecord>>
	/** Dot path within a composite output; omitted for scalar QuantityRecord outputs. */
	outputPath?: string
	expected: QuantityRecord
	tolerance: BenchmarkTolerance
	source?: ModelSource
	notes?: string
}

export interface BenchmarkResult {
	id: string
	modelId: ModelId
	modelVersion: string
	passed: boolean
	expected: QuantityRecord
	actual?: QuantityRecord
	tolerance: BenchmarkTolerance
	absoluteError?: number
	relativeError?: number | null
	allowedAbsoluteError?: number
	message?: string
}

export interface BenchmarkReport {
	schemaVersion: '1.0.0'
	generatedAt: string
	total: number
	passed: number
	failed: number
	results: readonly BenchmarkResult[]
}

function evaluatedInputs(
	inputs: Readonly<Record<string, InputRecord>>,
): Record<string, number | string | boolean> {
	return Object.fromEntries(
		Object.entries(inputs).map(([field, input]) => [field, input.value]),
	)
}

function evaluateFixture(fixture: BenchmarkFixture): ModelResult<unknown> {
	return evaluateCatalogueModel(fixture.modelId, evaluatedInputs(fixture.inputs))
}

function invalidFixtureResult(fixture: BenchmarkFixture, message: string): BenchmarkResult {
	return {
		id: fixture.id,
		modelId: fixture.modelId,
		modelVersion: fixture.modelVersion,
		passed: false,
		expected: fixture.expected,
		tolerance: fixture.tolerance,
		message,
	}
}

export function runBenchmarkFixture(fixture: BenchmarkFixture): BenchmarkResult {
	const reference = getModelReference(fixture.modelId)
	if (reference == null) {
		return invalidFixtureResult(fixture, `Unknown model ID ${String(fixture.modelId)}`)
	}
	if (reference.version !== fixture.modelVersion) {
		return invalidFixtureResult(
			fixture,
			`Fixture expects model ${fixture.modelVersion}, registry provides ${reference.version}`,
		)
	}
	const { absolute, relative } = fixture.tolerance
	if (absolute == null && relative == null) {
		return invalidFixtureResult(fixture, 'Fixture must declare a non-negative tolerance')
	}
	if (
		(absolute != null && (!Number.isFinite(absolute) || absolute < 0))
		|| (relative != null && (!Number.isFinite(relative) || relative < 0))
	) {
		return invalidFixtureResult(fixture, 'Fixture tolerances must be finite and non-negative')
	}
	if (!Number.isFinite(fixture.expected.value) || !isUnitSymbol(fixture.expected.unit)) {
		return invalidFixtureResult(fixture, 'Fixture expected value or unit is invalid')
	}
	const result = evaluateFixture(fixture)
	if (!result.ok) {
		return invalidFixtureResult(
			fixture,
			`Model evaluation failed: ${result.diagnostics.map(item => item.code).join(', ')}`,
		)
	}
	const actual = readCatalogueQuantity(result.output, fixture.outputPath)
	if (!actual) {
		return invalidFixtureResult(
			fixture,
			`Output path ${fixture.outputPath ?? '<root>'} did not resolve to a quantity`,
		)
	}
	if (actual.unit !== fixture.expected.unit) {
		return {
			...invalidFixtureResult(
				fixture,
				`Expected unit ${fixture.expected.unit}, received ${actual.unit}`,
			),
			actual,
		}
	}
	const absoluteError = Math.abs(actual.value - fixture.expected.value)
	const relativeError = fixture.expected.value === 0
		? (absoluteError === 0 ? 0 : null)
		: absoluteError / Math.abs(fixture.expected.value)
	const allowedAbsoluteError = (fixture.tolerance.absolute ?? 0)
		+ (fixture.tolerance.relative ?? 0) * Math.abs(fixture.expected.value)
	const passed = Number.isFinite(actual.value) && absoluteError <= allowedAbsoluteError
	const message = passed
		? undefined
		: `Absolute error ${absoluteError} exceeds ${allowedAbsoluteError}`
	return {
		id: fixture.id,
		modelId: fixture.modelId,
		modelVersion: fixture.modelVersion,
		passed,
		expected: fixture.expected,
		actual,
		tolerance: fixture.tolerance,
		absoluteError,
		relativeError,
		allowedAbsoluteError,
		...(message == null ? {} : { message }),
	}
}

export function runBenchmarkFixtures(
	fixtures: readonly BenchmarkFixture[],
	generatedAt = new Date().toISOString(),
): BenchmarkReport {
	const results = fixtures.map(runBenchmarkFixture)
	const passed = results.filter(result => result.passed).length
	return {
		schemaVersion: '1.0.0',
		generatedAt,
		total: results.length,
		passed,
		failed: results.length - passed,
		results,
	}
}
