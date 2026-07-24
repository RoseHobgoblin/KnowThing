import type { Diagnostic, QuantityRecord } from './model-types.js'
import {
	SCENARIO_LIMITS,
	SCENARIO_REPORT_SCHEMA_VERSION,
	SCENARIO_SCHEMA_VERSION,
	type BodyMetadata,
	type EllipticalOrbitRecord,
	type ReferenceFrame,
	type ScenarioInput,
	type ScenarioReport,
	type ScientificBody,
	type SerializationResult,
	type TimeContext,
	type ValidationResult,
} from './scenario-types.js'

export const SCENARIO_DIAGNOSTIC_CODES = {
	jsonInvalid: 'scenario.json.invalid',
	jsonTooLarge: 'scenario.json.too-large',
	rootInvalid: 'scenario.root.invalid',
	schemaVersionUnsupported: 'scenario.schema-version.unsupported',
	fieldUnknown: 'scenario.field.unknown',
	stringInvalid: 'scenario.string.invalid',
	numberNonFinite: 'scenario.number.non-finite',
	numberNonPositive: 'scenario.number.non-positive',
	arrayInvalid: 'scenario.array.invalid',
	resourceLimitExceeded: 'scenario.resource-limit.exceeded',
	timeScaleInvalid: 'scenario.time.scale.invalid',
	frameInvalid: 'scenario.frame.invalid',
	frameDuplicate: 'scenario.frame.duplicate',
	frameOriginMissing: 'scenario.frame.origin-missing',
	bodyInvalid: 'scenario.body.invalid',
	bodyDuplicate: 'scenario.body.duplicate',
	bodyReferenceMissing: 'scenario.body.reference-missing',
	bodyGraphCycle: 'scenario.body.graph-cycle',
	quantityInvalid: 'scenario.quantity.invalid',
	quantityUnitInvalid: 'scenario.quantity.unit-invalid',
	orbitEccentricityInvalid: 'scenario.orbit.eccentricity.invalid',
	orbitPhaseInvalid: 'scenario.orbit.epoch-phase.invalid',
	orbitAxisMeaningInvalid: 'scenario.orbit.axis-meaning.invalid',
	orbitFrameMissing: 'scenario.orbit.frame-missing',
	orbitFrameIncompatible: 'scenario.orbit.frame-incompatible',
	metadataBodyMissing: 'scenario.metadata.body-missing',
	metadataDuplicate: 'scenario.metadata.duplicate',
	reportInvalid: 'scenario.report.invalid',
	uncertaintyInvalid: 'scenario.uncertainty.invalid',
	dependencyMissing: 'scenario.dependency.missing',
	dependencyCycle: 'scenario.dependency.cycle',
	dependencyDepthExceeded: 'scenario.dependency.depth-exceeded',
	serializationInvalid: 'scenario.serialization.invalid',
} as const

const TIME_SCALES = new Set(['model-day', 'UTC', 'TAI', 'TT', 'TDB'])
const FRAME_PLANES = new Set(['xy-reference', 'ecliptic', 'equatorial', 'custom'])
const BODY_KINDS = new Set(['star', 'planet', 'moon', 'minor-body', 'barycenter', 'other'])
const AXIS_MEANINGS = new Set([
	'parent-centred',
	'relative-separation',
	'barycentric-component',
])
const UNITS = new Set([
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
	'W/m^2',
	'K',
	'm^3/s^2',
	'AU',
])
const MODEL_KINDS = new Set([
	'exact-relation',
	'numerical-solution',
	'approximation',
	'empirical-fit',
	'screening',
])
const SOURCE_TYPES = new Set(['paper', 'standard', 'textbook', 'derivation', 'documentation'])
const DIAGNOSTIC_CATEGORIES = new Set([
	'invalid-input',
	'missing-input',
	'outside-domain',
	'numerical-failure',
	'approximation',
	'physical-warning',
])
const DIAGNOSTIC_SEVERITIES = new Set(['info', 'warning', 'error'])
const INPUT_SOURCES = new Set(['caller', 'default', 'derived'])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return value != null && typeof value === 'object' && !Array.isArray(value)
}

function issue(
	code: string,
	message: string,
	path: string,
	evidence?: Diagnostic['evidence'],
): Diagnostic {
	return {
		code,
		category: 'invalid-input',
		severity: 'error',
		message,
		fields: [path],
		...(evidence ? { evidence } : {}),
		modelId: 'scenario.schema',
	}
}

function checkUnknownFields(
	value: UnknownRecord,
	allowed: readonly string[],
	path: string,
	diagnostics: Diagnostic[],
): void {
	const allowedSet = new Set(allowed)
	for (const key of Object.keys(value)) {
		if (!allowedSet.has(key)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.fieldUnknown,
				`${path}.${key} is not part of this schema version`,
				`${path}.${key}`,
			))
		}
	}
}

function checkString(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): value is string {
	if (typeof value === 'string' && value.trim().length > 0) return true
	diagnostics.push(issue(
		SCENARIO_DIAGNOSTIC_CODES.stringInvalid,
		`${path} must be a non-empty string`,
		path,
	))
	return false
}

function checkFinite(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): value is number {
	if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return true
	diagnostics.push(issue(
		SCENARIO_DIAGNOSTIC_CODES.numberNonFinite,
		`${path} must be a finite number and must not be negative zero`,
		path,
		{ value: String(value) },
	))
	return false
}

