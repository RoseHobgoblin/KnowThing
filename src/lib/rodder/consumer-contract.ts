import { z } from 'zod'

const finiteNumber = z.number().finite()
const nullableFiniteNumber = finiteNumber.nullable()

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null(),
	z.array(jsonValueSchema),
	z.record(z.string(), jsonValueSchema),
]))

export const rodderKindSchema = z.enum(['system', 'star', 'body'])

export const rodderResourceReferenceSchema = z.object({
	id: z.number().int().positive(),
	kind: rodderKindSchema,
	name: z.string(),
	slug: z.string(),
	href: z.string(),
})

/** @deprecated Use the unabbreviated schema name. */
// eslint-disable-next-line unicorn/prevent-abbreviations -- Retained as an exported compatibility alias.
export const rodderResourceRefSchema = rodderResourceReferenceSchema

export const rodderDiagnosticSchema = z.object({
	code: z.string(),
	severity: z.enum(['info', 'warning', 'error']),
	message: z.string(),
	path: z.string().nullable(),
})

export const resolvedValueSchema = z.object({
	value: jsonValueSchema,
	status: z.enum(['authored', 'derived', 'illustrative', 'unavailable']),
	source: z.string().nullable(),
})

const surfaceProjectionSchema = jsonValueSchema.nullable()

export const rootMapMemberSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	slug: z.string(),
	bodyType: z.string(),
	isStar: z.boolean().optional(),
	isRoot: z.boolean().optional(),
	massKg: nullableFiniteNumber.optional(),
	radiusM: nullableFiniteNumber.optional(),
	semiMajorAxisAu: nullableFiniteNumber.optional(),
	eccentricity: nullableFiniteNumber.optional(),
	inclination: nullableFiniteNumber.optional(),
	longitudeAscendingNode: nullableFiniteNumber.optional(),
	argumentOfPeriapsis: nullableFiniteNumber.optional(),
	color: z.string().nullable().optional(),
	moonCount: z.number().int().optional(),
	parentStarId: z.number().int().nullable().optional(),
	parentSystemId: z.number().int().nullable().optional(),
	spectralType: z.string().nullable().optional(),
	starId: z.number().int().nullable().optional(),
	parentId: z.number().int().nullable().optional(),
	orbitalPeriodDays: nullableFiniteNumber.optional(),
	epochPhase: nullableFiniteNumber.optional(),
	rotationPeriodS: nullableFiniteNumber.optional(),
	axialTilt: nullableFiniteNumber.optional(),
	temperatureK: nullableFiniteNumber.optional(),
	luminosityW: nullableFiniteNumber.optional(),
	composition: z.string().nullable().optional(),
	atmosphere: z.string().nullable().optional(),
	hasRings: z.boolean().nullable().optional(),
	hostStarTemperatureK: nullableFiniteNumber.optional(),
	surface: surfaceProjectionSchema.optional(),
	weather: surfaceProjectionSchema.optional(),
	stellarSurface: surfaceProjectionSchema.optional(),
	relativeSemiMajorAxisAu: nullableFiniteNumber.optional(),
	effectivePeriodSource: z.enum(['stored', 'derived', 'unavailable']).optional(),
	placementProvenance: z.enum(['physical', 'schematic']).optional(),
	placementNote: z.string().nullable().optional(),
})

const apparentSkyMemberSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	slug: z.string(),
	spectralType: z.string().nullable(),
	temperatureK: nullableFiniteNumber,
	luminosityW: nullableFiniteNumber,
	radiusM: nullableFiniteNumber,
	absoluteMagnitude: z.string().nullable(),
	apparentMagnitude: nullableFiniteNumber,
	brightnessSource: z.enum(['absolute-magnitude', 'stored-luminosity', 'derived-luminosity', 'unavailable']),
})

const apparentSkySchema = z.object({
	status: z.enum(['available', 'unavailable']),
	reason: z.string().nullable(),
	sector: z.object({
		id: z.number().int().positive(),
		name: z.string(),
		slug: z.string(),
		units: z.enum(['ly', 'pc']),
		handedness: z.enum(['right-handed', 'left-handed']),
		referenceEpoch: z.string().nullable(),
	}).nullable(),
	sources: z.array(z.object({
		key: z.custom<`sky-root:${number}`>(value => typeof value === 'string' && /^sky-root:\d+$/.test(value)),
		rootId: z.number().int().positive(),
		rootName: z.string(),
		rootSlug: z.string(),
		rootKind: z.string(),
		direction: z.tuple([finiteNumber, finiteNumber, finiteNumber]),
		distance: finiteNumber.nonnegative(),
		distancePc: finiteNumber.nonnegative(),
		units: z.enum(['ly', 'pc']),
		apparentMagnitude: nullableFiniteNumber,
		brightnessStatus: z.enum(['complete', 'incomplete', 'unavailable']),
		displayColor: z.string(),
		positionProvenance: z.string(),
		positionUncertainty: nullableFiniteNumber,
		stars: z.array(apparentSkyMemberSchema),
	})),
	diagnostics: z.object({
		observerRoot: z.number().int().nonnegative(),
		incompatibleSectorRoots: z.number().int().nonnegative(),
		unpositionedRoots: z.number().int().nonnegative(),
		starlessRoots: z.number().int().nonnegative(),
		coincidentRoots: z.number().int().nonnegative(),
		incompleteBrightnessSources: z.number().int().nonnegative(),
	}),
})

const calendarProjectionSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	staticData: jsonValueSchema.nullable(),
	planetId: z.number().int().positive().nullable(),
})

export const sectorRootProjectionSchema = z.object({
	rootId: z.number().int().positive(),
	bodyId: z.number().int().positive(),
	name: z.string(),
	slug: z.string(),
	kind: rodderKindSchema,
	x: nullableFiniteNumber,
	y: nullableFiniteNumber,
	z: nullableFiniteNumber,
	positionProvenance: z.string(),
	positionUncertainty: nullableFiniteNumber,
	distanceLy: nullableFiniteNumber,
	starCount: z.number().int().nonnegative(),
	planetCount: z.number().int().nonnegative(),
	href: z.string(),
})

const rootMapDisplaySchema = z.object({
	rootName: z.string(),
	stars: z.array(rootMapMemberSchema),
	bodies: z.array(rootMapMemberSchema),
	apparentSky: apparentSkySchema,
	calendars: z.array(calendarProjectionSchema),
})

const articleSchema = z.object({
	wikitext: z.string(),
	plainText: z.string(),
	updatedAt: z.string().datetime().nullable(),
})

const authoredEntitySchema = z.object({
	description: z.string(),
	article: articleSchema,
	physical: z.object({
		massKg: nullableFiniteNumber,
		radiusM: nullableFiniteNumber,
		age: z.string().nullable(),
		temperatureK: nullableFiniteNumber,
	}),
	observation: z.object({
		apparentMagnitude: z.string().nullable(),
		absoluteMagnitude: z.string().nullable(),
		angularDiameter: z.string().nullable(),
	}),
	orbit: z.object({
		orbitalPeriodDays: nullableFiniteNumber,
		semiMajorAxisAu: nullableFiniteNumber,
		eccentricity: nullableFiniteNumber,
		epochPhase: nullableFiniteNumber,
		inclination: nullableFiniteNumber,
		longitudeAscendingNode: nullableFiniteNumber,
		argumentOfPeriapsis: nullableFiniteNumber,
	}),
	rotation: z.object({
		periodS: nullableFiniteNumber,
		axialTilt: nullableFiniteNumber,
	}),
	stellar: z.object({
		spectralType: z.string().nullable(),
		luminosityW: nullableFiniteNumber,
		luminosityVisual: z.string().nullable(),
		color: z.string().nullable(),
		metallicity: z.string().nullable(),
	}).nullable(),
	planetary: z.object({
		bodyType: z.string(),
		composition: z.string().nullable(),
		atmosphere: z.string().nullable(),
		surfacePressure: z.string().nullable(),
		satellites: z.number().int().nullable(),
		hasRings: z.boolean(),
	}).nullable(),
	system: z.object({
		distanceLy: nullableFiniteNumber,
		formationAge: z.string().nullable(),
		designations: z.string().nullable(),
	}).nullable(),
	extensions: z.record(z.string(), jsonValueSchema),
})

const placementSchema = z.object({
	sector: z.object({
		id: z.number().int().positive(),
		name: z.string(),
		slug: z.string(),
		units: z.enum(['ly', 'pc']),
		handedness: z.enum(['right-handed', 'left-handed']),
		originKind: z.string(),
		provenance: z.string(),
		href: z.string(),
	}),
	position: z.object({
		x: nullableFiniteNumber,
		y: nullableFiniteNumber,
		z: nullableFiniteNumber,
		provenance: z.string(),
		uncertainty: nullableFiniteNumber,
		notes: z.string().nullable(),
	}),
})

