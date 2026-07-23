import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	BINARY_DIAGNOSTIC_CODES,
	NOMINAL_SOLAR_GM,
	SCENARIO_DIAGNOSTIC_CODES,
	SCENARIO_REPORT_SCHEMA_VERSION,
	SCENARIO_SCHEMA_VERSION,
	createScenarioReport,
	evaluateBulkDensity,
	parseScenarioJson,
	parseScenarioReportJson,
	partitionBinaryRelativeAxis,
	relativeStateToBarycentric,
	serializeScenario,
	serializeScenarioReport,
	validateScenario,
	validateScenarioReport,
	type Diagnostic,
	type ScenarioInput,
	type ScenarioReport,
	type StateVectorOutput,
	type ValidationResult,
} from './index.js'

function validScenario(): ScenarioInput {
	return {
		schemaVersion: SCENARIO_SCHEMA_VERSION,
		scenarioId: 'solar-screen',
		time: {
			epoch: 'J2000',
			scale: 'TDB',
			secondsPerDay: 86_400,
		},
		frames: [{
			id: 'sun-ecliptic',
			originBodyId: 'sun',
			plane: 'ecliptic',
			direction: '+X toward the J2000 mean equinox',
			handedness: 'right',
		}],
		bodies: [
			{
				id: 'sun',
				kind: 'star',
				mass: { value: 1.989e30, unit: 'kg' },
				radius: { value: 6.9634e8, unit: 'm' },
			},
			{
				id: 'earth-model',
				kind: 'planet',
				mass: { value: 5.972e24, unit: 'kg' },
				radius: { value: 6.371e6, unit: 'm' },
				orbit: {
					kind: 'elliptical',
					primaryId: 'sun',
					frameId: 'sun-ecliptic',
					semiMajorAxis: { value: 1, unit: 'AU' },
					axisMeaning: 'parent-centred',
					eccentricity: { value: 0.0167, unit: '1' },
					inclination: { value: 0, unit: 'deg' },
					longitudeAscendingNode: { value: 0, unit: 'deg' },
					argumentOfPeriapsis: { value: 102.9, unit: 'deg' },
					epochPhase: { value: 0, unit: '1' },
					mu: { value: NOMINAL_SOLAR_GM, unit: 'm^3/s^2' },
				},
			},
		],
		metadata: [{
			bodyId: 'earth-model',
			name: 'Reference Earth model',
			description: 'Presentation data kept outside the scientific body.',
			classifications: ['terrestrial'],
			fields: { colour: 'blue' },
		}],
	}
}

function expectFailure(result: ValidationResult<unknown>, code: string): readonly Diagnostic[] {
	expect(result.ok).toBe(false)
	if (result.ok) throw new Error('Expected validation failure')
	expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: 'error' }))
	return result.diagnostics
}

function validReport(): ScenarioReport {
	const scenario = validScenario()
	return {
		schemaVersion: SCENARIO_REPORT_SCHEMA_VERSION,
		scenarioId: scenario.scenarioId,
		time: scenario.time,
		frames: scenario.frames,
		results: {
			'earth-model.density': evaluateBulkDensity({
				massKg: 5.972e24,
				radiusM: 6.371e6,
			}),
		},
		diagnostics: [],
		dependencyGraph: {
			'earth-model.density': [],
		},
	}
}