function checkPositive(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): value is number {
	if (!checkFinite(value, path, diagnostics)) return false
	if (value > 0) return true
	diagnostics.push(issue(
		SCENARIO_DIAGNOSTIC_CODES.numberNonPositive,
		`${path} must be greater than zero`,
		path,
		{ value },
	))
	return false
}

function validateQuantity(
	value: unknown,
	unit: string,
	path: string,
	diagnostics: Diagnostic[],
	options: { positive?: boolean, minimum?: number, maximumExclusive?: number, maximum?: number } = {},
): value is QuantityRecord {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.quantityInvalid,
			`${path} must be a quantity record`,
			path,
		))
		return false
	}
	checkUnknownFields(value, ['value', 'unit'], path, diagnostics)
	if (value.unit !== unit) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.quantityUnitInvalid,
			`${path}.unit must be ${unit}`,
			`${path}.unit`,
			{ expected: unit, actual: String(value.unit) },
		))
	}
	const numberValid = options.positive
		? checkPositive(value.value, `${path}.value`, diagnostics)
		: checkFinite(value.value, `${path}.value`, diagnostics)
	if (!numberValid) return false
	const number = value.value as number
	if (options.minimum != null && number < options.minimum) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.quantityInvalid,
			`${path}.value must be at least ${options.minimum}`,
			`${path}.value`,
			{ value: number, minimum: options.minimum },
		))
	}
	if (options.maximumExclusive != null && number >= options.maximumExclusive) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.quantityInvalid,
			`${path}.value must be less than ${options.maximumExclusive}`,
			`${path}.value`,
			{ value: number, maximumExclusive: options.maximumExclusive },
		))
	}
	if (options.maximum != null && number > options.maximum) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.quantityInvalid,
			`${path}.value must not exceed ${options.maximum}`,
			`${path}.value`,
			{ value: number, maximum: options.maximum },
		))
	}
	return true
}

function validateTime(value: unknown, path: string, diagnostics: Diagnostic[]): value is TimeContext {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.rootInvalid,
			`${path} must be an object`,
			path,
		))
		return false
	}
	checkUnknownFields(value, ['epoch', 'scale', 'secondsPerDay'], path, diagnostics)
	checkString(value.epoch, `${path}.epoch`, diagnostics)
	if (!TIME_SCALES.has(String(value.scale))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.timeScaleInvalid,
			`${path}.scale must be model-day, UTC, TAI, TT or TDB`,
			`${path}.scale`,
			{ value: String(value.scale) },
		))
	}
	checkPositive(value.secondsPerDay, `${path}.secondsPerDay`, diagnostics)
	return true
}

function validateFrame(
	value: unknown,
	index: number,
	diagnostics: Diagnostic[],
): value is ReferenceFrame {
	const path = `frames[${index}]`
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.frameInvalid,
			`${path} must be an object`,
			path,
		))
		return false
	}
	checkUnknownFields(
		value,
		['id', 'originBodyId', 'plane', 'direction', 'handedness'],
		path,
		diagnostics,
	)
	checkString(value.id, `${path}.id`, diagnostics)
	checkString(value.originBodyId, `${path}.originBodyId`, diagnostics)
	if (!FRAME_PLANES.has(String(value.plane))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.frameInvalid,
			`${path}.plane is not a supported reference plane`,
			`${path}.plane`,
			{ value: String(value.plane) },
		))
	}
	checkString(value.direction, `${path}.direction`, diagnostics)
	if (value.handedness !== 'right') {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.frameInvalid,
			`${path}.handedness must be right`,
			`${path}.handedness`,
			{ value: String(value.handedness) },
		))
	}
	return true
}

function validateOrbit(
	value: unknown,
	bodyPath: string,
	diagnostics: Diagnostic[],
): value is EllipticalOrbitRecord {
	const path = `${bodyPath}.orbit`
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.bodyInvalid,
			`${path} must be an object`,
			path,
		))
		return false
	}
	checkUnknownFields(value, [
		'kind',
		'primaryId',
		'frameId',
		'semiMajorAxis',
		'axisMeaning',
		'eccentricity',
		'inclination',
		'longitudeAscendingNode',
		'argumentOfPeriapsis',
		'epochPhase',
		'mu',
	], path, diagnostics)
	if (value.kind !== 'elliptical') {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.bodyInvalid,
			`${path}.kind must be elliptical`,
			`${path}.kind`,
			{ value: String(value.kind) },
		))
	}
	checkString(value.primaryId, `${path}.primaryId`, diagnostics)
	checkString(value.frameId, `${path}.frameId`, diagnostics)
	validateQuantity(value.semiMajorAxis, 'AU', `${path}.semiMajorAxis`, diagnostics, {
		positive: true,
	})
	if (!AXIS_MEANINGS.has(String(value.axisMeaning))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.orbitAxisMeaningInvalid,
			`${path}.axisMeaning is not supported`,
			`${path}.axisMeaning`,
			{ value: String(value.axisMeaning) },
		))
	}
	const eccentricityStart = diagnostics.length
	validateQuantity(value.eccentricity, '1', `${path}.eccentricity`, diagnostics, {
		minimum: 0,
		maximumExclusive: 1,
	})
	for (let index = eccentricityStart; index < diagnostics.length; index += 1) {
		if (diagnostics[index]?.code === SCENARIO_DIAGNOSTIC_CODES.quantityInvalid) {
			diagnostics[index] = {
				...diagnostics[index],
				code: SCENARIO_DIAGNOSTIC_CODES.orbitEccentricityInvalid,
			}
		}
	}
	validateQuantity(value.inclination, 'deg', `${path}.inclination`, diagnostics)
	validateQuantity(
		value.longitudeAscendingNode,
		'deg',
		`${path}.longitudeAscendingNode`,
		diagnostics,
	)
	validateQuantity(
		value.argumentOfPeriapsis,
		'deg',
		`${path}.argumentOfPeriapsis`,
		diagnostics,
	)
	const phaseStart = diagnostics.length
	validateQuantity(value.epochPhase, '1', `${path}.epochPhase`, diagnostics, {
		minimum: 0,
		maximum: 1,
	})
	for (let index = phaseStart; index < diagnostics.length; index += 1) {
		if (diagnostics[index]?.code === SCENARIO_DIAGNOSTIC_CODES.quantityInvalid) {
			diagnostics[index] = {
				...diagnostics[index],
				code: SCENARIO_DIAGNOSTIC_CODES.orbitPhaseInvalid,
			}
		}
	}
	validateQuantity(value.mu, 'm^3/s^2', `${path}.mu`, diagnostics, { positive: true })
	return true
}

