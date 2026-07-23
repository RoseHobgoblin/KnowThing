import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	MODEL_IDS,
	runBenchmarkFixture,
	runBenchmarkFixtures,
	type BenchmarkFixture,
} from './index.js'

const fixtures = JSON.parse(readFileSync(
	new URL('../benchmarks/fixtures.json', import.meta.url),
	'utf8',
)) as BenchmarkFixture[]

describe('scientific benchmark corpus', () => {
	it('covers every initial catalogue model with sources and explicit tolerances', () => {
		expect(fixtures).toHaveLength(14)
		expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(fixtures.length)
		expect(new Set(fixtures.map(fixture => fixture.modelId))).toEqual(
			new Set(Object.values(MODEL_IDS)),
		)
		for (const fixture of fixtures) {
			expect(fixture.source?.citation.length).toBeGreaterThan(0)
			expect(
				fixture.tolerance.absolute != null || fixture.tolerance.relative != null,
			).toBe(true)
		}
	})

	it('passes every benchmark and emits a finite machine-readable report', () => {
		const report = runBenchmarkFixtures(fixtures, '2026-01-01T00:00:00.000Z')
		expect(report).toMatchObject({
			schemaVersion: '1.0.0',
			total: 14,
			passed: 14,
			failed: 0,
		})
		expect(JSON.stringify(report)).not.toMatch(/NaN|Infinity/)
		// This explicitly verifies the JSON contract rather than cloning application state.
		// eslint-disable-next-line unicorn/prefer-structured-clone
		expect(JSON.parse(JSON.stringify(report))).toEqual(report)
	})

	it('fails a scientifically meaningful drift outside tolerance', () => {
		const source = fixtures.find(fixture => fixture.modelId === MODEL_IDS.bulkDensity)
		if (!source) throw new Error('Missing density benchmark')
		const drifted: BenchmarkFixture = {
			...source,
			expected: {
				...source.expected,
				value: source.expected.value * 2,
			},
			tolerance: { relative: 1e-12 },
		}
		const result = runBenchmarkFixture(drifted)
		expect(result.passed).toBe(false)
		expect(result.message).toMatch(/exceeds/)
	})

	it('fails stale fixture model versions before comparing numbers', () => {
		const result = runBenchmarkFixture({
			...fixtures[0]!,
			modelVersion: '99.0.0',
		})
		expect(result.passed).toBe(false)
		expect(result.message).toMatch(/registry provides/)
	})

	it('rejects missing or negative tolerance budgets', () => {
		expect(runBenchmarkFixture({
			...fixtures[0]!,
			tolerance: {},
		}).passed).toBe(false)
		expect(runBenchmarkFixture({
			...fixtures[0]!,
			tolerance: { absolute: -1 },
		}).passed).toBe(false)
	})
})