describe('scenario validation and JSON interchange', () => {
	it('accepts a complete scenario with explicit time, frame and axis semantics', () => {
		const result = validateScenario(validScenario())
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected valid scenario')
		expect(result.value.bodies[1]?.orbit?.axisMeaning).toBe('parent-centred')
		expect(result.value.metadata?.[0]?.name).toBe('Reference Earth model')
		expect(result.diagnostics).toEqual([])
	})

	it('round-trips a validated scenario without losing scientific records', () => {
		const serialized = serializeScenario(validScenario())
		expect(serialized.ok).toBe(true)
		if (!serialized.ok) throw new Error('Expected scenario serialization')
		const parsed = parseScenarioJson(serialized.json)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) throw new Error('Expected scenario parse')
		expect(parsed.value).toEqual(validScenario())
	})

	it('rejects malformed JSON without throwing', () => {
		expectFailure(parseScenarioJson('{ definitely not JSON'), SCENARIO_DIAGNOSTIC_CODES.jsonInvalid)
	})

	it('rejects non-finite quantities and wrong runtime units', () => {
		const scenario = validScenario() as unknown as {
			bodies: Array<{ mass?: { value: number, unit: string } }>
		}
		scenario.bodies[0]!.mass = { value: Number.NaN, unit: 'M_sun' }
		const diagnostics = expectFailure(
			validateScenario(scenario),
			SCENARIO_DIAGNOSTIC_CODES.numberNonFinite,
		)
		expect(diagnostics).toContainEqual(expect.objectContaining({
			code: SCENARIO_DIAGNOSTIC_CODES.quantityUnitInvalid,
		}))
	})

	it('rejects unknown fields rather than silently accepting a newer shape', () => {
		const scenario = { ...validScenario(), surprisePhysics: true }
		expectFailure(validateScenario(scenario), SCENARIO_DIAGNOSTIC_CODES.fieldUnknown)
	})

	it('rejects unsupported time scales and ambiguous frame origins', () => {
		const scenario = validScenario() as unknown as {
			time: { scale: string }
			frames: Array<{ originBodyId: string }>
		}
		scenario.time.scale = 'local-noon'
		scenario.frames[0]!.originBodyId = 'missing-star'
		const diagnostics = expectFailure(
			validateScenario(scenario),
			SCENARIO_DIAGNOSTIC_CODES.timeScaleInvalid,
		)
		expect(diagnostics).toContainEqual(expect.objectContaining({
			code: SCENARIO_DIAGNOSTIC_CODES.frameOriginMissing,
		}))
	})

	it('rejects unresolved orbit frames and incompatible frame origins', () => {
		const missing = validScenario()
		missing.bodies[1]!.orbit!.frameId = 'missing-frame'
		expectFailure(validateScenario(missing), SCENARIO_DIAGNOSTIC_CODES.orbitFrameMissing)

		const incompatible = validScenario()
		incompatible.frames[0]!.originBodyId = 'earth-model'
		expectFailure(
			validateScenario(incompatible),
			SCENARIO_DIAGNOSTIC_CODES.orbitFrameIncompatible,
		)
	})

	it('rejects duplicate IDs and cycles in the orbit graph', () => {
		const duplicate = validScenario()
		duplicate.bodies[1]!.id = 'sun'
		expectFailure(validateScenario(duplicate), SCENARIO_DIAGNOSTIC_CODES.bodyDuplicate)

		const cyclic = validScenario()
		cyclic.bodies[0]!.orbit = {
			...cyclic.bodies[1]!.orbit!,
			primaryId: 'earth-model',
			frameId: 'earth-frame',
		}
		cyclic.frames = [
			...cyclic.frames,
			{
				id: 'earth-frame',
				originBodyId: 'earth-model',
				plane: 'xy-reference',
				direction: '+X caller-defined',
				handedness: 'right',
			},
		]
		expectFailure(validateScenario(cyclic), SCENARIO_DIAGNOSTIC_CODES.bodyGraphCycle)
	})

	it('requires barycentric-component axes to reference an explicit barycenter body', () => {
		const scenario = validScenario()
		scenario.bodies[1]!.orbit!.axisMeaning = 'barycentric-component'
		expectFailure(
			validateScenario(scenario),
			SCENARIO_DIAGNOSTIC_CODES.orbitFrameIncompatible,
		)
	})

	it('keeps scientific records and lore metadata independently referential', () => {
		const scenario = validScenario()
		scenario.metadata![0] = { ...scenario.metadata![0]!, bodyId: 'unknown' }
		expectFailure(validateScenario(scenario), SCENARIO_DIAGNOSTIC_CODES.metadataBodyMissing)
	})

	it('publishes unique stable scenario diagnostics', () => {
		const codes = Object.values(SCENARIO_DIAGNOSTIC_CODES)
		expect(new Set(codes).size).toBe(codes.length)
	})
})

