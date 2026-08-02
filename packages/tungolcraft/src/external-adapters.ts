import type { Diagnostic, QuantityVector } from './model-types.js'
import { validateScenario } from './scenario.js'
import type { SerializationResult, ValidationResult } from './scenario-types.js'
import {
	EXTERNAL_ADAPTER_API_VERSION,
	EXTERNAL_ADAPTER_LIMITS,
	EXTERNAL_RUN_SCHEMA_VERSION,
	type ExternalClimateRunRequest,
	type ExternalDynamicsBody,
	type ExternalDynamicsRunRequest,
	type ExternalEngineAdapter,
	type ExternalEngineKind,
	type ExternalEngineReference,
	type ExternalRunFailure,
	type ExternalRunRequest,
	type ExternalRunResult,
	type ExternalRunWindow,
	type ExternalStateVector,
	type PrepareClimateRunInput,
	type PrepareDynamicsRunInput,
} from './external-adapter-types.js'

export const EXTERNAL_ADAPTER_DIAGNOSTIC_CODES = {
	jsonInvalid: 'external.json.invalid',
	jsonTooLarge: 'external.json.too-large',
	rootInvalid: 'external.root.invalid',
	schemaVersionUnsupported: 'external.schema-version.unsupported',
	fieldUnknown: 'external.field.unknown',
	valueInvalid: 'external.value.invalid',
	unitMissing: 'external.unit.missing',
	resourceLimitExceeded: 'external.resource-limit.exceeded',
	engineMismatch: 'external.engine.mismatch',
	kindMismatch: 'external.kind.mismatch',
	requestMismatch: 'external.request.mismatch',
	scenarioInvalid: 'external.scenario.invalid',
	bodyMissing: 'external.body.missing',
	massMissing: 'external.body.mass-missing',
	stateMissing: 'external.body.state-missing',
	frameMismatch: 'external.frame.mismatch',
	timeOutsideWindow: 'external.time.outside-window',
	timeNonMonotonic: 'external.time.non-monotonic',
	duplicateId: 'external.id.duplicate',
	resultInvalid: 'external.result.invalid',
	adapterFailure: 'external.adapter.failure',
} as const

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return value != null && typeof value === 'object' && !Array.isArray(value)
}

function issue(
	code: string,
	message: string,
	fields: readonly string[],
	evidence?: Diagnostic['evidence'],
	category: Diagnostic['category'] = 'invalid-input',
): Diagnostic {
	return {
		code,
		category,
		severity: 'error',
		message,
		fields,
		...(evidence ? { evidence } : {}),
		modelId: 'external.adapter',
	}
}

function checkObject(value: unknown, path: string, diagnostics: Diagnostic[]): value is UnknownRecord {
	if (isRecord(value)) return true
	diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.rootInvalid,
		`${path} must be an object`,
		[path],
	))
	return false
}

function checkFields(
	value: UnknownRecord,
	allowed: readonly string[],
	path: string,
	diagnostics: Diagnostic[],
): void {
	const known = new Set(allowed)
	for (const key of Object.keys(value)) {
		if (!known.has(key)) diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.fieldUnknown,
			`${path}.${key} is not part of this schema version`,
			[`${path}.${key}`],
		))
	}
}

function checkString(value: unknown, path: string, diagnostics: Diagnostic[]): value is string {
	if (typeof value === 'string' && value.trim().length > 0) return true
	diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path} must be a non-empty string`,
		[path],
	))
	return false
}

function checkFinite(value: unknown, path: string, diagnostics: Diagnostic[]): value is number {
	if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return true
	diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path} must be finite and must not be negative zero`,
		[path],
		{ value: String(value) },
	))
	return false
}

function validateQuantity(
	value: unknown,
	unit: string,
	path: string,
	diagnostics: Diagnostic[],
	minimum = -Infinity,
	positive = false,
): boolean {
	if (!checkObject(value, path, diagnostics)) return false
	checkFields(value, ['value', 'unit'], path, diagnostics)
	if (value.unit !== unit) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.unit must be ${unit}`,
		[`${path}.unit`],
		{ expected: unit, actual: String(value.unit) },
	))
	if (!checkFinite(value.value, `${path}.value`, diagnostics)) return false
	if ((positive && value.value <= 0) || value.value < minimum) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.value is outside its permitted range`,
		[`${path}.value`],
		{ value: value.value },
	))
	return true
}

