import { describe, expect, it } from 'vitest'
import {
	EXTERNAL_ADAPTER_DIAGNOSTIC_CODES,
	EXTERNAL_RUN_SCHEMA_VERSION,
	NOMINAL_SOLAR_GM,
	SCENARIO_SCHEMA_VERSION,
	createExternalProvenance,
	parseExternalRunRequestJson,
	parseExternalRunResultJson,
	prepareClimateRun,
	prepareDynamicsRun,
	runExternalAdapter,
	serializeExternalRunRequest,
	serializeExternalRunResult,
	validateExternalRunRequest,
	validateExternalRunResult,
	type ExternalDynamicsRunRequest,
	type ExternalDynamicsRunSuccess,
	type ExternalEngineAdapter,
	type ExternalEngineReference,
	type ExternalRunWindow,
	type ExternalStateVector,
	type ScenarioInput,
} from './index.js'

const dynamicsEngine = {
	id: 'example.symplectic',
	version: '4.2.0',
	kind: 'dynamics',
	title: 'Example symplectic engine',
} as const satisfies ExternalEngineReference

const climateEngine = {
	id: 'example.ebm',
	version: '2.1.0',
	kind: 'climate',
	title: 'Example energy-balance engine',
} as const satisfies ExternalEngineReference

const window: ExternalRunWindow = {
	startOffset: { value: 0, unit: 's' },
	duration: { value: 86_400, unit: 's' },
	outputInterval: { value: 3_600, unit: 's' },
}

function scenario(): ScenarioInput {
	return {
		schemaVersion: SCENARIO_SCHEMA_VERSION,
		scenarioId: 'external-example',
		time: { epoch: 'J2000', scale: 'TDB', secondsPerDay: 86_400 },
		frames: [{
			id: 'common-inertial',
			originBodyId: 'sun',
			plane: 'ecliptic',
			direction: '+X toward J2000 mean equinox',
			handedness: 'right',
		}],
		bodies: [{
			id: 'sun',
			kind: 'star',
			mass: { value: 1.988_409_870_698_051e30, unit: 'kg' },
			luminosity: { value: 3.828e26, unit: 'W' },
		}, {
			id: 'earth',
			kind: 'planet',
			mass: { value: 5.9722e24, unit: 'kg' },
			radius: { value: 6_371_000, unit: 'm' },
			orbit: {
				kind: 'elliptical',
				primaryId: 'sun',
				frameId: 'common-inertial',
				semiMajorAxis: { value: 1, unit: 'AU' },
				axisMeaning: 'parent-centred',
				eccentricity: { value: 0.0167, unit: '1' },
				inclination: { value: 0, unit: 'deg' },
				longitudeAscendingNode: { value: 0, unit: 'deg' },
				argumentOfPeriapsis: { value: 102.9, unit: 'deg' },
				epochPhase: { value: 0, unit: '1' },
				mu: { value: NOMINAL_SOLAR_GM, unit: 'm^3/s^2' },
			},
		}],
		metadata: [{ bodyId: 'earth', name: 'Not sent to a solver' }],
	}
}

function state(x: number): ExternalStateVector {
	return {
		position: { x, y: 0, z: 0, unit: 'm' },
		velocity: { x: 0, y: x === 0 ? 0 : 29_780, z: 0, unit: 'm/s' },
		frameId: 'common-inertial',
	}
}

function dynamicsRequest(): ExternalDynamicsRunRequest {
	const prepared = prepareDynamicsRun({
		scenario: scenario(),
		requestId: 'run-001',
		engine: dynamicsEngine,
		window,
		frameId: 'common-inertial',
		states: { sun: state(0), earth: state(149_597_870_700) },
		parameters: [{ id: 'relativeTolerance', value: 1e-12, unit: '1' }],
	})
	if (!prepared.ok) throw new Error('Fixture should prepare')
	return prepared.value
}

function dynamicsResult(request = dynamicsRequest()): ExternalDynamicsRunSuccess {
	return {
		schemaVersion: EXTERNAL_RUN_SCHEMA_VERSION,
		requestId: request.requestId,
		scenarioId: request.scenarioId,
		kind: 'dynamics',
		ok: true,
		provenance: createExternalProvenance(request.engine, 'example.adapter', '1.3.0'),
		diagnostics: [],
		output: {
			frameId: request.frameId,
			samples: [{
				timeOffset: { value: 0, unit: 's' },
				bodies: request.bodies.map(body => ({ id: body.id, ...body.initialState })),
			}, {
				timeOffset: { value: 3_600, unit: 's' },
				bodies: request.bodies.map(body => ({ id: body.id, ...body.initialState })),
			}],
		},
	}
}

