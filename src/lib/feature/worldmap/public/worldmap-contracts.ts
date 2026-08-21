import { z } from 'zod'

const hexColor = z.string().regex(/^#[\dA-Fa-f]{6}$/, 'Color must be a 6-digit hex code like #A1B2C3')

export const createCountrySchema = z.object({
	name: z.string().min(1).max(120),
	slug: z.string().min(1).max(120),
	pageSlug: z.string().min(1).max(200),
	capital: z.string().max(120).nullable().optional(),
	governance: z.string().max(120).nullable().optional(),
	color: hexColor.nullable().optional(),
	extra: z.record(z.string(), z.unknown()).default({}),
})

export const updateCountrySchema = createCountrySchema.partial().refine(
	value => Object.keys(value).length > 0,
	'Provide at least one field to update',
)

export const createWorldMapSchema = z.object({
	name: z.string().min(1).max(120),
	slug: z.string().min(1).max(120),
	imageFilename: z.string().max(255).optional(),
	imageWidth: z.number().int().positive().nullable().optional(),
	imageHeight: z.number().int().positive().nullable().optional(),
	waterHex: hexColor.default('#000000'),
	timePeriod: z.string().max(120).nullable().optional(),
	event: z.string().max(200).nullable().optional(),
	linkedPageSlug: z.string().max(200).nullable().optional(),
	description: z.string().max(2000).optional(),
})

export const updateWorldMapSchema = createWorldMapSchema.partial().refine(
	value => Object.keys(value).length > 0,
	'Provide at least one field to update',
)