function validateBody(
	value: unknown,
	index: number,
	diagnostics: Diagnostic[],
): value is ScientificBody {
	const path = `bodies[${index}]`
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.bodyInvalid,
			`${path} must be an object`,
			path,
		))
		return false
	}
	checkUnknownFields(
		value,
		['id', 'kind', 'mass', 'radius', 'luminosity', 'temperature', 'orbit'],
		path,
		diagnostics,
	)
	checkString(value.id, `${path}.id`, diagnostics)
	if (!BODY_KINDS.has(String(value.kind))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.bodyInvalid,
			`${path}.kind is not supported`,
			`${path}.kind`,
			{ value: String(value.kind) },
		))
	}
	if (value.mass != null) {
		validateQuantity(value.mass, 'kg', `${path}.mass`, diagnostics, { positive: true })
	}
	if (value.radius != null) {
		validateQuantity(value.radius, 'm', `${path}.radius`, diagnostics, { positive: true })
	}
	if (value.luminosity != null) {
		validateQuantity(value.luminosity, 'W', `${path}.luminosity`, diagnostics, {
			positive: true,
		})
	}
	if (value.temperature != null) {
		validateQuantity(value.temperature, 'K', `${path}.temperature`, diagnostics, {
			positive: true,
		})
	}
	if (value.orbit != null) validateOrbit(value.orbit, path, diagnostics)
	return true
}

function validateMetadata(
	value: unknown,
	index: number,
	diagnostics: Diagnostic[],
): value is BodyMetadata {
	const path = `metadata[${index}]`
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.bodyInvalid,
			`${path} must be an object`,
			path,
		))
		return false
	}
	checkUnknownFields(
		value,
		['bodyId', 'name', 'description', 'classifications', 'fields'],
		path,
		diagnostics,
	)
	checkString(value.bodyId, `${path}.bodyId`, diagnostics)
	for (const field of ['name', 'description'] as const) {
		if (value[field] != null) checkString(value[field], `${path}.${field}`, diagnostics)
	}
	if (value.classifications != null) {
		if (Array.isArray(value.classifications)) {
			for (const [classificationIndex, classification] of value.classifications.entries()) {
				checkString(
					classification,
					`${path}.classifications[${classificationIndex}]`,
					diagnostics,
				)
			}
		} else {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
				`${path}.classifications must be an array`,
				`${path}.classifications`,
			))
		}
	}
	if (value.fields != null) {
		if (isRecord(value.fields)) {
			for (const [key, fieldValue] of Object.entries(value.fields)) {
				if (
					typeof fieldValue !== 'string'
					&& typeof fieldValue !== 'boolean'
					&& (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue))
				) {
					diagnostics.push(issue(
						SCENARIO_DIAGNOSTIC_CODES.numberNonFinite,
						`${path}.fields.${key} must be a finite JSON primitive`,
						`${path}.fields.${key}`,
					))
				}
			}
		} else {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.rootInvalid,
				`${path}.fields must be an object`,
				`${path}.fields`,
			))
		}
	}
	return true
}

function findGraphCycles(
	bodies: readonly ScientificBody[],
	indexById: ReadonlyMap<string, number>,
	diagnostics: Diagnostic[],
): void {
	const state = new Map<string, 'visiting' | 'visited'>()
	const stack: string[] = []

	function visit(body: ScientificBody): void {
		const current = state.get(body.id)
		if (current === 'visited') return
		if (current === 'visiting') {
			const cycleStart = stack.indexOf(body.id)
			const cycle = [...stack.slice(cycleStart), body.id]
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.bodyGraphCycle,
				`Body orbit graph contains a cycle: ${cycle.join(' -> ')}`,
				'bodies',
				{ cycle: cycle.join(' -> ') },
			))
			return
		}
		state.set(body.id, 'visiting')
		stack.push(body.id)
		const primaryId = body.orbit?.primaryId
		const primaryIndex = primaryId == null ? undefined : indexById.get(primaryId)
		if (primaryIndex != null) visit(bodies[primaryIndex] as ScientificBody)
		stack.pop()
		state.set(body.id, 'visited')
	}

	for (const body of bodies) visit(body)
}

