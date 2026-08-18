import type { TemplateArg } from '$lib/parser/types.js'
import { namedArg, namedArgAny } from '$lib/templates/args.js'
import type { ApparentSkyResult, RootSelectionKey } from './apparent-sky.js'
import {
	DISPLAY_INTERACTION_PRESETS,
	displayInteractionPresetSchema,
	type DisplayInteractionPolicy,
} from './consumer-contract.js'
import { DEFAULT_MAP_SETTINGS, type LabelMode, type ScaleMode, type TrailMode, type ViewMode, type VisibilityMode } from './map-settings.js'
import { keyForBody, type EntityKey, type MapBody } from './root-layout.js'
import {
	rootViewStateFor,
	sectorViewStateFor,
	type RootCameraState,
	type SectorCameraState,
} from './view-state.js'

export type EmbedConfigurationError = { argument: string, message: string }

export type RootMapEmbedConfiguration = {
	aspectRatio: number
	interaction: DisplayInteractionPolicy
	mode: ViewMode
	labels: LabelMode
	skyLabels: LabelMode
	trails: TrailMode
	visibility: VisibilityMode
	scale: ScaleMode
	day: number | null
	follow: boolean
	selected: RootSelectionKey | null
	focus: EntityKey | null
	camera: RootCameraState | null
	errors: EmbedConfigurationError[]
}

export type SectorMapEmbedConfiguration = {
	aspectRatio: number
	interaction: DisplayInteractionPolicy
	selected: string | null
	focus: string | null
	camera: SectorCameraState | null
	errors: EmbedConfigurationError[]
}

function valueMap(args: TemplateArg[]): Map<string, string> {
	return new Map(args.filter(arg => arg.name).map(arg => [arg.name!.trim().toLowerCase(), arg.value.trim()]))
}

function enumOverride<T extends string>(
	values: Map<string, string>,
	key: string,
	allowed: readonly T[],
	current: T,
	errors: EmbedConfigurationError[],
): T {
	const raw = values.get(key)
	if (raw == null) return current
	if ((allowed as readonly string[]).includes(raw.toLowerCase())) return raw.toLowerCase() as T
	errors.push({ argument: key, message: `Expected one of: ${allowed.join(', ')}.` })
	return current
}

function booleanOverride(
	values: Map<string, string>,
	key: string,
	current: boolean,
	errors: EmbedConfigurationError[],
): boolean {
	const raw = values.get(key)?.toLowerCase()
	if (raw == null) return current
	if (['on', 'true', 'yes', 'show', 'enabled'].includes(raw)) return true
	if (['off', 'false', 'no', 'hide', 'disabled'].includes(raw)) return false
	errors.push({ argument: key, message: 'Expected on or off.' })
	return current
}

function interactionFor(args: TemplateArg[], errors: EmbedConfigurationError[]): DisplayInteractionPolicy {
	const values = valueMap(args)
	const rawPreset = values.get('interaction')?.toLowerCase() ?? 'locked'
	const parsedPreset = displayInteractionPresetSchema.safeParse(rawPreset)
	if (!parsedPreset.success) errors.push({ argument: 'interaction', message: 'Expected locked, inspect, or explore.' })
	const policy = { ...DISPLAY_INTERACTION_PRESETS[parsedPreset.success ? parsedPreset.data : 'locked'] }
	policy.cameraMovement = booleanOverride(values, 'camera', policy.cameraMovement, errors)
	policy.timeMovement = booleanOverride(values, 'time', policy.timeMovement, errors)
	policy.displayChanges = booleanOverride(values, 'display', policy.displayChanges, errors)
	policy.hoverInspection = booleanOverride(values, 'hover', policy.hoverInspection, errors)
	policy.selectionInspection = booleanOverride(values, 'selection', policy.selectionInspection, errors)
	policy.objectNavigation = booleanOverride(values, 'links', policy.objectNavigation, errors)
	policy.controlsVisible = booleanOverride(values, 'controls', policy.controlsVisible, errors)
	return policy
}

function aspectFor(args: TemplateArg[], errors: EmbedConfigurationError[]): number {
	const raw = namedArg(args, 'aspect')?.trim()
	if (!raw) return 16 / 9
	const parts = raw.split(/[/:]/).map(Number)
	const value = parts.length === 2 ? parts[0] / parts[1] : Number(raw)
	if (Number.isFinite(value) && value >= 0.5 && value <= 3) return value
	errors.push({ argument: 'aspect', message: 'Expected a ratio between 1:2 and 3:1.' })
	return 16 / 9
}

function decodedView(raw: string | undefined): string | null {
	if (!raw?.trim()) return null
	const trimmed = raw.trim()
	try {
		return decodeURIComponent(trimmed)
	} catch {
		return trimmed
	}
}

