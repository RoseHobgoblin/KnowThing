import { z } from 'zod'

const nullableUnitIntervalSchema = z.number().min(0).max(1).nullish()
// Bound orbits have 0 ≤ e < 1. e ≥ 1 is a parabolic/hyperbolic escape trajectory,
// and e = 1 makes the Kepler solver divide by zero — reject it at the data layer.
const nullableEccentricitySchema = z.number().min(0).lt(1).nullish()

// Optional display-string overrides for otherwise auto-derived fields. Persisted
// into the `extra` JSONB so the "lock to override" UI actually sticks.
const overrideString = z.string().nullish()

const systemSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	pageSlug: z.string().nullish(),
	// Derived from star count at read time; kept only as a stub fallback for
	// zero-star systems and preset creation. Not edited via the configure form.
	systemType: z.enum(['single', 'binary', 'trinary', 'multiple']).default('single'),
	description: z.string().optional(),

	// Placement & metadata.
	distanceLy: z.number().nullish(),
	galacticX: z.number().nullish(),
	galacticY: z.number().nullish(),
	galacticZ: z.number().nullish(),
	formationAge: z.string().nullish(),
	designations: z.string().nullish(),

	extra: z.record(z.string(), z.unknown()).optional(),
})

export const createSystemSchema = systemSchema
export const updateSystemSchema = systemSchema.partial()

const starSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	pageSlug: z.string().nullish(),

	spectralType: z.string().nullish(),
	massKg: z.number().positive().nullish(),
	radiusM: z.number().positive().nullish(),
	luminosityW: z.number().positive().nullish(),
	luminosityVisual: z.string().nullish(),
	temperatureK: z.number().positive().nullish(),
	age: z.string().nullish(),
	color: z.string().nullish(),

	rotationPeriodS: z.number().positive().nullish(),
	axialTilt: z.number().nullish(),

	orbitalPeriodDays: z.number().positive().nullish(),
	semiMajorAxisAu: z.number().min(0).nullish(),
	eccentricity: nullableEccentricitySchema,
	epochPhase: nullableUnitIntervalSchema,

	apparentMagnitude: z.string().nullish(),
	absoluteMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),

	metallicity: z.string().nullish(),
	companion: z.string().nullish(),
	parentStarId: z.number().int().nullish(),
	systemId: z.number().int().nullish(),

	// Display-string overrides for derived fields (persisted into extra).
	density: overrideString,
	surfaceGravity: overrideString,
	escapeVelocity: overrideString,
	luminosity: overrideString,

	extra: z.record(z.string(), z.unknown()).optional(),
	description: z.string().optional(),
})

function starHasOrbitalData(data: Partial<z.infer<typeof starSchema>>) {
	return data.companion != null
		|| data.orbitalPeriodDays != null
		|| data.semiMajorAxisAu != null
		|| data.eccentricity != null
		|| data.epochPhase != null
}

function validateStarCreate(data: Partial<z.infer<typeof starSchema>>, ctx: z.RefinementCtx) {
	if (starHasOrbitalData(data) && data.systemId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systemId'], message: 'Stars with orbital data must belong to a system' })
	}
	if (data.parentStarId != null && data.systemId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systemId'], message: 'Companion stars must belong to a system' })
	}
}

// On a partial update only enforce cross-field rules when the referenced field is
// actually present in the patch — the service re-validates the merged row with the
// create schema, so absent fields are covered there, not here.
function validateStarUpdate(data: Partial<z.infer<typeof starSchema>>, ctx: z.RefinementCtx) {
	const systemPresent = 'systemId' in data
	if (starHasOrbitalData(data) && systemPresent && data.systemId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systemId'], message: 'Stars with orbital data must belong to a system' })
	}
	if (data.parentStarId != null && systemPresent && data.systemId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systemId'], message: 'Companion stars must belong to a system' })
	}
}

export const createStarSchema = starSchema.superRefine(validateStarCreate)
export const updateStarSchema = starSchema.partial().superRefine(validateStarUpdate)

const planetaryBodySchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	bodyType: z.enum(['planet', 'asteroid', 'ring_system']).default('planet'),
	starId: z.number().int().nullish(),
	parentId: z.number().int().nullish(),
	pageSlug: z.string().nullish(),

	massKg: z.number().positive().nullish(),
	radiusM: z.number().positive().nullish(),
	temperature: z.string().nullish(),
	age: z.string().nullish(),

	composition: z.string().nullish(),
	atmosphere: z.string().nullish(),
	surfacePressure: z.string().nullish(),

	orbitalPeriodDays: z.number().positive().nullish(),
	semiMajorAxisAu: z.number().min(0).nullish(),
	eccentricity: nullableEccentricitySchema,
	inclination: z.number().nullish(),
	epochPhase: nullableUnitIntervalSchema,

	rotationPeriodS: z.number().positive().nullish(),
	axialTilt: z.number().nullish(),

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),
	albedo: z.string().nullish(),

	satellites: z.number().int().min(0).nullish(),
	hasRings: z.boolean().optional(),

	// Display-string overrides for derived fields (persisted into extra).
	density: overrideString,
	surfaceGravity: overrideString,
	escapeVelocity: overrideString,

	extra: z.record(z.string(), z.unknown()).optional(),
	description: z.string().optional(),
})

function validatePlanetaryBodyCreate(data: Partial<z.infer<typeof planetaryBodySchema>>, ctx: z.RefinementCtx) {
	if (data.bodyType === 'ring_system' && data.parentId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Ring systems must orbit a parent body' })
	}
	if (data.starId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['starId'], message: 'Celestial bodies must be assigned to a parent star' })
	}
}

// Presence-aware update validation — the service merges with the current row and
// re-validates with the create schema, so only flag fields actually being set.
function validatePlanetaryBodyUpdate(data: Partial<z.infer<typeof planetaryBodySchema>>, ctx: z.RefinementCtx) {
	if (data.bodyType === 'ring_system' && 'parentId' in data && data.parentId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Ring systems must orbit a parent body' })
	}
	if ('starId' in data && data.starId == null) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['starId'], message: 'Celestial bodies must be assigned to a parent star' })
	}
}

export const createPlanetaryBodySchema = planetaryBodySchema.superRefine(validatePlanetaryBodyCreate)
export const updatePlanetaryBodySchema = planetaryBodySchema.partial().superRefine(validatePlanetaryBodyUpdate)
