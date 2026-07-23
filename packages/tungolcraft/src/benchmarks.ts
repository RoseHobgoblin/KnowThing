import {
	evaluateBulkDensity,
	evaluateEllipticalState,
	evaluateEscapeVelocity,
	evaluateHillRadius,
	evaluateKeplerPeriod,
	evaluateMeanSpeed,
	evaluateParentBarycenterDistance,
	evaluateRocheLimit,
	evaluateRotationalBreakup,
	evaluateSatelliteStability,
	evaluateSimpleHabitableZone,
	evaluateStefanBoltzmannLuminosity,
	evaluateSurfaceGravity,
	evaluateVisVivaSpeed,
} from './catalogue.js'
import { getModelReference, type ModelId } from './model-registry.js'
import type {
	InputRecord,
	ModelResult,
	ModelSource,
	QuantityRecord,
	UnitSymbol,
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
	const input = evaluatedInputs(fixture.inputs)
	switch (fixture.modelId) {
		case 'body.bulk-density': return evaluateBulkDensity(input as never)
		case 'body.surface-gravity': return evaluateSurfaceGravity(input as never)
		case 'body.escape-velocity': return evaluateEscapeVelocity(input as never)
		case 'body.rotational-breakup': return evaluateRotationalBreakup(input as never)
		case 'orbit.kepler-period': return evaluateKeplerPeriod(input as never)
		case 'orbit.vis-viva-speed': return evaluateVisVivaSpeed(input as never)
		case 'orbit.mean-speed': return evaluateMeanSpeed(input as never)
		case 'orbit.elliptical-state': return evaluateEllipticalState(input as never)
		case 'orbit.hill-radius': return evaluateHillRadius(input as never)
		case 'binary.parent-barycenter-distance':
			return evaluateParentBarycenterDistance(input as never)
		case 'satellite.domingos-2006-limit':
			return evaluateSatelliteStability(input as never)
		case 'satellite.roche-limit': return evaluateRocheLimit(input as never)
		case 'star.stefan-boltzmann-luminosity':
			return evaluateStefanBoltzmannLuminosity(input as never)
		case 'star.simple-habitable-zone': return evaluateSimpleHabitableZone(input as never)
	}
}

function isUnit(value: unknown): value is UnitSymbol {
	return typeof value === 'string' && [
		'1',
		'rad',
		'deg',
		's',
		'd',
		'm',
		'm/s',
		'm/s^2',
		'kg',
		'kg/m^3',
		'W',
		'K',
		'm^3/s^2',
		'AU',
	].includes(value)
}

function readQuantity(output: unknown, path?: string): QuantityRecord | null {
	let value = output
	let parent: unknown
	for (const segment of path?.split('.').filter(Boolean) ?? []) {
		if (value == null || typeof value !== 'object') return null
		parent = value
		value = (value as Record<string, unknown>)[segment]
	}
	if (
		value != null
		&& typeof value === 'object'
		&& typeof (value as Record<string, unknown>).value === 'number'
		&& isUnit((value as Record<string, unknown>).unit)
	) {
		return {
			value: (value as Record<string, number>).value,
			unit: (value as Record<string, UnitSymbol>).unit,
		}
	}
	if (
		typeof value === 'number'
		&& parent != null
		&& typeof parent === 'object'
		&& isUnit((parent as Record<string, unknown>).unit)
	) {
		return { value, unit: (parent as Record<string, UnitSymbol>).unit }
	}
	return null
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
	if (!Number.isFinite(fixture.expected.value) || !isUnit(fixture.expected.unit)) {
		return invalidFixtureResult(fixture, 'Fixture expected value or unit is invalid')
	}
	const result = evaluateFixture(fixture)
	if (!result.ok) {
		return invalidFixtureResult(
			fixture,
			`Model evaluation failed: ${result.diagnostics.map(item => item.code).join(', ')}`,
		)
	}
	const actual = readQuantity(result.output, fixture.outputPath)
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