function validateEngine(
	value: unknown,
	kind: ExternalEngineKind,
	path: string,
	diagnostics: Diagnostic[],
): value is ExternalEngineReference {
	if (!checkObject(value, path, diagnostics)) return false
	checkFields(value, ['id', 'version', 'kind', 'title', 'url'], path, diagnostics)
	checkString(value.id, `${path}.id`, diagnostics)
	checkString(value.version, `${path}.version`, diagnostics)
	checkString(value.title, `${path}.title`, diagnostics)
	if (value.kind !== kind) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.kindMismatch,
		`${path}.kind must match request kind ${kind}`,
		[`${path}.kind`],
		{ expected: kind, actual: String(value.kind) },
	))
	if (value.url != null) checkString(value.url, `${path}.url`, diagnostics)
	return true
}

function validateWindow(value: unknown, path: string, diagnostics: Diagnostic[]): value is ExternalRunWindow {
	if (!checkObject(value, path, diagnostics)) return false
	checkFields(value, ['startOffset', 'duration', 'outputInterval'], path, diagnostics)
	validateQuantity(value.startOffset, 's', `${path}.startOffset`, diagnostics, 0)
	validateQuantity(value.duration, 's', `${path}.duration`, diagnostics, 0, true)
	validateQuantity(value.outputInterval, 's', `${path}.outputInterval`, diagnostics, 0, true)
	if (
		isRecord(value.duration)
		&& isRecord(value.outputInterval)
		&& typeof value.duration.value === 'number'
		&& typeof value.outputInterval.value === 'number'
		&& value.outputInterval.value > value.duration.value
	) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.outputInterval must not exceed duration`,
		[`${path}.outputInterval`],
	))
	return true
}

function validateParameters(value: unknown, path: string, diagnostics: Diagnostic[]): void {
	if (!Array.isArray(value)) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid, `${path} must be an array`, [path]))
		return
	}
	if (value.length > EXTERNAL_ADAPTER_LIMITS.maxParameters) diagnostics.push(limitIssue(path, value.length, EXTERNAL_ADAPTER_LIMITS.maxParameters))
	const ids = new Set<string>()
	value.forEach((entry, index) => {
		const itemPath = `${path}[${index}]`
		if (!checkObject(entry, itemPath, diagnostics)) return
		checkFields(entry, ['id', 'value', 'unit'], itemPath, diagnostics)
		if (checkString(entry.id, `${itemPath}.id`, diagnostics)) checkDuplicate(ids, entry.id, `${itemPath}.id`, diagnostics)
		if (!['number', 'string', 'boolean'].includes(typeof entry.value)) diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
			`${itemPath}.value must be a number, string or boolean`,
			[`${itemPath}.value`],
		))
		if (typeof entry.value === 'number') {
			checkFinite(entry.value, `${itemPath}.value`, diagnostics)
			if (!checkString(entry.unit, `${itemPath}.unit`, diagnostics)) diagnostics.push(issue(
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.unitMissing,
				`Numeric parameter ${String(entry.id)} requires an explicit unit`,
				[`${itemPath}.unit`],
			))
		} else if (entry.unit != null) diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
			`${itemPath}.unit is only valid for numeric parameters`,
			[`${itemPath}.unit`],
		))
	})
}

function checkDuplicate(ids: Set<string>, id: string, path: string, diagnostics: Diagnostic[]): void {
	if (ids.has(id)) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.duplicateId,
		`${path} duplicates ${id}`,
		[path],
		{ id },
	))
	ids.add(id)
}

function limitIssue(path: string, actual: number, maximum: number): Diagnostic {
	return issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resourceLimitExceeded,
		`${path} exceeds the maximum of ${maximum}`,
		[path],
		{ actual, maximum },
	)
}

function validateVector(
	value: unknown,
	unit: 'm' | 'm/s',
	path: string,
	diagnostics: Diagnostic[],
): value is QuantityVector<'m'> | QuantityVector<'m/s'> {
	if (!checkObject(value, path, diagnostics)) return false
	checkFields(value, ['x', 'y', 'z', 'unit'], path, diagnostics)
	for (const axis of ['x', 'y', 'z'] as const) checkFinite(value[axis], `${path}.${axis}`, diagnostics)
	if (value.unit !== unit) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.unit must be ${unit}`,
		[`${path}.unit`],
	))
	return true
}