export function validateScenario(value: unknown): ValidationResult<ScenarioInput> {
	const diagnostics: Diagnostic[] = []
	if (!isRecord(value)) {
		return {
			ok: false,
			diagnostics: [issue(
				SCENARIO_DIAGNOSTIC_CODES.rootInvalid,
				'Scenario must be an object',
				'$',
			)],
		}
	}
	checkUnknownFields(
		value,
		['schemaVersion', 'scenarioId', 'time', 'frames', 'bodies', 'metadata'],
		'$',
		diagnostics,
	)
	if (value.schemaVersion !== SCENARIO_SCHEMA_VERSION) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.schemaVersionUnsupported,
			`schemaVersion must be ${SCENARIO_SCHEMA_VERSION}`,
			'$.schemaVersion',
			{ value: String(value.schemaVersion), supported: SCENARIO_SCHEMA_VERSION },
		))
	}
	if (value.scenarioId != null) checkString(value.scenarioId, '$.scenarioId', diagnostics)
	validateTime(value.time, 'time', diagnostics)

	const frames = Array.isArray(value.frames) ? value.frames : []
	if (!Array.isArray(value.frames)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			'frames must be an array',
			'frames',
		))
	}
	if (frames.length > SCENARIO_LIMITS.maxFrames) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.resourceLimitExceeded,
			`frames exceeds the limit of ${SCENARIO_LIMITS.maxFrames}`,
			'frames',
			{ count: frames.length, limit: SCENARIO_LIMITS.maxFrames },
		))
	}
	for (const [index, frame] of frames.entries()) validateFrame(frame, index, diagnostics)

	const bodies = Array.isArray(value.bodies) ? value.bodies : []
	if (!Array.isArray(value.bodies)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			'bodies must be an array',
			'bodies',
		))
	}
	if (bodies.length > SCENARIO_LIMITS.maxBodies) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.resourceLimitExceeded,
			`bodies exceeds the limit of ${SCENARIO_LIMITS.maxBodies}`,
			'bodies',
			{ count: bodies.length, limit: SCENARIO_LIMITS.maxBodies },
		))
	}
	for (const [index, body] of bodies.entries()) validateBody(body, index, diagnostics)

	const metadata = value.metadata == null
		? []
		: (Array.isArray(value.metadata) ? value.metadata : [])
	if (value.metadata != null && !Array.isArray(value.metadata)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			'metadata must be an array',
			'metadata',
		))
	}
	for (const [index, item] of metadata.entries()) validateMetadata(item, index, diagnostics)

	const typedBodies = bodies.filter(isRecord) as unknown as ScientificBody[]
	const bodyIndex = new Map<string, number>()
	for (const [index, body] of typedBodies.entries()) {
		if (typeof body.id !== 'string') continue
		if (bodyIndex.has(body.id)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.bodyDuplicate,
				`Body ID ${body.id} is duplicated`,
				`bodies[${index}].id`,
				{ id: body.id },
			))
		} else {
			bodyIndex.set(body.id, index)
		}
	}
	const frameIndex = new Map<string, ReferenceFrame>()
	for (const [index, frame] of frames.entries()) {
		if (!isRecord(frame) || typeof frame.id !== 'string') continue
		if (frameIndex.has(frame.id)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.frameDuplicate,
				`Frame ID ${frame.id} is duplicated`,
				`frames[${index}].id`,
				{ id: frame.id },
			))
		} else {
			frameIndex.set(frame.id, frame as unknown as ReferenceFrame)
		}
	}
	for (const [index, frame] of frames.entries()) {
		if (
			isRecord(frame)
			&& typeof frame.originBodyId === 'string'
			&& !bodyIndex.has(frame.originBodyId)
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.frameOriginMissing,
				`Frame origin ${frame.originBodyId} does not resolve to a body`,
				`frames[${index}].originBodyId`,
				{ id: frame.originBodyId },
			))
		}
	}
	for (const [index, body] of typedBodies.entries()) {
		const orbit = body.orbit
		if (!isRecord(orbit)) continue
		const primaryId = typeof orbit.primaryId === 'string' ? orbit.primaryId : ''
		const frameId = typeof orbit.frameId === 'string' ? orbit.frameId : ''
		if (primaryId && !bodyIndex.has(primaryId)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.bodyReferenceMissing,
				`Orbit primary ${primaryId} does not resolve to a body`,
				`bodies[${index}].orbit.primaryId`,
				{ id: primaryId },
			))
		}
		const frame = frameIndex.get(frameId)
		if (frameId && !frame) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.orbitFrameMissing,
				`Orbit frame ${frameId} does not resolve`,
				`bodies[${index}].orbit.frameId`,
				{ id: frameId },
			))
		} else if (frame && primaryId && frame.originBodyId !== primaryId) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.orbitFrameIncompatible,
				`Orbit frame origin ${frame.originBodyId} does not match primary ${primaryId}`,
				`bodies[${index}].orbit.frameId`,
				{ frameOriginBodyId: frame.originBodyId, primaryId },
			))
		}
		if (orbit.axisMeaning === 'barycentric-component') {
			const primaryIndex = bodyIndex.get(primaryId)
			const primary = primaryIndex == null ? undefined : typedBodies[primaryIndex]
			if (primary?.kind !== 'barycenter') {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.orbitFrameIncompatible,
					'A barycentric-component orbit must reference a barycenter body',
					`bodies[${index}].orbit.primaryId`,
					{ primaryId },
				))
			}
		}
	}
	const metadataIds = new Set<string>()
	for (const [index, item] of metadata.entries()) {
		if (!isRecord(item) || typeof item.bodyId !== 'string') continue
		if (!bodyIndex.has(item.bodyId)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.metadataBodyMissing,
				`Metadata body ${item.bodyId} does not resolve`,
				`metadata[${index}].bodyId`,
				{ id: item.bodyId },
			))
		}
		if (metadataIds.has(item.bodyId)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.metadataDuplicate,
				`Metadata for body ${item.bodyId} is duplicated`,
				`metadata[${index}].bodyId`,
				{ id: item.bodyId },
			))
		}
		metadataIds.add(item.bodyId)
	}
	findGraphCycles(typedBodies, bodyIndex, diagnostics)

	if (diagnostics.length > 0) return { ok: false, diagnostics }
	return { ok: true, value: value as unknown as ScenarioInput, diagnostics }
}

