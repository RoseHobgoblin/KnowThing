import { z } from 'zod'

export const SECTOR_UNITS = ['ly', 'pc'] as const
export const SECTOR_SHAPES = ['sphere', 'cuboid'] as const
export const SECTOR_ORIGIN_KINDS = ['frame-centred', 'object-centred', 'imported'] as const
export const SECTOR_HANDEDNESS = ['right-handed', 'left-handed'] as const
export const SECTOR_PROVENANCE = ['authored', 'imported', 'transformed', 'approximate', 'legacy'] as const

const nullablePositive = z.number().positive().finite().nullable().default(null)
const nullableText = z.string().trim().nullable().default(null)

const sectorFields = z.object({
	name: z.string().trim().min(1, 'Name is required').max(160),
	slug: z.string().trim().min(1, 'Slug is required').max(160)
		.regex(/^[\da-z]+(?:-[\da-z]+)*$/, 'Use lowercase letters, numbers, and single hyphens'),
	description: z.string().trim().default(''),
	units: z.enum(SECTOR_UNITS).default('ly'),
	shape: z.enum(SECTOR_SHAPES).nullable().default(null),
	radius: nullablePositive,
	extentX: nullablePositive,
	extentY: nullablePositive,
	extentZ: nullablePositive,
	originKind: z.enum(SECTOR_ORIGIN_KINDS).default('frame-centred'),
	originBodyId: z.number().int().positive().nullable().default(null),
	axesNote: nullableText,
	handedness: z.enum(SECTOR_HANDEDNESS).default('right-handed'),
	referenceEpoch: nullableText,
	provenance: z.enum(SECTOR_PROVENANCE).default('authored'),
})

function validateFrame(data: z.infer<typeof sectorFields>, ctx: z.RefinementCtx) {
	if (data.shape === 'sphere' && data.radius == null) {
		ctx.addIssue({ code: 'custom', path: ['radius'], message: 'A spherical sector requires a radius' })
	}
	if (data.shape === 'cuboid') {
		for (const key of ['extentX', 'extentY', 'extentZ'] as const) {
			if (data[key] == null) ctx.addIssue({ code: 'custom', path: [key], message: 'A cuboid sector requires all three extents' })
		}
	}
	if (data.originKind === 'object-centred' && data.originBodyId == null) {
		ctx.addIssue({ code: 'custom', path: ['originBodyId'], message: 'An object-centred frame requires an origin system' })
	}
}

export const createSectorSchema = sectorFields.superRefine(validateFrame)
export const updateSectorSchema = sectorFields.partial()

export type CreateSectorInput = z.infer<typeof createSectorSchema>