function validateState(
	value: unknown,
	frameId: string,
	path: string,
	diagnostics: Diagnostic[],
	includeBodyId = false,
): value is ExternalStateVector {
	if (!checkObject(value, path, diagnostics)) return false
	checkFields(value, includeBodyId ? ['id', 'position', 'velocity', 'frameId'] : ['position', 'velocity', 'frameId'], path, diagnostics)
	validateVector(value.position, 'm', `${path}.position`, diagnostics)
	validateVector(value.velocity, 'm/s', `${path}.velocity`, diagnostics)
	if (value.frameId !== frameId) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.frameMismatch,
		`${path}.frameId must be ${frameId}`,
		[`${path}.frameId`],
		{ expected: frameId, actual: String(value.frameId) },
	))
	return true
}

function validateTime(value: unknown, path: string, diagnostics: Diagnostic[]): void {
	if (!checkObject(value, path, diagnostics)) return
	checkFields(value, ['epoch', 'scale', 'secondsPerDay'], path, diagnostics)
	checkString(value.epoch, `${path}.epoch`, diagnostics)
	if (!['model-day', 'UTC', 'TAI', 'TT', 'TDB'].includes(String(value.scale))) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.scale is unsupported`,
		[`${path}.scale`],
	))
	if (checkFinite(value.secondsPerDay, `${path}.secondsPerDay`, diagnostics) && value.secondsPerDay <= 0) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		`${path}.secondsPerDay must be greater than zero`,
		[`${path}.secondsPerDay`],
	))
}

function validateRequestBase(value: UnknownRecord, kind: ExternalEngineKind, diagnostics: Diagnostic[]): void {
	if (value.schemaVersion !== EXTERNAL_RUN_SCHEMA_VERSION) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.schemaVersionUnsupported,
		`schemaVersion must be ${EXTERNAL_RUN_SCHEMA_VERSION}`,
		['schemaVersion'],
		{ actual: String(value.schemaVersion) },
	))
	if (value.kind !== kind) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.kindMismatch, `kind must be ${kind}`, ['kind']))
	checkString(value.requestId, 'requestId', diagnostics)
	if (value.scenarioId != null) checkString(value.scenarioId, 'scenarioId', diagnostics)
	validateEngine(value.engine, kind, 'engine', diagnostics)
	validateTime(value.time, 'time', diagnostics)
	validateWindow(value.window, 'window', diagnostics)
	validateParameters(value.parameters, 'parameters', diagnostics)
}

function validateDynamicsRequest(value: UnknownRecord, diagnostics: Diagnostic[]): void {
	checkFields(value, ['schemaVersion', 'requestId', 'scenarioId', 'kind', 'engine', 'time', 'window', 'parameters', 'frameId', 'bodies'], '$', diagnostics)
	validateRequestBase(value, 'dynamics', diagnostics)
	const frameId = checkString(value.frameId, 'frameId', diagnostics) ? value.frameId : ''
	if (!Array.isArray(value.bodies)) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid, 'bodies must be an array', ['bodies']))
		return
	}
	if (value.bodies.length === 0) diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid,
		'bodies must contain at least one body',
		['bodies'],
	))
	if (value.bodies.length > EXTERNAL_ADAPTER_LIMITS.maxBodies) diagnostics.push(limitIssue('bodies', value.bodies.length, EXTERNAL_ADAPTER_LIMITS.maxBodies))
	const ids = new Set<string>()
	value.bodies.forEach((body, index) => {
		const path = `bodies[${index}]`
		if (!checkObject(body, path, diagnostics)) return
		checkFields(body, ['id', 'mass', 'initialState'], path, diagnostics)
		if (checkString(body.id, `${path}.id`, diagnostics)) checkDuplicate(ids, body.id, `${path}.id`, diagnostics)
		validateQuantity(body.mass, 'kg', `${path}.mass`, diagnostics, 0, true)
		validateState(body.initialState, frameId, `${path}.initialState`, diagnostics)
	})
}

function validateBoundaryConditions(value: unknown, path: string, diagnostics: Diagnostic[]): void {
	if (!Array.isArray(value) || value.length === 0) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.valueInvalid, `${path} must be a non-empty array`, [path]))
		return
	}
	if (value.length > EXTERNAL_ADAPTER_LIMITS.maxParameters) diagnostics.push(limitIssue(path, value.length, EXTERNAL_ADAPTER_LIMITS.maxParameters))
	const ids = new Set<string>()
	value.forEach((entry, index) => {
		const itemPath = `${path}[${index}]`
		if (!checkObject(entry, itemPath, diagnostics)) return
		checkFields(entry, ['id', 'quantity'], itemPath, diagnostics)
		if (checkString(entry.id, `${itemPath}.id`, diagnostics)) checkDuplicate(ids, entry.id, `${itemPath}.id`, diagnostics)
		if (!checkObject(entry.quantity, `${itemPath}.quantity`, diagnostics)) return
		checkFields(entry.quantity, ['value', 'unit'], `${itemPath}.quantity`, diagnostics)
		checkFinite(entry.quantity.value, `${itemPath}.quantity.value`, diagnostics)
		checkString(entry.quantity.unit, `${itemPath}.quantity.unit`, diagnostics)
	})
}

function validateClimateRequest(value: UnknownRecord, diagnostics: Diagnostic[]): void {
	checkFields(value, ['schemaVersion', 'requestId', 'scenarioId', 'kind', 'engine', 'time', 'window', 'parameters', 'bodyId', 'boundaryConditions'], '$', diagnostics)
	validateRequestBase(value, 'climate', diagnostics)
	checkString(value.bodyId, 'bodyId', diagnostics)
	validateBoundaryConditions(value.boundaryConditions, 'boundaryConditions', diagnostics)
}

export function validateExternalRunRequest(value: unknown): ValidationResult<ExternalRunRequest> {
	const diagnostics: Diagnostic[] = []
	if (!checkObject(value, '$', diagnostics)) return { ok: false, diagnostics }
	if (value.kind === 'dynamics') validateDynamicsRequest(value, diagnostics)
	else if (value.kind === 'climate') validateClimateRequest(value, diagnostics)
	else diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.kindMismatch,
		'kind must be dynamics or climate',
		['kind'],
	))
	return diagnostics.length === 0
		? { ok: true, value: value as unknown as ExternalRunRequest, diagnostics: [] }
		: { ok: false, diagnostics }
}

function clone<T>(value: T): T {
	try {
		return structuredClone(value)
	} catch {
		// Invalid runtime values are reported by the contract validator below.
		return value
	}
}

export function prepareDynamicsRun(input: PrepareDynamicsRunInput): ValidationResult<ExternalDynamicsRunRequest> {
	const scenario = validateScenario(input.scenario)
	if (!scenario.ok) return {
		ok: false,
		diagnostics: [issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.scenarioInvalid,
			'Scenario must be valid before an external run is prepared',
			['scenario'],
		), ...scenario.diagnostics],
	}
	const bodyIndex = new Map(scenario.value.bodies.map(body => [body.id, body]))
	const bodyIds = input.bodyIds ?? scenario.value.bodies.map(body => body.id)
	const diagnostics: Diagnostic[] = []
	const seen = new Set<string>()
	const bodies: ExternalDynamicsBody[] = []
	for (const id of bodyIds) {
		if (seen.has(id)) {
			diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.duplicateId, `bodyIds duplicates ${id}`, ['bodyIds'], { id }))
			continue
		}
		seen.add(id)
		const body = bodyIndex.get(id)
		if (!body) {
			diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.bodyMissing, `Body ${id} is not in the scenario`, ['bodyIds'], { id }))
			continue
		}
		if (!body.mass) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.massMissing, `Body ${id} requires mass for dynamics`, [`bodies.${id}.mass`], { id }))
		const state = input.states[id]
		if (!state) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.stateMissing, `Body ${id} requires an explicit Cartesian initial state`, [`states.${id}`], { id }))
		if (body.mass && state) bodies.push({ id, mass: body.mass, initialState: state })
	}
	if (diagnostics.length > 0) return { ok: false, diagnostics }
	const request: ExternalDynamicsRunRequest = {
		schemaVersion: EXTERNAL_RUN_SCHEMA_VERSION,
		requestId: input.requestId,
		...(scenario.value.scenarioId ? { scenarioId: scenario.value.scenarioId } : {}),
		kind: 'dynamics',
		engine: clone(input.engine),
		time: clone(scenario.value.time),
		window: clone(input.window),
		parameters: clone(input.parameters ?? []),
		frameId: input.frameId,
		bodies: clone(bodies),
	}
	return validateExternalRunRequest(request) as ValidationResult<ExternalDynamicsRunRequest>
}

export function prepareClimateRun(input: PrepareClimateRunInput): ValidationResult<ExternalClimateRunRequest> {
	const scenario = validateScenario(input.scenario)
	if (!scenario.ok) return {
		ok: false,
		diagnostics: [issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.scenarioInvalid, 'Scenario must be valid before an external run is prepared', ['scenario']), ...scenario.diagnostics],
	}
	if (!scenario.value.bodies.some(body => body.id === input.bodyId)) return {
		ok: false,
		diagnostics: [issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.bodyMissing, `Body ${input.bodyId} is not in the scenario`, ['bodyId'], { id: input.bodyId })],
	}
	const request: ExternalClimateRunRequest = {
		schemaVersion: EXTERNAL_RUN_SCHEMA_VERSION,
		requestId: input.requestId,
		...(scenario.value.scenarioId ? { scenarioId: scenario.value.scenarioId } : {}),
		kind: 'climate',
		engine: clone(input.engine),
		time: clone(scenario.value.time),
		window: clone(input.window),
		parameters: clone(input.parameters ?? []),
		bodyId: input.bodyId,
		boundaryConditions: clone(input.boundaryConditions),
	}
	return validateExternalRunRequest(request) as ValidationResult<ExternalClimateRunRequest>
}

function validateProvenance(value: unknown, kind: ExternalEngineKind, diagnostics: Diagnostic[]): void {
	if (!checkObject(value, 'provenance', diagnostics)) return
	checkFields(value, ['engine', 'adapter'], 'provenance', diagnostics)
	validateEngine(value.engine, kind, 'provenance.engine', diagnostics)
	if (!checkObject(value.adapter, 'provenance.adapter', diagnostics)) return
	checkFields(value.adapter, ['id', 'version'], 'provenance.adapter', diagnostics)
	checkString(value.adapter.id, 'provenance.adapter.id', diagnostics)
	checkString(value.adapter.version, 'provenance.adapter.version', diagnostics)
}

function validateResultDiagnostics(value: unknown, diagnostics: Diagnostic[]): boolean {
	if (!Array.isArray(value)) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'diagnostics must be an array', ['diagnostics']))
		return false
	}
	let hasError = false
	value.forEach((entry, index) => {
		const path = `diagnostics[${index}]`
		if (!checkObject(entry, path, diagnostics)) return
		checkFields(entry, ['code', 'category', 'severity', 'message', 'fields', 'evidence', 'modelId'], path, diagnostics)
		checkString(entry.code, `${path}.code`, diagnostics)
		checkString(entry.message, `${path}.message`, diagnostics)
		checkString(entry.modelId, `${path}.modelId`, diagnostics)
		checkAllowedValue(
			entry.category,
			['invalid-input', 'missing-input', 'outside-domain', 'numerical-failure', 'approximation', 'physical-warning'],
			`${path}.category`,
			diagnostics,
		)
		checkAllowedValue(entry.severity, ['info', 'warning', 'error'], `${path}.severity`, diagnostics)
		if (entry.severity === 'error') hasError = true
		if (Array.isArray(entry.fields)) {
			entry.fields.forEach((field, fieldIndex) => checkString(field, `${path}.fields[${fieldIndex}]`, diagnostics))
		} else diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid,
			`${path}.fields must be an array`,
			[`${path}.fields`],
		))
		if (entry.evidence != null) {
			if (isRecord(entry.evidence)) for (const [key, evidence] of Object.entries(entry.evidence)) {
				if (!['number', 'string', 'boolean'].includes(typeof evidence) || (typeof evidence === 'number' && !Number.isFinite(evidence))) diagnostics.push(issue(
					EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid,
					`${path}.evidence.${key} must be a finite number, string or boolean`,
					[`${path}.evidence.${key}`],
				))
			} else {
				diagnostics.push(issue(
					EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid,
					`${path}.evidence must be an object`,
					[`${path}.evidence`],
				))
			}
		}
	})
	return hasError
}

function checkAllowedValue(
	value: unknown,
	allowed: readonly string[],
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (allowed.includes(String(value))) return
	diagnostics.push(issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid,
		`${path} is invalid`,
		[path],
	))
}

function validateSampleTimes(
	times: readonly number[],
	paths: readonly string[],
	diagnostics: Diagnostic[],
	window?: ExternalRunWindow,
): void {
	let previous = -Infinity
	const minimum = window?.startOffset.value
	const maximum = window ? window.startOffset.value + window.duration.value : undefined
	times.forEach((time, index) => {
		if (index > 0 && time <= previous) diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.timeNonMonotonic,
			'Sample times must be strictly increasing',
			[paths[index] ?? 'output'],
		))
		if ((minimum != null && time < minimum) || (maximum != null && time > maximum)) diagnostics.push(issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.timeOutsideWindow,
			'Sample time lies outside the requested window',
			[paths[index] ?? 'output'],
			{ time, minimum: minimum ?? '', maximum: maximum ?? '' },
		))
		previous = time
	})
}

function validateDynamicsSamples(value: unknown, diagnostics: Diagnostic[], request?: ExternalDynamicsRunRequest): void {
	if (!Array.isArray(value)) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'output.samples must be an array', ['output.samples']))
		return
	}
	if (value.length > EXTERNAL_ADAPTER_LIMITS.maxSamples) diagnostics.push(limitIssue('output.samples', value.length, EXTERNAL_ADAPTER_LIMITS.maxSamples))
	const times: number[] = []
	const paths: string[] = []
	value.forEach((entry, index) => {
		const path = `output.samples[${index}]`
		if (!checkObject(entry, path, diagnostics)) return
		checkFields(entry, ['timeOffset', 'bodies'], path, diagnostics)
		validateQuantity(entry.timeOffset, 's', `${path}.timeOffset`, diagnostics, 0)
		if (isRecord(entry.timeOffset) && typeof entry.timeOffset.value === 'number') {
			times.push(entry.timeOffset.value)
			paths.push(`${path}.timeOffset`)
		}
		if (!Array.isArray(entry.bodies)) {
			diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, `${path}.bodies must be an array`, [`${path}.bodies`]))
			return
		}
		const ids = new Set<string>()
		entry.bodies.forEach((body, bodyIndex) => {
			const bodyPath = `${path}.bodies[${bodyIndex}]`
			if (!checkObject(body, bodyPath, diagnostics)) return
			checkFields(body, ['id', 'position', 'velocity', 'frameId'], bodyPath, diagnostics)
			if (checkString(body.id, `${bodyPath}.id`, diagnostics)) checkDuplicate(ids, body.id, `${bodyPath}.id`, diagnostics)
			validateState(body, request?.frameId ?? String(body.frameId), bodyPath, diagnostics, true)
		})
		if (request) {
			const expected = new Set(request.bodies.map(body => body.id))
			if (ids.size !== expected.size || [...expected].some(id => !ids.has(id))) diagnostics.push(issue(
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid,
				`${path}.bodies must contain every requested body exactly once`,
				[`${path}.bodies`],
			))
		}
	})
	validateSampleTimes(times, paths, diagnostics, request?.window)
}

function validateClimateChannels(value: unknown, diagnostics: Diagnostic[], request?: ExternalClimateRunRequest): void {
	if (!Array.isArray(value)) {
		diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'output.channels must be an array', ['output.channels']))
		return
	}
	if (value.length > EXTERNAL_ADAPTER_LIMITS.maxChannels) diagnostics.push(limitIssue('output.channels', value.length, EXTERNAL_ADAPTER_LIMITS.maxChannels))
	const ids = new Set<string>()
	value.forEach((entry, index) => {
		const path = `output.channels[${index}]`
		if (!checkObject(entry, path, diagnostics)) return
		checkFields(entry, ['id', 'unit', 'samples'], path, diagnostics)
		if (checkString(entry.id, `${path}.id`, diagnostics)) checkDuplicate(ids, entry.id, `${path}.id`, diagnostics)
		checkString(entry.unit, `${path}.unit`, diagnostics)
		if (!Array.isArray(entry.samples)) {
			diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, `${path}.samples must be an array`, [`${path}.samples`]))
			return
		}
		if (entry.samples.length > EXTERNAL_ADAPTER_LIMITS.maxSamples) diagnostics.push(limitIssue(`${path}.samples`, entry.samples.length, EXTERNAL_ADAPTER_LIMITS.maxSamples))
		const times: number[] = []
		const paths: string[] = []
		entry.samples.forEach((sample, sampleIndex) => {
			const samplePath = `${path}.samples[${sampleIndex}]`
			if (!checkObject(sample, samplePath, diagnostics)) return
			checkFields(sample, ['timeOffset', 'value'], samplePath, diagnostics)
			validateQuantity(sample.timeOffset, 's', `${samplePath}.timeOffset`, diagnostics, 0)
			checkFinite(sample.value, `${samplePath}.value`, diagnostics)
			if (isRecord(sample.timeOffset) && typeof sample.timeOffset.value === 'number') {
				times.push(sample.timeOffset.value)
				paths.push(`${samplePath}.timeOffset`)
			}
		})
		validateSampleTimes(times, paths, diagnostics, request?.window)
	})
}

export function validateExternalRunResult(
	value: unknown,
	request?: ExternalRunRequest,
): ValidationResult<ExternalRunResult> {
	const diagnostics: Diagnostic[] = []
	if (!checkObject(value, '$', diagnostics)) return { ok: false, diagnostics }
	checkFields(value, ['schemaVersion', 'requestId', 'scenarioId', 'kind', 'provenance', 'diagnostics', 'ok', 'output'], '$', diagnostics)
	if (value.schemaVersion !== EXTERNAL_RUN_SCHEMA_VERSION) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.schemaVersionUnsupported, `schemaVersion must be ${EXTERNAL_RUN_SCHEMA_VERSION}`, ['schemaVersion']))
	const kind = value.kind === 'dynamics' || value.kind === 'climate' ? value.kind : undefined
	if (!kind) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.kindMismatch, 'kind must be dynamics or climate', ['kind']))
	checkString(value.requestId, 'requestId', diagnostics)
	if (value.scenarioId != null) checkString(value.scenarioId, 'scenarioId', diagnostics)
	if (kind) validateProvenance(value.provenance, kind, diagnostics)
	if (typeof value.ok !== 'boolean') diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'ok must be boolean', ['ok']))
	const hasErrorDiagnostic = validateResultDiagnostics(value.diagnostics, diagnostics)
	if (request) {
		if (value.requestId !== request.requestId) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.requestMismatch, 'Result requestId does not match its request', ['requestId']))
		if (value.scenarioId !== request.scenarioId) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.requestMismatch, 'Result scenarioId does not match its request', ['scenarioId']))
		if (value.kind !== request.kind) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.kindMismatch, 'Result kind does not match its request', ['kind']))
		if (
			isRecord(value.provenance)
			&& isRecord(value.provenance.engine)
			&& (
				value.provenance.engine.id !== request.engine.id
				|| value.provenance.engine.version !== request.engine.version
				|| value.provenance.engine.kind !== request.engine.kind
			)
		) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.engineMismatch, 'Result engine identity or version does not match its request', ['provenance.engine']))
	}
	if (value.ok === true) {
		if (hasErrorDiagnostic) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'Successful results must not contain error diagnostics', ['diagnostics']))
		if (!checkObject(value.output, 'output', diagnostics)) return { ok: false, diagnostics }
		if (kind === 'dynamics') {
			checkFields(value.output, ['frameId', 'samples'], 'output', diagnostics)
			const frame = request?.kind === 'dynamics' ? request.frameId : String(value.output.frameId)
			if (value.output.frameId !== frame) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.frameMismatch, 'Result frame does not match its request', ['output.frameId']))
			validateDynamicsSamples(value.output.samples, diagnostics, request?.kind === 'dynamics' ? request : undefined)
		} else if (kind === 'climate') {
			checkFields(value.output, ['channels'], 'output', diagnostics)
			validateClimateChannels(value.output.channels, diagnostics, request?.kind === 'climate' ? request : undefined)
		}
	} else {
		if (value.output != null) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'Failed results must not contain output', ['output']))
		if (!hasErrorDiagnostic) diagnostics.push(issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.resultInvalid, 'Failed results require at least one error diagnostic', ['diagnostics']))
	}
	return diagnostics.length === 0
		? { ok: true, value: value as unknown as ExternalRunResult, diagnostics: [] }
		: { ok: false, diagnostics }
}

function parseJson<T>(json: string, validator: (value: unknown) => ValidationResult<T>): ValidationResult<T> {
	if (json.length > EXTERNAL_ADAPTER_LIMITS.maxJsonCharacters) return { ok: false, diagnostics: [issue(
		EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.jsonTooLarge,
		`JSON exceeds ${EXTERNAL_ADAPTER_LIMITS.maxJsonCharacters} characters`,
		['$'],
	)] }
	try {
		return validator(JSON.parse(json))
	} catch (error) {
		return { ok: false, diagnostics: [issue(
			EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.jsonInvalid,
			`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
			['$'],
		)] }
	}
}