describe('scenario reports', () => {
	it('validates and round-trips reports with dependency records', () => {
		expect(validateScenarioReport(validReport()).ok).toBe(true)
		const serialized = serializeScenarioReport(validReport())
		expect(serialized.ok).toBe(true)
		if (!serialized.ok) throw new Error('Expected report serialization')
		const parsed = parseScenarioReportJson(serialized.json)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) throw new Error('Expected report parse')
		expect(parsed.value.results['earth-model.density']).toEqual(
			validReport().results['earth-model.density'],
		)
	})

	it('constructs reports from the validated scenario time and frames', () => {
		const source = validReport()
		const result = createScenarioReport({
			scenario: validScenario(),
			results: source.results,
			dependencyGraph: source.dependencyGraph,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected report construction')
		expect(result.value.time).toEqual(validScenario().time)
		expect(result.value.frames).toEqual(validScenario().frames)
		expect(result.value.schemaVersion).toBe(SCENARIO_REPORT_SCHEMA_VERSION)
	})

	it('rejects missing and cyclic result dependencies', () => {
		const missing = validReport()
		missing.dependencyGraph['earth-model.density'] = ['missing-result']
		expectFailure(
			validateScenarioReport(missing),
			SCENARIO_DIAGNOSTIC_CODES.dependencyMissing,
		)

		const cyclic = validReport()
		cyclic.results.copy = cyclic.results['earth-model.density']!
		cyclic.dependencyGraph['earth-model.density'] = ['copy']
		cyclic.dependencyGraph.copy = ['earth-model.density']
		expectFailure(validateScenarioReport(cyclic), SCENARIO_DIAGNOSTIC_CODES.dependencyCycle)
	})

	it('enforces dependency depth independently of object insertion order', () => {
		const report = validReport()
		const result = report.results['earth-model.density']!
		const results: Record<string, typeof result> = {}
		const dependencyGraph: Record<string, string[]> = {}
		for (let index = 0; index <= 257; index += 1) {
			const id = `result-${index}`
			results[id] = result
			dependencyGraph[id] = index === 0 ? [] : [`result-${index - 1}`]
		}
		expectFailure(validateScenarioReport({
			...report,
			results,
			dependencyGraph,
		}), SCENARIO_DIAGNOSTIC_CODES.dependencyDepthExceeded)
	})

	it('rejects non-finite values anywhere in imported report output', () => {
		const report = validReport() as unknown as {
			results: Record<string, { output: { value: number } }>
		}
		report.results['earth-model.density']!.output.value = Number.POSITIVE_INFINITY
		expectFailure(
			validateScenarioReport(report),
			SCENARIO_DIAGNOSTIC_CODES.numberNonFinite,
		)
	})

	it('rejects malformed nested model results and report diagnostics', () => {
		const report = validReport() as unknown as {
			results: Record<string, unknown>
			diagnostics: unknown[]
			dependencyGraph: Record<string, string[]>
		}
		report.results.broken = { ok: true }
		report.diagnostics.push('not-a-diagnostic')
		report.dependencyGraph.broken = []
		expectFailure(
			validateScenarioReport(report),
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
		)
	})
})

describe('binary coordinate helpers', () => {
	it('partitions a relative axis into mass-weighted barycentric component axes', () => {
		const result = partitionBinaryRelativeAxis({
			relativeSemiMajorAxisAu: 2,
			primaryMassKg: 3,
			secondaryMassKg: 1,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected axis partition')
		expect(result.value.primaryBarycentricSemiMajorAxis.value).toBeCloseTo(0.5, 15)
		expect(result.value.secondaryBarycentricSemiMajorAxis.value).toBeCloseTo(1.5, 15)
		expect(
			result.value.primaryBarycentricSemiMajorAxis.value
			+ result.value.secondaryBarycentricSemiMajorAxis.value,
		).toBeCloseTo(result.value.relativeSemiMajorAxis.value, 15)
	})

	it('remains stable for finite masses whose direct sum would overflow', () => {
		const result = partitionBinaryRelativeAxis({
			relativeSemiMajorAxisAu: 1,
			primaryMassKg: Number.MAX_VALUE,
			secondaryMassKg: Number.MAX_VALUE,
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected stable axis partition')
		expect(result.value.primaryBarycentricSemiMajorAxis.value).toBe(0.5)
		expect(result.value.secondaryBarycentricSemiMajorAxis.value).toBe(0.5)
	})

	it('rejects invalid binary masses without throwing', () => {
		expectFailure(partitionBinaryRelativeAxis({
			relativeSemiMajorAxisAu: 1,
			primaryMassKg: 0,
			secondaryMassKg: 1,
		}), BINARY_DIAGNOSTIC_CODES.primaryMassInvalid)
	})

	it('converts a relative state into barycentric states preserving both invariants', () => {
		const relativeState: StateVectorOutput = {
			position: { x: 40, y: -8, z: 2, unit: 'm' },
			velocity: { x: 4, y: 6, z: -2, unit: 'm/s' },
			frameId: 'secondary-relative-to-primary',
		}
		const result = relativeStateToBarycentric({
			relativeState,
			primaryMassKg: 3,
			secondaryMassKg: 1,
			barycentricFrameId: 'binary-barycentric',
		})
		expect(result.ok).toBe(true)
		if (!result.ok) throw new Error('Expected barycentric states')
		const { primary, secondary } = result.value
		expect(secondary.position.x - primary.position.x).toBe(relativeState.position.x)
		expect(secondary.velocity.y - primary.velocity.y).toBe(relativeState.velocity.y)
		expect(3 * primary.position.x + secondary.position.x).toBeCloseTo(0, 15)
		expect(3 * primary.velocity.y + secondary.velocity.y).toBeCloseTo(0, 15)
		expect(primary.frameId).toBe('binary-barycentric')
		expect(result.value.relativeFrameId).toBe('secondary-relative-to-primary')
	})
})

describe('published JSON Schemas', () => {
	it('ships parseable input and report schemas at the runtime contract version', () => {
		const scenarioSchema = JSON.parse(readFileSync(
			new URL('../schemas/scenario.schema.json', import.meta.url),
			'utf8',
		)) as {
			$schema: string
			properties: { schemaVersion: { const: string } }
		}
		const reportSchema = JSON.parse(readFileSync(
			new URL('../schemas/scenario-report.schema.json', import.meta.url),
			'utf8',
		)) as {
			$schema: string
			properties: { schemaVersion: { const: string } }
		}
		expect(scenarioSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
		expect(reportSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
		expect(scenarioSchema.properties.schemaVersion.const).toBe(SCENARIO_SCHEMA_VERSION)
		expect(reportSchema.properties.schemaVersion.const).toBe(SCENARIO_REPORT_SCHEMA_VERSION)
	})
})