function validateFiniteJson(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
	seen: Set<object>,
): void {
	if (
		value == null
		|| typeof value === 'string'
		|| typeof value === 'boolean'
	) return
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || Object.is(value, -0)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.numberNonFinite,
				`${path} contains a non-finite number or negative zero`,
				path,
				{ value: String(value) },
			))
		}
		return
	}
	if (typeof value !== 'object') {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.serializationInvalid,
			`${path} is not JSON serialisable`,
			path,
		))
		return
	}
	if (seen.has(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.serializationInvalid,
			`${path} contains a circular object reference`,
			path,
		))
		return
	}
	seen.add(value)
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			validateFiniteJson(item, `${path}[${index}]`, diagnostics, seen)
		}
	} else {
		for (const [key, item] of Object.entries(value)) {
			validateFiniteJson(item, `${path}.${key}`, diagnostics, seen)
		}
	}
	seen.delete(value)
}

function validateDiagnosticRecord(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path} must be a diagnostic object`,
			path,
		))
		return
	}
	checkUnknownFields(
		value,
		['code', 'category', 'severity', 'message', 'fields', 'evidence', 'modelId'],
		path,
		diagnostics,
	)
	checkString(value.code, `${path}.code`, diagnostics)
	checkString(value.message, `${path}.message`, diagnostics)
	checkString(value.modelId, `${path}.modelId`, diagnostics)
	if (!DIAGNOSTIC_CATEGORIES.has(String(value.category))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path}.category is not supported`,
			`${path}.category`,
		))
	}
	if (!DIAGNOSTIC_SEVERITIES.has(String(value.severity))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path}.severity is not supported`,
			`${path}.severity`,
		))
	}
	if (Array.isArray(value.fields)) {
		for (const [index, field] of value.fields.entries()) {
			if (typeof field !== 'string') {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
					`${path}.fields[${index}] must be a string`,
					`${path}.fields[${index}]`,
				))
			}
		}
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			`${path}.fields must be an array`,
			`${path}.fields`,
		))
	}
	if (value.evidence != null && !isRecord(value.evidence)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path}.evidence must be an object`,
			`${path}.evidence`,
		))
	}
}