function serialize<T>(value: unknown, validator: (input: unknown) => ValidationResult<T>): SerializationResult {
	const validation = validator(value)
	if (!validation.ok) return validation
	try {
		const json = JSON.stringify(validation.value)
		if (json.length > EXTERNAL_ADAPTER_LIMITS.maxJsonCharacters) return { ok: false, diagnostics: [issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.jsonTooLarge, 'Serialized JSON exceeds the external adapter limit', ['$'])] }
		return { ok: true, json, diagnostics: [] }
	} catch (error) {
		return { ok: false, diagnostics: [issue(EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.jsonInvalid, `Could not serialize external contract: ${error instanceof Error ? error.message : String(error)}`, ['$'])] }
	}
}

export function parseExternalRunRequestJson(json: string): ValidationResult<ExternalRunRequest> {
	return parseJson(json, validateExternalRunRequest)
}

export function serializeExternalRunRequest(value: unknown): SerializationResult {
	return serialize(value, validateExternalRunRequest)
}

export function parseExternalRunResultJson(json: string): ValidationResult<ExternalRunResult> {
	return parseJson(json, value => validateExternalRunResult(value))
}

export function serializeExternalRunResult(value: unknown): SerializationResult {
	return serialize(value, input => validateExternalRunResult(input))
}

