import { z } from 'zod'

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
	semiMajorAxisAu: z.number().positive().nullish(),
	eccentricity: z.number().min(0).max(1).nullish(),
	periastron: z.string().nullish(),
	apastron: z.string().nullish(),

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),

	companion: z.string().nullish(),
	parentStarId: z.number().int().nullish(),

	extra: z.record(z.unknown()).optional(),
	description: z.string().optional(),
})

export const updateStarSchema = createStarSchema.partial()

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
	semiMajorAxisAu: z.number().positive().nullish(),
	eccentricity: z.number().min(0).max(1).nullish(),
	inclination: z.number().nullish(),

	rotationPeriod: z.string().nullish(),
	rotationPeriodS: z.number().positive().nullish(),
	axialTilt: z.number().nullish(),

	apparentMagnitude: z.string().nullish(),
	angularDiameter: z.string().nullish(),
	albedo: z.string().nullish(),

	satellites: z.number().int().min(0).nullish(),
	hasRings: z.boolean().optional(),

	extra: z.record(z.unknown()).optional(),
	description: z.string().optional(),
})

export const updatePlanetaryBodySchema = createPlanetaryBodySchema.partial()
