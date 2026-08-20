import { z } from 'zod'

export const RING_SYSTEM_SCHEMA_VERSION = 1 as const

export const ringBandProvenanceSchema = z.enum([
	'authored',
	'imported',
	'derived',
	'illustrative',
	'unavailable',
])

export const ringSystemOriginSchema = z.enum([
	'captured-debris',
	'impact-ejecta',
	'tidal-disruption',
	'artificial',
	'unknown',
	'illustrative',
])

export const ringBandSchema = z.object({
	name: z.string().trim().min(1).nullish(),
	innerRadiusM: z.number().positive().finite(),
	outerRadiusM: z.number().positive().finite(),
	color: z.string().trim().min(1).nullish(),
	/** Presentation alpha, deliberately distinct from scientific optical depth. */
	opacity: z.number().min(0).max(1).finite().nullish(),
	opticalDepth: z.number().nonnegative().finite().nullish(),
	composition: z.string().trim().min(1).nullish(),
	evidenceReferences: z.array(z.string().trim().min(1)).optional(),
	provenance: ringBandProvenanceSchema,
}).superRefine((band, ctx) => {
	if (band.outerRadiusM <= band.innerRadiusM) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['outerRadiusM'],
			message: 'Outer radius must be greater than inner radius',
		})
	}
})

export const ringSystemSchema = z.object({
	schemaVersion: z.literal(RING_SYSTEM_SCHEMA_VERSION),
	plane: z.literal('parent-equatorial'),
	origin: ringSystemOriginSchema.nullish(),
	bands: z.array(ringBandSchema),
}).superRefine((system, ctx) => {
	for (let index = 1; index < system.bands.length; index++) {
		const previous = system.bands[index - 1]
		const current = system.bands[index]
		if (current.innerRadiusM < previous.outerRadiusM) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['bands', index, 'innerRadiusM'],
				message: 'Bands must be ordered by radius and must not overlap',
			})
		}
	}
})

export type RingBand = z.infer<typeof ringBandSchema>
export type RingSystem = z.infer<typeof ringSystemSchema>
export type RingBandProvenance = z.infer<typeof ringBandProvenanceSchema>
export type RingSystemOrigin = z.infer<typeof ringSystemOriginSchema>

export type RingSystemProjection = {
	id: number
	name: string
	slug: string
	ringSystem: RingSystem
}

export type RingSystemSummary = {
	bandCount: number
	innerRadiusM: number | null
	outerRadiusM: number | null
	widthM: number | null
}

export function emptyRingSystem(): RingSystem {
	return { schemaVersion: RING_SYSTEM_SCHEMA_VERSION, plane: 'parent-equatorial', bands: [] }
}

/** Invalid or future-version facets stay unavailable instead of becoming display facts. */
export function parseRingSystem(value: unknown): RingSystem | null {
	const parsed = ringSystemSchema.safeParse(value)
	return parsed.success ? parsed.data : null
}

export function summarizeRingSystem(system: RingSystem): RingSystemSummary {
	if (system.bands.length === 0) {
		return { bandCount: 0, innerRadiusM: null, outerRadiusM: null, widthM: null }
	}
	const innerRadiusM = system.bands[0].innerRadiusM
	const outerRadiusM = system.bands.at(-1)!.outerRadiusM
	return {
		bandCount: system.bands.length,
		innerRadiusM,
		outerRadiusM,
		widthM: outerRadiusM - innerRadiusM,
	}
}

export function maximumRingRadiusM(systems: readonly RingSystemProjection[] | null | undefined): number | null {
	let maximum: number | null = null
	for (const projection of systems ?? []) {
		for (const band of projection.ringSystem.bands) {
			maximum = Math.max(maximum ?? 0, band.outerRadiusM)
		}
	}
	return maximum
}