function adapter(overrides: Partial<ExternalEngineAdapter<ExternalDynamicsRunRequest, { accepted: true }>> = {}): ExternalEngineAdapter<ExternalDynamicsRunRequest, { accepted: true }> {
	return {
		id: 'example.adapter', version: '1.3.0', engine: dynamicsEngine,
		prepare: request => request as ExternalDynamicsRunRequest,
		execute: async () => ({ accepted: true }),
		interpret: (_raw, request) => dynamicsResult(request as ExternalDynamicsRunRequest),
		...overrides,
	}
}

describe('external run preparation', () => {
	it('prepares an explicit, metadata-free dynamics handoff', () => {
		const result = prepareDynamicsRun({
			scenario: scenario(),
			requestId: 'run-001',
			engine: dynamicsEngine,
			window,
			frameId: 'common-inertial',
			states: { sun: state(0), earth: state(149_597_870_700) },
		})
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.bodies.map(body => body.id)).toEqual(['sun', 'earth'])
		expect(JSON.stringify(result.value)).not.toContain('Not sent to a solver')
		expect(result.value.time.scale).toBe('TDB')
	})

	it('supports an explicit body subset', () => {
		const result = prepareDynamicsRun({
			scenario: scenario(), requestId: 'subset', engine: dynamicsEngine, window,
			frameId: 'common-inertial', states: { earth: state(1) }, bodyIds: ['earth'],
		})
		expect(result.ok && result.value.bodies.map(body => body.id)).toEqual(['earth'])
	})

	it.each([
		['missing body', ['missing'], { missing: state(0) }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.bodyMissing],
		['missing state', ['earth'], {}, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.stateMissing],
		['duplicate body', ['earth', 'earth'], { earth: state(0) }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.duplicateId],
	])('rejects %s', (_label, bodyIds, states, code) => {
		const result = prepareDynamicsRun({
			scenario: scenario(), requestId: 'bad', engine: dynamicsEngine, window,
			frameId: 'common-inertial', states, bodyIds,
		})
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }))
	})

	it('requires mass for every selected dynamics body', () => {
		const input = scenario()
		delete (input.bodies[1] as { mass?: unknown }).mass
		const result = prepareDynamicsRun({
			scenario: input, requestId: 'bad', engine: dynamicsEngine, window,
			frameId: 'common-inertial', states: { earth: state(0) }, bodyIds: ['earth'],
		})
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.massMissing }))
	})

	it('prepares climate boundary conditions without selecting a climate model', () => {
		const result = prepareClimateRun({
			scenario: scenario(), requestId: 'climate-001', engine: climateEngine, window,
			bodyId: 'earth',
			boundaryConditions: [
				{ id: 'topOfAtmosphereFlux', quantity: { value: 1361, unit: 'W/m^2' } },
				{ id: 'surfaceGravity', quantity: { value: 9.81, unit: 'm/s^2' } },
			],
			parameters: [{ id: 'cloudScheme', value: 'engine-default-v2' }],
		})
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.value.bodyId).toBe('earth')
	})

	it('rejects an unknown climate body and duplicate boundary IDs', () => {
		const missing = prepareClimateRun({
			scenario: scenario(), requestId: 'bad', engine: climateEngine, window,
			bodyId: 'mars', boundaryConditions: [{ id: 'flux', quantity: { value: 500, unit: 'W/m^2' } }],
		})
		expect(missing.ok).toBe(false)
		const duplicate = prepareClimateRun({
			scenario: scenario(), requestId: 'bad', engine: climateEngine, window,
			bodyId: 'earth', boundaryConditions: [
				{ id: 'flux', quantity: { value: 500, unit: 'W/m^2' } },
				{ id: 'flux', quantity: { value: 501, unit: 'W/m^2' } },
			],
		})
		expect(duplicate.ok).toBe(false)
		if (!duplicate.ok) expect(duplicate.diagnostics).toContainEqual(expect.objectContaining({ code: EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.duplicateId }))
	})
})