function adapterFailure(
	request: ExternalRunRequest,
	adapter: ExternalEngineAdapter,
	error: unknown,
	additionalDiagnostics: readonly Diagnostic[] = [],
): ExternalRunFailure {
	return {
		schemaVersion: EXTERNAL_RUN_SCHEMA_VERSION,
		requestId: request.requestId,
		...(request.scenarioId ? { scenarioId: request.scenarioId } : {}),
		kind: request.kind,
		ok: false,
		provenance: {
			engine: clone(adapter.engine),
			adapter: { id: adapter.id, version: adapter.version },
		},
		diagnostics: [
			issue(
				EXTERNAL_ADAPTER_DIAGNOSTIC_CODES.adapterFailure,
				`External adapter failed: ${error instanceof Error ? error.message : String(error)}`,
				['adapter'],
				undefined,
				'numerical-failure',
			),
			...additionalDiagnostics,
		],
	}
}

/** Executes an explicitly supplied adapter; the core performs no I/O by itself. */
export async function runExternalAdapter<PreparedRequest, RawResponse>(
	adapter: ExternalEngineAdapter<PreparedRequest, RawResponse>,
	request: ExternalRunRequest,
): Promise<ExternalRunResult> {
	const validatedRequest = validateExternalRunRequest(request)
	if (!validatedRequest.ok) return adapterFailure(
		request,
		adapter,
		'request validation failed',
		validatedRequest.diagnostics,
	)
	if (adapter.engine.kind !== request.kind || adapter.engine.id !== request.engine.id) return adapterFailure(request, adapter, 'adapter engine does not match request engine')
	try {
		const prepared = await adapter.prepare(validatedRequest.value)
		const raw = await adapter.execute(prepared)
		const interpreted = await adapter.interpret(raw, validatedRequest.value)
		const result = validateExternalRunResult(interpreted, validatedRequest.value)
		if (!result.ok) return adapterFailure(
			request,
			adapter,
			'interpreted result validation failed',
			result.diagnostics,
		)
		if (
			result.value.provenance.adapter.id !== adapter.id
			|| result.value.provenance.adapter.version !== adapter.version
		) return adapterFailure(request, adapter, 'interpreted result adapter provenance does not match adapter')
		return result.value
	} catch (error) {
		return adapterFailure(request, adapter, error)
	}
}

export function createExternalProvenance(
	engine: ExternalEngineReference,
	adapterId: string,
	adapterVersion = EXTERNAL_ADAPTER_API_VERSION,
): { engine: ExternalEngineReference, adapter: { id: string, version: string } } {
	return {
		engine: clone(engine),
		adapter: { id: adapterId, version: adapterVersion },
	}
}