function validateModelReferenceRecord(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path} must be a model reference`,
			path,
		))
		return
	}
	checkUnknownFields(
		value,
		['id', 'version', 'title', 'summary', 'kind', 'sources', 'assumptions', 'validity'],
		path,
		diagnostics,
	)
	for (const field of ['id', 'version', 'title', 'summary'] as const) {
		checkString(value[field], `${path}.${field}`, diagnostics)
	}
	if (typeof value.version === 'string' && !/^\d+\.\d+\.\d+$/.test(value.version)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path}.version must use semantic version form`,
			`${path}.version`,
		))
	}
	if (!MODEL_KINDS.has(String(value.kind))) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path}.kind is not supported`,
			`${path}.kind`,
		))
	}
	if (Array.isArray(value.sources) && value.sources.length > 0) {
		for (const [index, source] of value.sources.entries()) {
			const sourcePath = `${path}.sources[${index}]`
			if (!isRecord(source)) {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
					`${sourcePath} must be an object`,
					sourcePath,
				))
				continue
			}
			checkUnknownFields(source, ['type', 'citation', 'doi', 'url'], sourcePath, diagnostics)
			if (!SOURCE_TYPES.has(String(source.type))) {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
					`${sourcePath}.type is not supported`,
					`${sourcePath}.type`,
				))
			}
			checkString(source.citation, `${sourcePath}.citation`, diagnostics)
			if (source.doi != null) checkString(source.doi, `${sourcePath}.doi`, diagnostics)
			if (source.url != null) checkString(source.url, `${sourcePath}.url`, diagnostics)
		}
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			`${path}.sources must be a non-empty array`,
			`${path}.sources`,
		))
	}
	for (const field of ['assumptions', 'validity'] as const) {
		if (!Array.isArray(value[field])) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
				`${path}.${field} must be an array`,
				`${path}.${field}`,
			))
		}
	}
}

function validateInputsRecord(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path} must be an input record map`,
			path,
		))
		return
	}
	for (const [field, input] of Object.entries(value)) {
		const inputPath = `${path}.${field}`
		if (!isRecord(input)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${inputPath} must be an input record`,
				inputPath,
			))
			continue
		}
		checkUnknownFields(input, ['value', 'unit', 'source', 'uncertainty'], inputPath, diagnostics)
		if (
			typeof input.value !== 'string'
			&& typeof input.value !== 'boolean'
			&& (typeof input.value !== 'number' || !Number.isFinite(input.value))
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${inputPath}.value must be a finite number, string or boolean`,
				`${inputPath}.value`,
			))
		}
		if (input.unit != null && !UNITS.has(String(input.unit))) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.quantityUnitInvalid,
				`${inputPath}.unit is not in the unit registry`,
				`${inputPath}.unit`,
			))
		}
		if (!INPUT_SOURCES.has(String(input.source))) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${inputPath}.source is not supported`,
				`${inputPath}.source`,
			))
		}
		if (input.uncertainty != null) {
			if (typeof input.value !== 'number' || typeof input.unit !== 'string') {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
					`${inputPath}.uncertainty requires a numeric input with a unit`,
					`${inputPath}.uncertainty`,
				))
			}
			validateUncertaintyRecord(
				input.uncertainty,
				`${inputPath}.uncertainty`,
				diagnostics,
				typeof input.value === 'number' ? input.value : undefined,
				typeof input.unit === 'string' ? input.unit : undefined,
			)
		}
	}
}

function validateUncertaintyRecord(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
	nominal?: number,
	inputUnit?: string,
): void {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
			`${path} must be an uncertainty record`,
			path,
		))
		return
	}
	const kind = value.kind
	let allowed = ['kind']
	if (kind === 'standard-deviation') allowed = ['kind', 'value', 'unit']
	if (kind === 'interval') allowed = ['kind', 'lower', 'upper', 'unit', 'confidence']
	if (kind === 'samples') allowed = ['kind', 'values', 'unit']
	checkUnknownFields(value, allowed, path, diagnostics)
	if (!UNITS.has(String(value.unit)) || (inputUnit != null && value.unit !== inputUnit)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
			`${path}.unit must be registered and match its quantity`,
			`${path}.unit`,
		))
	}
	if (kind === 'standard-deviation') {
		if (
			typeof value.value !== 'number'
			|| !Number.isFinite(value.value)
			|| value.value < 0
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path}.value must be finite and non-negative`,
				`${path}.value`,
			))
		}
		return
	}
	if (kind === 'interval') {
		if (
			typeof value.lower !== 'number'
			|| !Number.isFinite(value.lower)
			|| typeof value.upper !== 'number'
			|| !Number.isFinite(value.upper)
			|| value.lower > value.upper
			|| (nominal != null && (value.lower > nominal || nominal > value.upper))
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path} must contain finite ordered bounds enclosing the nominal value`,
				path,
			))
		}
		if (
			value.confidence != null
			&& (
				typeof value.confidence !== 'number'
				|| !Number.isFinite(value.confidence)
				|| value.confidence <= 0
				|| value.confidence > 1
			)
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path}.confidence must be in (0, 1]`,
				`${path}.confidence`,
			))
		}
		return
	}
	if (kind === 'samples') {
		if (
			!Array.isArray(value.values)
			|| value.values.length === 0
			|| value.values.length > SCENARIO_LIMITS.maxInputSamples
			|| !value.values.every(sample => typeof sample === 'number' && Number.isFinite(sample))
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path}.values must be a non-empty bounded array of finite numbers`,
				`${path}.values`,
			))
		}
		return
	}
	diagnostics.push(issue(
		SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
		`${path}.kind is not supported`,
		`${path}.kind`,
	))
}

function validateResultUncertainty(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (!isRecord(value)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
			`${path} must be an uncertainty result`,
			path,
		))
		return
	}
	if (value.kind === 'not-provided') {
		checkUnknownFields(value, ['kind'], path, diagnostics)
		return
	}
	if (value.kind !== 'propagated') {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
			`${path}.kind is not supported`,
			`${path}.kind`,
		))
		return
	}
	const common = ['kind', 'method', 'value', 'outputPath', 'dependence', 'evaluations']
	const allowed = value.method === 'monte-carlo'
		? [...common, 'seed', 'sampleCount', 'samplingPolicy']
		: common
	checkUnknownFields(value, allowed, path, diagnostics)
	validateUncertaintyRecord(value.value, `${path}.value`, diagnostics)
	if (
		typeof value.evaluations !== 'number'
		|| !Number.isInteger(value.evaluations)
		|| value.evaluations < 1
	) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
			`${path}.evaluations must be a positive integer`,
			`${path}.evaluations`,
		))
	}
	if (value.outputPath != null) {
		checkString(value.outputPath, `${path}.outputPath`, diagnostics)
		if (
			typeof value.outputPath === 'string'
			&& !/^[A-Z_a-z]\w*(?:\.[A-Z_a-z]\w*)*$/.test(value.outputPath)
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path}.outputPath must be a dot-separated field path`,
				`${path}.outputPath`,
			))
		}
	}
	if (value.method === 'first-order') {
		if (
			!isRecord(value.value)
			|| value.value.kind !== 'standard-deviation'
			|| (value.dependence !== 'single-input' && value.dependence !== 'independent')
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path} is not a valid first-order propagation record`,
				path,
			))
		}
		return
	}
	if (value.method === 'interval') {
		if (
			!isRecord(value.value)
			|| value.value.kind !== 'interval'
			|| value.dependence !== 'bounds-only'
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path} is not a valid interval propagation record`,
				path,
			))
		}
		return
	}
	if (value.method === 'monte-carlo') {
		if (
			!isRecord(value.value)
			|| value.value.kind !== 'samples'
			|| (value.dependence !== 'single-input' && value.dependence !== 'independent')
			|| typeof value.seed !== 'number'
			|| !Number.isInteger(value.seed)
			|| value.seed < 0
			|| value.seed > 0xFFFF_FFFF
			|| typeof value.sampleCount !== 'number'
			|| !Number.isInteger(value.sampleCount)
			|| value.sampleCount < 1
			|| value.sampleCount > SCENARIO_LIMITS.maxMonteCarloSamples
			|| value.evaluations !== value.sampleCount + 1
			|| !['normal', 'uniform', 'empirical'].includes(String(value.samplingPolicy))
			|| !Array.isArray(value.value.values)
			|| value.value.values.length !== value.sampleCount
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
				`${path} is not a valid bounded Monte Carlo propagation record`,
				path,
			))
		}
		return
	}
	diagnostics.push(issue(
		SCENARIO_DIAGNOSTIC_CODES.uncertaintyInvalid,
		`${path}.method is not supported`,
		`${path}.method`,
	))
}