export const rodderEntityDocumentSchema = z.object({
	resource: z.literal('rodder-entity'),
	identity: rodderResourceReferenceSchema,
	authored: authoredEntitySchema,
	relationships: z.object({
		parent: rodderResourceReferenceSchema.nullable(),
		root: rodderResourceReferenceSchema,
		ancestors: z.array(rodderResourceReferenceSchema),
		children: z.array(rodderResourceReferenceSchema),
	}),
	placement: placementSchema.nullable(),
	resolved: z.object({
		facts: z.record(z.string(), resolvedValueSchema),
	}),
	displays: z.object({
		rootMap: rootMapDisplaySchema.nullable(),
	}),
	capabilities: z.object({
		article: z.boolean(),
		rootMap: z.boolean(),
		sectorPlacement: z.boolean(),
		surface: z.boolean(),
		weather: z.boolean(),
		calendar: z.boolean(),
	}),
	links: z.object({
		self: z.string(),
		page: z.string(),
		root: z.string(),
		parent: z.string().nullable(),
		sector: z.string().nullable(),
	}),
	diagnostics: z.array(rodderDiagnosticSchema),
	updatedAt: z.string().datetime(),
})

const sectorFrameSchema = z.object({
	units: z.enum(['ly', 'pc']),
	shape: z.enum(['sphere', 'cuboid']).nullable(),
	radius: nullableFiniteNumber,
	extentX: nullableFiniteNumber,
	extentY: nullableFiniteNumber,
	extentZ: nullableFiniteNumber,
	originKind: z.string(),
	origin: rodderResourceReferenceSchema.nullable(),
	axesNote: z.string().nullable(),
	handedness: z.enum(['right-handed', 'left-handed']),
	referenceEpoch: z.string().nullable(),
	provenance: z.string(),
})

export const rodderSectorDocumentSchema = z.object({
	resource: z.literal('rodder-sector'),
	identity: z.object({
		id: z.number().int().positive(),
		name: z.string(),
		slug: z.string(),
		description: z.string(),
		href: z.string(),
	}),
	frame: sectorFrameSchema,
	roots: z.array(sectorRootProjectionSchema),
	resolved: z.object({
		rootCount: z.number().int().nonnegative(),
		positionedRootCount: z.number().int().nonnegative(),
		unpositionedRootCount: z.number().int().nonnegative(),
		boundsRadius: finiteNumber.nonnegative(),
	}),
	displays: z.object({
		sectorMap: z.object({
			units: z.enum(['ly', 'pc']),
			roots: z.array(sectorRootProjectionSchema),
		}),
	}),
	capabilities: z.object({ sectorMap: z.literal(true), rootNavigation: z.boolean() }),
	links: z.object({ self: z.string(), page: z.string() }),
	diagnostics: z.array(rodderDiagnosticSchema),
	updatedAt: z.string().datetime(),
})

export const displayInteractionPolicySchema = z.object({
	cameraMovement: z.boolean(),
	timeMovement: z.boolean(),
	displayChanges: z.boolean(),
	hoverInspection: z.boolean(),
	selectionInspection: z.boolean(),
	objectNavigation: z.boolean(),
	controlsVisible: z.boolean(),
})

export const displayInteractionPresetSchema = z.enum(['locked', 'inspect', 'explore'])

export const rodderDisplayConfigSchema = z.object({
	aspectRatio: finiteNumber.min(0.5).max(3),
	interaction: displayInteractionPolicySchema,
	playback: z.object({
		daysPerSecond: finiteNumber.min(0.01).max(10_000),
	}).optional(),
})

export type RodderKind = z.infer<typeof rodderKindSchema>
export type RodderResourceRef = z.infer<typeof rodderResourceReferenceSchema>
export type RodderDiagnostic = z.infer<typeof rodderDiagnosticSchema>
export type RodderEntityDocument = z.infer<typeof rodderEntityDocumentSchema>
export type RodderSectorDocument = z.infer<typeof rodderSectorDocumentSchema>
export type DisplayInteractionPolicy = z.infer<typeof displayInteractionPolicySchema>
export type DisplayInteractionPreset = z.infer<typeof displayInteractionPresetSchema>
export type RodderDisplayConfig = z.infer<typeof rodderDisplayConfigSchema>

export const DISPLAY_INTERACTION_PRESETS: Record<DisplayInteractionPreset, DisplayInteractionPolicy> = {
	locked: {
		cameraMovement: false,
		timeMovement: false,
		displayChanges: false,
		hoverInspection: true,
		selectionInspection: false,
		objectNavigation: true,
		controlsVisible: false,
	},
	inspect: {
		cameraMovement: false,
		timeMovement: false,
		displayChanges: false,
		hoverInspection: true,
		selectionInspection: true,
		objectNavigation: true,
		controlsVisible: false,
	},
	explore: {
		cameraMovement: true,
		timeMovement: true,
		displayChanges: true,
		hoverInspection: true,
		selectionInspection: true,
		objectNavigation: true,
		controlsVisible: true,
	},
}

export const DEFAULT_EMBED_INTERACTION: DisplayInteractionPolicy = DISPLAY_INTERACTION_PRESETS.locked
export const FULL_VIEW_INTERACTION: DisplayInteractionPolicy = DISPLAY_INTERACTION_PRESETS.explore