describe('external contract validation and serialization', () => {
	it('round-trips a dynamics request through finite JSON', () => {
		const serialized = serializeExternalRunRequest(dynamicsRequest())
		expect(serialized.ok).toBe(true)
		if (!serialized.ok) return
		expect(serialized.json).not.toMatch(/NaN|Infinity/)
		const parsed = parseExternalRunRequestJson(serialized.json)
		expect(parsed).toEqual(expect.objectContaining({ ok: true }))
	})

	it('rejects unknown fields, non-finite values, missing numeric units and bad JSON', () => {
		const request = dynamicsRequest() as unknown as Record<string, unknown>
		request.surprise = true
		const bodies = request.bodies as Array<{ mass: { value: number } }>
		bodies[0]!.mass.value = Number.NaN
		const parameters = request.parameters as Array<{ unit?: string }>
		delete parameters[0]!.unit
		const result = validateExternalRunRequest(request)
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.fieldUnknown,
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.unitMissing,
			]))
		}
		expect(parseExternalRunRequestJson('{').ok).toBe(false)
	})

	it('rejects a frame mismatch and output interval greater than duration', () => {
		const request = dynamicsRequest()
		request.bodies[0]!.initialState.frameId = 'other'
		request.window.outputInterval.value = request.window.duration.value + 1
		const result = validateExternalRunRequest(request)
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.diagnostics.map(item => item.code)).toContain(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.frameMismatch)
	})

	it('validates normalized dynamics results against the originating request', () => {
		const request = dynamicsRequest()
		const result = dynamicsResult(request)
		expect(validateExternalRunResult(result, request).ok).toBe(true)
		const serialized = serializeExternalRunResult(result)
		expect(serialized.ok).toBe(true)
		if (serialized.ok) expect(parseExternalRunResultJson(serialized.json).ok).toBe(true)
	})

	it.each([
		['request identity', (result: ExternalDynamicsRunSuccess) => { result.requestId = 'wrong' }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.requestMismatch],
		['engine identity', (result: ExternalDynamicsRunSuccess) => { result.provenance.engine = { ...result.provenance.engine, id: 'wrong' } }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.engineMismatch],
		['frame identity', (result: ExternalDynamicsRunSuccess) => { result.output.frameId = 'wrong' }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.frameMismatch],
		['body completeness', (result: ExternalDynamicsRunSuccess) => { result.output.samples[0]!.bodies = result.output.samples[0]!.bodies.slice(1) }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid],
		['window coverage', (result: ExternalDynamicsRunSuccess) => { result.output.samples[1]!.timeOffset.value = 99_999 }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.timeOutsideWindow],
		['time ordering', (result: ExternalDynamicsRunSuccess) => { result.output.samples[0]!.timeOffset.value = 4_000 }, EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.timeNonMonotonic],
	])('rejects result %s errors', (_label, mutate, code) => {
		const request = dynamicsRequest()
		const result = dynamicsResult(request)
		mutate(result)
		const validation = validateExternalRunResult(result, request)
		expect(validation.ok).toBe(false)
		if (!validation.ok) expect(validation.diagnostics).toContainEqual(expect.objectContaining({ code }))
	})

	it('validates climate channels and their explicit units', () => {
		const prepared = prepareClimateRun({
			scenario: scenario(), requestId: 'climate', engine: climateEngine, window,
			bodyId: 'earth', boundaryConditions: [{ id: 'flux', quantity: { value: 1361, unit: 'W/m^2' } }],
		})
		if (!prepared.ok) throw new Error('Fixture should prepare')
		const result = {
			schemaVersion: EXTERNAL_RUN_SCHEMA_VERSION,
			requestId: 'climate', scenarioId: prepared.value.scenarioId, kind: 'climate', ok: true,
			provenance: createExternalProvenance(climateEngine, 'climate.adapter'),
			diagnostics: [],
			output: { channels: [{
				id: 'globalMeanSurfaceTemperature', unit: 'K',
				samples: [{ timeOffset: { value: 0, unit: 's' }, value: 287.4 }],
			}] },
		}
		expect(validateExternalRunResult(result, prepared.value).ok).toBe(true)
		result.output.channels[0]!.unit = ''
		expect(validateExternalRunResult(result, prepared.value).ok).toBe(false)
	})
})

describe('external adapter orchestration', () => {
	it('runs an injected adapter and validates its normalized result', async () => {
		const result = await runExternalAdapter(adapter(), dynamicsRequest())
		expect(result.ok).toBe(true)
	})

	it('turns transport exceptions into a stable failed result', async () => {
		const result = await runExternalAdapter(adapter({
			execute: () => {
				throw new Error('service unavailable')
			},
		}), dynamicsRequest())
		expect(result.ok).toBe(false)
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			code: EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.adapterFailure,
			category: 'numerical-failure',
		}))
	})

	it('rejects malformed interpreted output and the wrong engine adapter', async () => {
		const malformed = await runExternalAdapter(adapter({ interpret: () => ({ ok: true }) }), dynamicsRequest())
		expect(malformed.ok).toBe(false)
		const wrong = adapter({ engine: { ...dynamicsEngine, id: 'another.engine' } })
		const wrongEngineResult = await runExternalAdapter(wrong, dynamicsRequest())
		expect(wrongEngineResult.ok).toBe(false)
	})
})