function validateModelResultRecord(
	value: unknown,
	path: string,
	diagnostics: Diagnostic[],
): void {
	if (!isRecord(value) || (value.ok !== true && value.ok !== false)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			`${path} must be a discriminated model result`,
			path,
		))
		return
	}
	const commonFields = ['ok', 'model', 'inputs', 'diagnostics']
	checkUnknownFields(
		value,
		value.ok ? [...commonFields, 'output', 'numerical', 'uncertainty'] : commonFields,
		path,
		diagnostics,
	)
	validateModelReferenceRecord(value.model, `${path}.model`, diagnostics)
	validateInputsRecord(value.inputs, `${path}.inputs`, diagnostics)
	if (Array.isArray(value.diagnostics)) {
		for (const [index, modelDiagnostic] of value.diagnostics.entries()) {
			validateDiagnosticRecord(modelDiagnostic, `${path}.diagnostics[${index}]`, diagnostics)
		}
		if (
			value.ok === false
			&& !value.diagnostics.some(modelDiagnostic =>
				isRecord(modelDiagnostic) && modelDiagnostic.severity === 'error')
		) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${path} is a failure but has no error diagnostic`,
				`${path}.diagnostics`,
			))
		}
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			`${path}.diagnostics must be an array`,
			`${path}.diagnostics`,
		))
	}
	if (value.ok) {
		if (!Object.hasOwn(value, 'output')) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${path}.output is required for a successful result`,
				`${path}.output`,
			))
		}
		validateResultUncertainty(value.uncertainty, `${path}.uncertainty`, diagnostics)
		if (value.numerical != null && !isRecord(value.numerical)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				`${path}.numerical must be an object`,
				`${path}.numerical`,
			))
		}
	}
}

function validateDependencyGraph(
	results: Readonly<Record<string, unknown>>,
	graph: Readonly<Record<string, readonly string[]>>,
	diagnostics: Diagnostic[],
): void {
	for (const [resultId, dependencies] of Object.entries(graph)) {
		if (!(resultId in results)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.dependencyMissing,
				`Dependency graph key ${resultId} has no corresponding result`,
				`dependencyGraph.${resultId}`,
				{ resultId },
			))
		}
		if (!Array.isArray(dependencies)) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
				`Dependencies for ${resultId} must be an array`,
				`dependencyGraph.${resultId}`,
			))
			continue
		}
		for (const dependency of dependencies) {
			if (typeof dependency !== 'string' || !(dependency in results)) {
				diagnostics.push(issue(
					SCENARIO_DIAGNOSTIC_CODES.dependencyMissing,
					`Dependency ${String(dependency)} does not resolve to a result`,
					`dependencyGraph.${resultId}`,
					{ resultId, dependency: String(dependency) },
				))
			}
		}
	}

	const state = new Map<string, 'visiting' | 'visited'>()
	function visit(resultId: string): void {
		const current = state.get(resultId)
		if (current === 'visited') return
		if (current === 'visiting') {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.dependencyCycle,
				`Dependency graph contains a cycle at ${resultId}`,
				`dependencyGraph.${resultId}`,
				{ resultId },
			))
			return
		}
		state.set(resultId, 'visiting')
		for (const dependency of graph[resultId] ?? []) {
			if (dependency in results) visit(dependency)
		}
		state.set(resultId, 'visited')
	}
	for (const resultId of Object.keys(results)) visit(resultId)

	function checkDepth(resultId: string, depth: number, path: ReadonlySet<string>): void {
		if (depth > SCENARIO_LIMITS.maxDependencyDepth) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.dependencyDepthExceeded,
				`Dependency depth exceeds ${SCENARIO_LIMITS.maxDependencyDepth}`,
				`dependencyGraph.${resultId}`,
				{ limit: SCENARIO_LIMITS.maxDependencyDepth },
			))
			return
		}
		if (path.has(resultId)) return
		const nextPath = new Set(path)
		nextPath.add(resultId)
		for (const dependency of graph[resultId] ?? []) {
			if (dependency in results) checkDepth(dependency, depth + 1, nextPath)
		}
	}
	for (const resultId of Object.keys(results)) checkDepth(resultId, 0, new Set())
}

