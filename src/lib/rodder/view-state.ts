import { z } from 'zod'
import type { EntityKey } from './root-layout.js'
import type { LabelMode, ScaleMode, TrailMode, ViewMode, VisibilityMode } from './map-settings.js'

export const RODDER_VIEW_QUERY_PARAM = 'view'
export const RODDER_VIEW_SCHEMA_VERSION = 1 as const

const finiteNumber = z.number().finite()
const positiveFiniteNumber = finiteNumber.positive()
const vector3 = z.tuple([finiteNumber, finiteNumber, finiteNumber])
const entityKey = z.custom<EntityKey>(value =>
	typeof value === 'string' && /^(?:star|body):\d+$/.test(value),
)

export type RootCameraState = {
	projection: 'orthographic' | 'perspective'
	target: [number, number, number]
	direction: [number, number, number]
	distance: number
	zoom: number
	fieldOfView: number
}

export type SectorCameraState = {
	position: [number, number, number]
	target: [number, number, number]
	fieldOfView: number
}

export type RootViewState = {
	version: typeof RODDER_VIEW_SCHEMA_VERSION
	renderer: 'root'
	space: { slug: string }
	selected: EntityKey | null
	focus: EntityKey | null
	camera: RootCameraState
	mode: ViewMode
	time: number | null
	labels: LabelMode
	trails: TrailMode
	visibility: VisibilityMode
	exposure: 'auto' | 'fixed'
	scale: ScaleMode
	follow: boolean
}

export type SectorViewState = {
	version: typeof RODDER_VIEW_SCHEMA_VERSION
	renderer: 'sector'
	space: { slug: string }
	selected: string | null
	focus: string | null
	camera: SectorCameraState
}

export type RodderViewState = RootViewState | SectorViewState

const rootCameraSchema = z.object({
	projection: z.enum(['orthographic', 'perspective']),
	target: vector3,
	direction: vector3.refine(
		([x, y, z]) => Math.hypot(x, y, z) > 1e-9,
		'Camera direction must be non-zero',
	),
	distance: positiveFiniteNumber,
	zoom: positiveFiniteNumber,
	fieldOfView: positiveFiniteNumber.max(179),
})

const sectorCameraSchema = z.object({
	position: vector3,
	target: vector3,
	fieldOfView: positiveFiniteNumber.max(179),
}).refine(
	({ position, target }) => Math.hypot(
		position[0] - target[0],
		position[1] - target[1],
		position[2] - target[2],
	) > 1e-9,
	'Camera position and target must differ',
)

const rootViewSchema = z.object({
	version: z.literal(RODDER_VIEW_SCHEMA_VERSION),
	renderer: z.literal('root'),
	space: z.object({ slug: z.string().trim().min(1).max(240) }),
	selected: entityKey.nullable(),
	focus: entityKey.nullable(),
	camera: rootCameraSchema,
	mode: z.enum(['plan', 'orrery']),
	time: finiteNumber.nullable(),
	labels: z.enum(['off', 'hovered', 'major', 'all']),
	trails: z.enum(['off', 'short', 'full']),
	visibility: z.enum(['physical', 'enhanced', 'markers']),
	exposure: z.enum(['auto', 'fixed']),
	scale: z.enum(['log', 'proportional', 'compact', 'inner']),
	follow: z.boolean(),
}).superRefine((state, context) => {
	const expectedProjection = state.mode === 'plan' ? 'orthographic' : 'perspective'
	if (state.camera.projection !== expectedProjection) {
		context.addIssue({ code: 'custom', path: ['camera', 'projection'], message: 'Projection does not match mode' })
	}
	const expectedExposure = state.visibility === 'physical' ? 'fixed' : 'auto'
	if (state.exposure !== expectedExposure) {
		context.addIssue({ code: 'custom', path: ['exposure'], message: 'Exposure does not match visibility policy' })
	}
})

const sectorViewSchema = z.object({
	version: z.literal(RODDER_VIEW_SCHEMA_VERSION),
	renderer: z.literal('sector'),
	space: z.object({ slug: z.string().trim().min(1).max(240) }),
	selected: z.string().trim().min(1).max(240).nullable(),
	focus: z.string().trim().min(1).max(240).nullable(),
	camera: sectorCameraSchema,
})

const rodderViewSchema = z.discriminatedUnion('renderer', [rootViewSchema, sectorViewSchema])

export function encodeRodderViewState(state: RodderViewState): string {
	return JSON.stringify(state)
}

/** Invalid, obsolete, or differently shaped payloads are ignored as one unit. */
export function decodeRodderViewState(raw: string | null | undefined): RodderViewState | null {
	if (!raw || raw.length > 12_000) return null
	try {
		const parsed = rodderViewSchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

export function rootViewStateFor(
	raw: string | null | undefined,
	slug: string,
	entityKeys?: ReadonlySet<EntityKey>,
): RootViewState | null {
	const state = decodeRodderViewState(raw)
	if (!state || state.renderer !== 'root' || state.space.slug !== slug) return null
	if (entityKeys && (
		(state.selected != null && !entityKeys.has(state.selected))
		|| (state.focus != null && !entityKeys.has(state.focus))
	)) return null
	return state
}

export function sectorViewStateFor(
	raw: string | null | undefined,
	slug: string,
	rootSlugs?: ReadonlySet<string>,
): SectorViewState | null {
	const state = decodeRodderViewState(raw)
	if (!state || state.renderer !== 'sector' || state.space.slug !== slug) return null
	if (rootSlugs && (
		(state.selected != null && !rootSlugs.has(state.selected))
		|| (state.focus != null && !rootSlugs.has(state.focus))
	)) return null
	return state
}

export function rodderViewUrl(currentUrl: URL | string, state: RodderViewState): URL {
	const url = new URL(currentUrl)
	url.searchParams.delete('focus')
	url.searchParams.set(RODDER_VIEW_QUERY_PARAM, encodeRodderViewState(state))
	return url
}
