import { z } from 'zod'

const nullableUnitIntervalSchema = z.number().min(0).max(1).nullish()

export const createSystemSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	pageSlug: z.string().nullish(),
	systemType: z.enum(['single', 'binary', 'trinary', 'multiple']).default('single'),
	description: z.string().optional(),
	extra: z.record(z.string(), z.unknown()).optional(),
})

export const updateSystemSchema = createSystemSchema.partial()

export const createStarSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	pageSlug: z.string().nullish(),

	spectralType: z.string().nullish(),
	mass: z.string().nullish(),
	radius: z.string().nullish(),
	luminosity: z.string().nullish(),
	luminosityVisual: z.string().nullish(),
	temperature: z.string().nullish(),
	age: z.string().nullish(),
	color: z.string().nullish(),

	orbitalPeriod: z.string().nullish(),
	semiMajorAxis: z.string().nullish(),
	semiMajorAxisAu: z.number().min(0).nullish(),
	eccentricity: nullableUnitIntervalSchema,
	epochPhase: nullableUnitIntervalSchema,
	periastron: z.string().nullish(),
	apastron: z.string().nullish(),

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),

	companion: z.string().nullish(),
	parentStarId: z.number().int().nullish(),
	systemId: z.number().int().nullish(),

	extra: z.record(z.string(), z.unknown()).optional(),
	description: z.string().optional(),
}).superRefine((data, ctx) => {
	const hasOrbitalData = data.companion != null
		|| data.orbitalPeriod != null
		|| data.semiMajorAxis != null
		|| data.semiMajorAxisAu != null
		|| data.eccentricity != null
		|| data.epochPhase != null
		|| data.periastron != null
		|| data.apastron != null

	if (hasOrbitalData && data.systemId == null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['systemId'],
			message: 'Stars with orbital data must belong to a system',
		})
	}

	if (data.parentStarId != null && data.systemId == null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['systemId'],
			message: 'Companion stars must belong to a system',
		})
	}
})

export const updateStarSchema = createStarSchema.partial().superRefine((data, ctx) => {
	const hasOrbitalData = data.companion != null
		|| data.orbitalPeriod != null
		|| data.semiMajorAxis != null
		|| data.semiMajorAxisAu != null
		|| data.eccentricity != null
		|| data.epochPhase != null
		|| data.periastron != null
		|| data.apastron != null

	if (hasOrbitalData && data.systemId === null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['systemId'],
			message: 'Stars with orbital data must belong to a system',
		})
	}

	if (data.parentStarId != null && data.systemId === null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['systemId'],
			message: 'Companion stars must belong to a system',
		})
	}
})

export const createPlanetaryBodySchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	bodyType: z.enum(['planet', 'moon', 'dwarf_planet', 'asteroid', 'ring_system']).default('planet'),
	starId: z.number().int().nullish(),
	parentId: z.number().int().nullish(),
	pageSlug: z.string().nullish(),

	mass: z.string().nullish(),
	radius: z.string().nullish(),
	density: z.string().nullish(),
	surfaceGravity: z.string().nullish(),
	escapeVelocity: z.string().nullish(),
	temperature: z.string().nullish(),
	age: z.string().nullish(),

	composition: z.string().nullish(),
	atmosphere: z.string().nullish(),
	surfacePressure: z.string().nullish(),

	orbitalPeriod: z.string().nullish(),
	orbitalPeriodDays: z.number().positive().nullish(),
	semiMajorAxis: z.string().nullish(),
	semiMajorAxisAu: z.number().min(0).nullish(),
	eccentricity: nullableUnitIntervalSchema,
	inclination: z.number().nullish(),
	epochPhase: nullableUnitIntervalSchema,

	rotationPeriod: z.string().nullish(),
	rotationPeriodS: z.number().positive().nullish(),
	axialTilt: z.number().nullish(),

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),
	albedo: z.string().nullish(),

	satellites: z.number().int().min(0).nullish(),
	hasRings: z.boolean().optional(),

	extra: z.record(z.string(), z.unknown()).optional(),
	description: z.string().optional(),
}).superRefine((data, ctx) => {
	if ((data.bodyType === 'moon' || data.bodyType === 'ring_system') && data.parentId == null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['parentId'],
			message: `${data.bodyType === 'moon' ? 'Moons' : 'Ring systems'} must orbit a parent body`,
		})
	}

	if (data.starId == null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['starId'],
			message: 'Celestial bodies must be assigned to a parent star',
		})
	}
})

export const updatePlanetaryBodySchema = createPlanetaryBodySchema.partial().superRefine((data, ctx) => {
	if ((data.bodyType === 'moon' || data.bodyType === 'ring_system') && data.parentId === null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['parentId'],
			message: `${data.bodyType === 'moon' ? 'Moons' : 'Ring systems'} must orbit a parent body`,
		})
	}

	if (data.parentId != null && data.starId === null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['starId'],
			message: 'Bodies that orbit another body must still belong to a parent star',
		})
	}
})
