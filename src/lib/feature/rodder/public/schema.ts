import { z } from 'zod'
import { RODDER_KINDS } from './parent-rules.js'
import { ringSystemSchema } from './ring-system.js'

const nullableUnitIntervalSchema = z.number().min(0).max(1).nullish()
// Bound orbits have 0 ≤ e < 1. e ≥ 1 is a parabolic/hyperbolic escape trajectory,
// and e = 1 makes the Kepler solver divide by zero — reject it at the data layer.
const nullableEccentricitySchema = z.number().min(0).lt(1).nullish()

// Optional display-string overrides for otherwise auto-derived fields. Persisted
// into the `extra` JSONB so the "lock to override" UI actually sticks.
const overrideString = z.string().nullish()

export const rodderExtraSchema = z.object({
	ringSystem: ringSystemSchema.optional(),
}).catchall(z.unknown())

/** Fields shared by every rodder kind. */
const coreSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	extra: rodderExtraSchema.optional(),
	description: z.string().optional(),
})

/** Fields shared by the orbiting kinds (star, body). */
const orbiterSchema = z.object({
	parentId: z.number().int().nullish(),

	massKg: z.number().positive().nullish(),
	radiusM: z.number().positive().nullish(),
	age: z.string().nullish(),

	rotationPeriodS: z.number().positive().nullish(),
	axialTilt: z.number().nullish(),

	orbitalPeriodDays: z.number().positive().nullish(),
	semiMajorAxisAu: z.number().min(0).nullish(),
	eccentricity: nullableEccentricitySchema,
	epochPhase: nullableUnitIntervalSchema,

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),

	// Display-string overrides for derived fields (persisted into extra).
	density: overrideString,
	surfaceGravity: overrideString,
	escapeVelocity: overrideString,
})

const systemSchema = coreSchema.extend({
	// The system type (single/binary/trinary/…) is not stored — it is derived
	// from the star count at read time (deriveSystemType).

	// Placement & metadata. Sector X/Y/Z is the root position in the system's
	// declared sector frame (rodder_sector_roots), not a column on the
	// system row; the service enforces complete-triple-or-nothing because the
	// patch must first merge with the stored position (see sector-position.ts).
	distanceLy: z.number().nullish(),
	sectorId: z.number().int().positive().nullish(),
	sectorX: z.number().finite().nullish(),
	sectorY: z.number().finite().nullish(),
	sectorZ: z.number().finite().nullish(),
	formationAge: z.string().nullish(),
	designations: z.string().nullish(),
})

export const createSystemSchema = systemSchema
export const updateSystemSchema = systemSchema.partial()

const starSchema = coreSchema.extend(orbiterSchema.shape).extend({
	spectralType: z.string().nullish(),
	luminosityW: z.number().positive().nullish(),
	luminosityVisual: z.string().nullish(),
	temperatureK: z.number().positive().nullish(),
	color: z.string().nullish(),

	absoluteMagnitude: z.string().nullish(),
	metallicity: z.string().nullish(),

	luminosity: overrideString,
})

function starHasOrbitalData(data: Partial<z.infer<typeof starSchema>>) {
	return data.orbitalPeriodDays != null
		|| data.semiMajorAxisAu != null
		|| data.eccentricity != null
		|| data.epochPhase != null
}

function validateStarCreate(data: Partial<z.infer<typeof starSchema>>, ctx: z.RefinementCtx) {
	if (starHasOrbitalData(data) && data.parentId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Stars with orbital data must orbit a parent system or star' })
	}
}

// On a partial update only enforce cross-field rules when the referenced field is
// actually present in the patch — the service re-validates the merged row with the
// create schema, so absent fields are covered there, not here.
function validateStarUpdate(data: Partial<z.infer<typeof starSchema>>, ctx: z.RefinementCtx) {
	if (starHasOrbitalData(data) && 'parentId' in data && data.parentId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Stars with orbital data must orbit a parent system or star' })
	}
}

export const createStarSchema = starSchema.superRefine(validateStarCreate)
export const updateStarSchema = starSchema.partial().superRefine(validateStarUpdate)

const planetaryBodySchema = coreSchema.extend(orbiterSchema.shape).extend({
	bodyType: z.enum(['planet', 'asteroid', 'ring_system']).default('planet'),
	sectorId: z.number().int().positive().nullish(),
	sectorX: z.number().finite().nullish(),
	sectorY: z.number().finite().nullish(),
	sectorZ: z.number().finite().nullish(),

	temperatureK: z.number().positive().finite().nullish(),
	composition: z.string().nullish(),
	atmosphere: z.string().nullish(),
	surfacePressure: z.string().nullish(),
	inclination: z.number().nullish(),
	longitudeAscendingNode: z.number().nullish(),
	argumentOfPeriapsis: z.number().nullish(),

	satellites: z.number().int().min(0).nullish(),
})

function validatePlanetaryBodyCreate(data: Partial<z.infer<typeof planetaryBodySchema>>, ctx: z.RefinementCtx) {
	if (data.parentId == null && data.bodyType === 'ring_system') {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Ring systems must orbit a parent body' })
	}
	if (data.parentId == null && starHasOrbitalData(data)) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Unbound sector roots cannot carry parent-relative orbital data' })
	}
	if (data.bodyType !== 'ring_system' && data.extra?.ringSystem != null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extra', 'ringSystem'], message: 'Only ring-system bodies may carry a ring-system facet' })
	}
}

// Presence-aware update validation — the service merges with the current row and
// re-validates with the create schema, so only flag fields actually being set.
function validatePlanetaryBodyUpdate(data: Partial<z.infer<typeof planetaryBodySchema>>, ctx: z.RefinementCtx) {
	if ('parentId' in data && data.parentId == null && data.bodyType === 'ring_system') {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Ring systems must orbit a parent body' })
	}
	if (data.bodyType != null && data.bodyType !== 'ring_system' && data.extra?.ringSystem != null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extra', 'ringSystem'], message: 'Only ring-system bodies may carry a ring-system facet' })
	}
}

export const createPlanetaryBodySchema = planetaryBodySchema.superRefine(validatePlanetaryBodyCreate)
export const updatePlanetaryBodySchema = planetaryBodySchema.partial().superRefine(validatePlanetaryBodyUpdate)

/** Per-kind schema lookups for the unified /api/rodder routes. */
export const CREATE_SCHEMAS = {
	system: createSystemSchema,
	star: createStarSchema,
	body: createPlanetaryBodySchema,
} as const

export const UPDATE_SCHEMAS = {
	system: updateSystemSchema,
	star: updateStarSchema,
	body: updatePlanetaryBodySchema,
} as const

export const rodderKindSchema = z.object({ kind: z.enum(RODDER_KINDS) })