export function validateScenarioReport(value: unknown): ValidationResult<ScenarioReport> {
	const diagnostics: Diagnostic[] = []
	if (!isRecord(value)) {
		return {
			ok: false,
			diagnostics: [issue(
				SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
				'Scenario report must be an object',
				'$',
			)],
		}
	}
	checkUnknownFields(
		value,
		['schemaVersion', 'scenarioId', 'time', 'frames', 'results', 'diagnostics', 'dependencyGraph'],
		'$',
		diagnostics,
	)
	if (value.schemaVersion !== SCENARIO_REPORT_SCHEMA_VERSION) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.schemaVersionUnsupported,
			`schemaVersion must be ${SCENARIO_REPORT_SCHEMA_VERSION}`,
			'$.schemaVersion',
		))
	}
	if (value.scenarioId != null) checkString(value.scenarioId, '$.scenarioId', diagnostics)
	validateTime(value.time, 'time', diagnostics)
	if (Array.isArray(value.frames)) {
		if (value.frames.length > SCENARIO_LIMITS.maxFrames) {
			diagnostics.push(issue(
				SCENARIO_DIAGNOSTIC_CODES.resourceLimitExceeded,
				`frames exceeds the limit of ${SCENARIO_LIMITS.maxFrames}`,
				'frames',
				{ count: value.frames.length, limit: SCENARIO_LIMITS.maxFrames },
			))
		}
		for (const [index, frame] of value.frames.entries()) validateFrame(frame, index, diagnostics)
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			'frames must be an array',
			'frames',
		))
	}
	if (isRecord(value.results)) {
		for (const [resultId, result] of Object.entries(value.results)) {
			validateModelResultRecord(result, `results.${resultId}`, diagnostics)
		}
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			'results must be an object',
			'results',
		))
	}
	if (Array.isArray(value.diagnostics)) {
		for (const [index, reportDiagnostic] of value.diagnostics.entries()) {
			validateDiagnosticRecord(reportDiagnostic, `diagnostics[${index}]`, diagnostics)
		}
	} else {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.arrayInvalid,
			'diagnostics must be an array',
			'diagnostics',
		))
	}
	if (!isRecord(value.dependencyGraph)) {
		diagnostics.push(issue(
			SCENARIO_DIAGNOSTIC_CODES.reportInvalid,
			'dependencyGraph must be an object',
			'dependencyGraph',
		))
	}
	validateFiniteJson(value, '$', diagnostics, new Set())
	if (isRecord(value.results) && isRecord(value.dependencyGraph)) {
		validateDependencyGraph(
			value.results,
			value.dependencyGraph as Readonly<Record<string, readonly string[]>>,
			diagnostics,
		)
	}
	if (diagnostics.length > 0) return { ok: false, diagnostics }
	return { ok: true, value: value as unknown as ScenarioReport, diagnostics }
}

function parseJson<T>(
	json: string,
	validate: (value: unknown) => ValidationResult<T>,
): ValidationResult<T> {
	if (json.length > SCENARIO_LIMITS.maxJsonCharacters) {
		return {
			ok: false,
			diagnostics: [issue(
				SCENARIO_DIAGNOSTIC_CODES.jsonTooLarge,
				`JSON exceeds ${SCENARIO_LIMITS.maxJsonCharacters} characters`,
				'$',
				{ length: json.length, limit: SCENARIO_LIMITS.maxJsonCharacters },
			)],
		}
	}
	try {
		return validate(JSON.parse(json) as unknown)
	} catch (error) {
		return {
			ok: false,
			diagnostics: [issue(
				SCENARIO_DIAGNOSTIC_CODES.jsonInvalid,
				error instanceof Error ? error.message : 'Invalid JSON',
				'$',
			)],
		}
	}
}

function serialize<T>(
	value: unknown,
	validate: (input: unknown) => ValidationResult<T>,
): SerializationResult {
	const result = validate(value)
	if (!result.ok) return result
	try {
		const json = JSON.stringify(result.value)
		if (json.length > SCENARIO_LIMITS.maxJsonCharacters) {
			return {
				ok: false,
				diagnostics: [issue(
					SCENARIO_DIAGNOSTIC_CODES.jsonTooLarge,
					`JSON exceeds ${SCENARIO_LIMITS.maxJsonCharacters} characters`,
					'$',
					{ length: json.length, limit: SCENARIO_LIMITS.maxJsonCharacters },
				)],
			}
		}
		return { ok: true, json, diagnostics: result.diagnostics }
	} catch (error) {
		return {
			ok: false,
			diagnostics: [issue(
				SCENARIO_DIAGNOSTIC_CODES.serializationInvalid,
				error instanceof Error ? error.message : 'Could not serialize value',
				'$',
			)],
		}
	}
}

export function parseScenarioJson(json: string): ValidationResult<ScenarioInput> {
	return parseJson(json, validateScenario)
}

export function serializeScenario(value: unknown): SerializationResult {
	return serialize(value, validateScenario)
}

export function parseScenarioReportJson(json: string): ValidationResult<ScenarioReport> {
	return parseJson(json, validateScenarioReport)
}

export function serializeScenarioReport(value: unknown): SerializationResult {
	return serialize(value, validateScenarioReport)
}

export interface CreateScenarioReportInput {
	scenario: unknown
	results: ScenarioReport['results']
	dependencyGraph: ScenarioReport['dependencyGraph']
	diagnostics?: ScenarioReport['diagnostics']
}

export function createScenarioReport(
	input: CreateScenarioReportInput,
): ValidationResult<ScenarioReport> {
	const scenario = validateScenario(input.scenario)
	if (!scenario.ok) return scenario
	const report: ScenarioReport = {
		schemaVersion: SCENARIO_REPORT_SCHEMA_VERSION,
		...(scenario.value.scenarioId == null ? {} : { scenarioId: scenario.value.scenarioId }),
		time: scenario.value.time,
		frames: scenario.value.frames,
		results: input.results,
		diagnostics: input.diagnostics ?? [],
		dependencyGraph: input.dependencyGraph,
	}
	return validateScenarioReport(report)
}