export function resolveRootMapEmbedConfiguration(
	args: TemplateArg[],
	slug: string,
	stars: MapBody[],
	bodies: MapBody[],
	apparentSky: ApparentSkyResult,
): RootMapEmbedConfiguration {
	const errors: EmbedConfigurationError[] = []
	const localBySlug = new Map<string, EntityKey>([
		...stars.map(star => [star.slug.toLowerCase(), keyForBody(star, true)] as const),
		...bodies.map(body => [body.slug.toLowerCase(), keyForBody(body, false)] as const),
	])
	const skyBySlug = new Map(apparentSky.sources.map(source => [source.rootSlug.toLowerCase(), source.key]))
	const focusKeys = new Set(localBySlug.values())
	const selectedKeys = new Set<RootSelectionKey>([...focusKeys, ...skyBySlug.values()])
	const rawView = decodedView(namedArg(args, 'view'))
	const seeded = rawView ? rootViewStateFor(rawView, slug, { focus: focusKeys, selected: selectedKeys }) : null
	if (rawView && !seeded) errors.push({ argument: 'view', message: 'The copied view is invalid or belongs to another root.' })
	const values = valueMap(args)

	let mode = seeded?.mode ?? DEFAULT_MAP_SETTINGS.view
	mode = enumOverride(values, 'mode', ['plan', 'orrery'], mode, errors)
	const labels = enumOverride(values, 'labels', ['off', 'hovered', 'major', 'all'], seeded?.labels ?? DEFAULT_MAP_SETTINGS.labels, errors)
	const skyLabels = enumOverride(values, 'sky_labels', ['off', 'hovered', 'major', 'all'], seeded?.skyLabels ?? DEFAULT_MAP_SETTINGS.skyLabels, errors)
	const trails = enumOverride(values, 'trails', ['off', 'short', 'full'], seeded?.trails ?? DEFAULT_MAP_SETTINGS.trails, errors)
	const visibility = enumOverride(values, 'visibility', ['physical', 'enhanced', 'markers'], seeded?.visibility ?? DEFAULT_MAP_SETTINGS.visibility, errors)
	const scale = enumOverride(values, 'scale', ['log', 'proportional', 'compact', 'inner'], seeded?.scale ?? DEFAULT_MAP_SETTINGS.scale, errors)

	let day = seeded?.time ?? null
	const rawDate = values.get('date')
	if (rawDate != null) {
		const parsed = Number(rawDate)
		if (Number.isFinite(parsed)) day = parsed
		else errors.push({ argument: 'date', message: 'Expected a finite absolute day.' })
	}

	let focus = seeded?.focus ?? null
	const rawFocus = values.get('focus')
	if (rawFocus != null) {
		const resolved = localBySlug.get(rawFocus.toLowerCase())
		if (resolved) focus = resolved
		else errors.push({ argument: 'focus', message: 'The focus slug is not a local root member.' })
	}

	let selected = seeded?.selected ?? null
	const rawSelected = values.get('selected')
	if (rawSelected != null) {
		const skySlug = rawSelected.toLowerCase().startsWith('sky:') ? rawSelected.slice(4).toLowerCase() : null
		const resolved = skySlug ? skyBySlug.get(skySlug) : localBySlug.get(rawSelected.toLowerCase())
		if (resolved) selected = resolved
		else errors.push({ argument: 'selected', message: 'The selected slug is not available in this display.' })
	}

	const expectedProjection = mode === 'plan' ? 'orthographic' : 'perspective'
	const camera = seeded?.camera.projection === expectedProjection ? seeded.camera : null
	if (seeded && !camera) errors.push({ argument: 'mode', message: 'The mode override requires automatic camera framing.' })

	return {
		aspectRatio: aspectFor(args, errors),
		interaction: interactionFor(args, errors),
		mode,
		labels,
		skyLabels,
		trails,
		visibility,
		scale,
		day,
		follow: Boolean(seeded?.follow && selected && !selected.startsWith('sky-root:')),
		selected,
		focus,
		camera,
		errors,
	}
}

export function resolveSectorMapEmbedConfiguration(
	args: TemplateArg[],
	slug: string,
	rootSlugs: readonly string[],
): SectorMapEmbedConfiguration {
	const errors: EmbedConfigurationError[] = []
	const known = new Set(rootSlugs)
	const byLower = new Map(rootSlugs.map(rootSlug => [rootSlug.toLowerCase(), rootSlug]))
	const rawView = decodedView(namedArg(args, 'view'))
	const seeded = rawView ? sectorViewStateFor(rawView, slug, known) : null
	if (rawView && !seeded) errors.push({ argument: 'view', message: 'The copied view is invalid or belongs to another sector.' })

	function resolveSlug(argument: 'focus' | 'selected', current: string | null): string | null {
		const raw = namedArgAny(args, argument)?.trim()
		if (raw == null) return current
		const resolved = byLower.get(raw.toLowerCase())
		if (resolved) return resolved
		errors.push({ argument, message: 'The root slug is not present in this sector.' })
		return current
	}

	return {
		aspectRatio: aspectFor(args, errors),
		interaction: interactionFor(args, errors),
		selected: resolveSlug('selected', seeded?.selected ?? null),
		focus: resolveSlug('focus', seeded?.focus ?? null),
		camera: seeded?.camera ?? null,
		errors,
	}
}
