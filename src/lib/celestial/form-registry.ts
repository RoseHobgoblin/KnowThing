import type { ZodType } from 'zod'
import { UPDATE_SCHEMAS } from './schema.js'
import { getStarPresets, getBodyPresets } from './presets.js'
import {
	computeHabitableZoneAu,
	computeHillSphereAu,
	computeLuminosity,
	computeOrbitalPeriodDays,
	deriveBodyFields,
	deriveBodyOrbitalFields,
	deriveDisplayStrings,
	deriveStarOrbitalFields,
	formatLuminosity,
	formatMass,
	formatRadius,
	formatTemperatureK,
} from './compute.js'
import { validateBodyPhysics, validateStarPhysics, type PhysicsWarning } from './validate-physics.js'

/**
 * Declarative field registry for the celestial configure forms.
 *
 * Each kind (system / star / body) is described once as data: sections of
 * field specs plus a handful of kind-specific hooks (payload merging, physics
 * warnings, presets). CelestialConfigureForm.svelte renders any config, and
 * the draft/payload builders below replace the per-form snapshot, reset and
 * save plumbing that used to be maintained three times over.
 */

export type CelestialFormKind = 'system' | 'star' | 'body'

/** Flat working copy of the record being edited, keyed by field spec key. */
export type CelestialDraft = Record<string, any>

export interface SelectOption { value: string, label: string }

export interface SystemReferenceOption { id: number, name: string }
export interface StarReferenceOption { id: number, name: string, massKg?: number | null, systemId?: number | null, parentStarId?: number | null }
export interface BodyReferenceOption { id: number, name: string, massKg?: number | null, starId?: number | null, parentId?: number | null, parentSystemId?: number | null, rootSystemId?: number | null, semiMajorAxisAu?: number | null, eccentricity?: number | null }

/** Everything a field's dynamic parts (options, derivations, labels) can see. */
export interface FieldContext {
	draft: CelestialDraft
	/** id of the entity being edited — excluded from its own parent candidates. */
	selfId: number | null
	systems: SystemReferenceOption[]
	stars: StarReferenceOption[]
	siblings: BodyReferenceOption[]
}

interface FieldBase {
	label: string | ((ctx: FieldContext) => string)
	hint?: string
}

export interface NameFieldSpec extends FieldBase { control: 'name', key: 'name', placeholder: string }
export interface SlugFieldSpec extends FieldBase { control: 'slug', key: 'slug', placeholder: string }
export interface TextFieldSpec extends FieldBase {
	control: 'text'
	key: string
	placeholder?: string
	/** Send '' as null in the payload. Defaults to true; description must stay a string. */
	emptyAsNull?: boolean
}
export interface NumberFieldSpec extends FieldBase {
	control: 'number'
	key: string
	placeholder?: string
	min?: number
	max?: number
	rangeError?: string
}
export interface SelectFieldSpec extends FieldBase {
	control: 'select'
	key: string
	options: (ctx: FieldContext) => SelectOption[]
	/** Reset to '' when the current value drops out of the option list. */
	clearIfInvalid?: boolean
	/** Selects that only feed extraPayload (the parent-edge pickers) set this. */
	omitFromPayload?: boolean
	initial?: (record: Record<string, any>) => string
}
export interface CheckboxFieldSpec extends FieldBase { control: 'checkbox', key: string }
export interface DerivedFieldSpec extends FieldBase {
	control: 'derived'
	compute: (ctx: FieldContext) => string | null
	visible?: (ctx: FieldContext) => boolean
}
export interface LockableFieldSpec extends FieldBase {
	control: 'lockable'
	key: string
	derive: (ctx: FieldContext) => string | null
	valueType?: 'text' | 'number'
	placeholder?: string
	/** Where the override hydrates from: an `extra` JSONB key or a record column. */
	source: { extra: string } | { record: string }
}

export type FieldSpec =
	| NameFieldSpec
	| SlugFieldSpec
	| TextFieldSpec
	| NumberFieldSpec
	| SelectFieldSpec
	| CheckboxFieldSpec
	| DerivedFieldSpec
	| LockableFieldSpec

export interface FieldGroup { cols: 1 | 2 | 3, fields: FieldSpec[] }
export interface FormSection { id: string, label: string, intro?: string, groups: FieldGroup[] }

export interface PresetsConfig {
	placeholder: string
	names: string[]
	/** Draft patch for the named preset, or null when unknown. */
	patch: (name: string) => Partial<CelestialDraft> | null
}

export interface CelestialFormConfig {
	kind: CelestialFormKind
	noun: string
	headerNote: string
	updateSchema: ZodType
	useTabs: boolean
	sections: FormSection[]
	/** Draft keys hydrated from the record and passed through the payload without a control (e.g. luminosityW). */
	passthroughKeys?: string[]
	/** Payload entries derived from the whole draft — the parent-edge coalescing lives here. */
	extraPayload?: (ctx: FieldContext) => Record<string, any>
	physicsWarnings?: (ctx: FieldContext) => PhysicsWarning[]
	presets?: PresetsConfig
	deleteConfirm: { title: string, message: (name: string) => string, action: string }
	deleteNote: string
}

export function lockFlagKey(key: string): string {
	return `${key}Unlocked`
}

export function labelOf(spec: FieldSpec, ctx: FieldContext): string {
	return typeof spec.label === 'function' ? spec.label(ctx) : spec.label
}

export function allFieldSpecs(config: CelestialFormConfig): FieldSpec[] {
	return config.sections.flatMap(section => section.groups.flatMap(group => group.fields))
}

/** Read a draft value as a finite number, tolerating '' / strings from inputs. */
function num(ctx: FieldContext, key: string): number | null {
	const value = ctx.draft[key]
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Format a positive numeric draft value for display, or null when unset. */
function formatFromDraft(ctx: FieldContext, key: string, format: (value: number) => string): string | null {
	const value = num(ctx, key)
	return value ? format(value) : null
}

function text(ctx: FieldContext, key: string): string {
	const value = ctx.draft[key]
	return typeof value === 'string' ? value : ''
}

export function buildDraft(config: CelestialFormConfig, record: Record<string, any>): CelestialDraft {
	const extra = (record.extra ?? {}) as Record<string, unknown>
	const extraString = (key: string) => (typeof extra[key] === 'string' ? (extra[key] as string) : null)
	const draft: CelestialDraft = {}
	for (const spec of allFieldSpecs(config)) {
		if (spec.control === 'derived') continue
		if (spec.key in draft) continue // a field may render in two sections (star color)
		switch (spec.control) {
			case 'name':
			case 'slug':
			case 'text':
				draft[spec.key] = record[spec.key] ?? ''
				break
			case 'number':
				draft[spec.key] = typeof record[spec.key] === 'number' ? record[spec.key] : null
				break
			case 'select':
				draft[spec.key] = spec.initial
					? spec.initial(record)
					: (record[spec.key] == null ? '' : String(record[spec.key]))
				break
			case 'checkbox':
				draft[spec.key] = record[spec.key] ?? false
				break
			case 'lockable': {
				const value = 'extra' in spec.source
					? extraString(spec.source.extra)
					: (record[spec.source.record] ?? null)
				draft[spec.key] = value
				draft[lockFlagKey(spec.key)] = value != null
				break
			}
		}
	}
	for (const key of config.passthroughKeys ?? []) {
		draft[key] = record[key] ?? null
	}
	return draft
}

export function buildPayload(config: CelestialFormConfig, ctx: FieldContext): Record<string, any> {
	const draft = ctx.draft
	const payload: Record<string, any> = {}
	for (const spec of allFieldSpecs(config)) {
		if (spec.control === 'derived') continue
		if (spec.control === 'select' && spec.omitFromPayload) continue
		switch (spec.control) {
			case 'text':
				payload[spec.key] = (spec.emptyAsNull ?? true) ? (draft[spec.key] || null) : draft[spec.key]
				break
			case 'lockable':
				payload[spec.key] = draft[lockFlagKey(spec.key)] ? draft[spec.key] : null
				break
			default:
				payload[spec.key] = draft[spec.key]
		}
	}
	for (const key of config.passthroughKeys ?? []) {
		payload[key] = draft[key]
	}
	if (config.extraPayload) Object.assign(payload, config.extraPayload(ctx))
	return payload
}

/** ids of this body and everything orbiting under it — invalid parent choices. */
export function descendantIds(siblings: BodyReferenceOption[], selfId: number | null): Set<number> {
	if (selfId == null) return new Set()
	const childrenByParent = new Map<number, number[]>()
	for (const sibling of siblings) {
		if (sibling.parentId == null) continue
		const list = childrenByParent.get(sibling.parentId) ?? []
		list.push(sibling.id)
		childrenByParent.set(sibling.parentId, list)
	}
	const result = new Set<number>([selfId])
	const stack = [selfId]
	while (stack.length > 0) {
		const next = stack.pop()!
		for (const childId of childrenByParent.get(next) ?? []) {
			if (!result.has(childId)) {
				result.add(childId)
				stack.push(childId)
			}
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// Shared field fragments
// ---------------------------------------------------------------------------

const SLUG_HINT = 'URL identifier (/Celestial:slug). Follows the name until edited by hand. Existing [[links]] to the old slug are not redirected.'

function nameField(placeholder: string): NameFieldSpec {
	return { control: 'name', key: 'name', label: 'Name', placeholder }
}

function slugField(placeholder: string): SlugFieldSpec {
	return { control: 'slug', key: 'slug', label: 'Slug', placeholder, hint: SLUG_HINT }
}

const descriptionField: TextFieldSpec = {
	control: 'text', key: 'description', label: 'Description', placeholder: 'Brief description...', emptyAsNull: false,
}

const massDisplayField = (units: string): DerivedFieldSpec => ({
	control: 'derived', label: 'Mass',
	compute: ctx => formatFromDraft(ctx, 'massKg', formatMass),
	hint: `Auto-formatted from the numeric mass value. Shows ${units} reference units.`,
})

const radiusDisplayField = (units: string): DerivedFieldSpec => ({
	control: 'derived', label: 'Radius',
	compute: ctx => formatFromDraft(ctx, 'radiusM', formatRadius),
	hint: `Auto-formatted from the numeric radius value. Shows ${units} reference units.`,
})

function physicalDerivations(ctx: FieldContext) {
	return deriveBodyFields(num(ctx, 'massKg'), num(ctx, 'radiusM'))
}

function rotationSection(placeholder: string, tiltPlaceholder: string, periodHint: string, tiltHint: string): FormSection {
	return {
		id: 'rotation', label: 'Rotation',
		groups: [{
			cols: 3,
			fields: [
				{ control: 'number', key: 'rotationPeriodS', label: 'Rotation Period (seconds)', placeholder, hint: periodHint },
				{
					control: 'derived', label: 'Rotation Period',
					compute: ctx => deriveDisplayStrings(null, null, num(ctx, 'rotationPeriodS')).rotationPeriod,
					hint: 'Human-readable rotation period, formatted from the seconds value.',
				},
				{ control: 'number', key: 'axialTilt', label: 'Axial Tilt (deg)', placeholder: tiltPlaceholder, hint: tiltHint },
			],
		}],
	}
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

const systemConfig: CelestialFormConfig = {
	kind: 'system',
	noun: 'System',
	headerNote: 'The system type is derived from the number of stars — assign stars to change it.',
	updateSchema: UPDATE_SCHEMAS.system,
	useTabs: false,
	sections: [
		{
			id: 'identity', label: 'Identity',
			groups: [
				{
					cols: 3,
					fields: [
						nameField('System name'),
						slugField('system-slug'),
						{ control: 'text', key: 'designations', label: 'Designations', placeholder: 'Alt. names, catalog IDs', hint: 'Alternate names or catalogue identifiers, comma-separated.' },
					],
				},
				{ cols: 1, fields: [descriptionField] },
			],
		},
		{
			id: 'location', label: 'Location',
			intro: 'Placement in the setting. Distance and formation age are shown on the system page; coordinates are stored for a future galaxy map.',
			groups: [
				{
					cols: 3,
					fields: [
						{ control: 'number', key: 'distanceLy', label: 'Distance (ly)', placeholder: '4.24', hint: 'Distance from the reference point, in light-years.' },
						{ control: 'text', key: 'formationAge', label: 'Formation Age', placeholder: '~4.6 billion years', hint: 'When the system formed. Free text.' },
					],
				},
				{
					cols: 3,
					fields: [
						{ control: 'number', key: 'galacticX', label: 'Galactic X (ly)', placeholder: '0.0', hint: 'Coordinate on the setting\'s galactic map. Optional.' },
						{ control: 'number', key: 'galacticY', label: 'Galactic Y (ly)', placeholder: '0.0', hint: 'Coordinate on the setting\'s galactic map. Optional.' },
						{ control: 'number', key: 'galacticZ', label: 'Galactic Z (ly)', placeholder: '0.0', hint: 'Coordinate on the setting\'s galactic map. Optional.' },
					],
				},
			],
		},
	],
	deleteConfirm: {
		title: 'Delete star system',
		message: name => `Delete "${name}"? This cannot be undone. Stars in this system will be unassigned, not deleted.`,
		action: 'Delete System',
	},
	deleteNote: 'Delete this star system record. Stars in it are unassigned, not deleted.',
}

// ---------------------------------------------------------------------------
// Star
// ---------------------------------------------------------------------------

const STAR_PRESETS = getStarPresets()

function starDerivedLuminosityW(ctx: FieldContext): number | null {
	const radiusM = num(ctx, 'radiusM')
	const temperatureK = num(ctx, 'temperatureK')
	return radiusM != null && temperatureK != null && radiusM > 0 && temperatureK > 0
		? computeLuminosity(radiusM, temperatureK)
		: null
}

function starEffectiveLuminosityW(ctx: FieldContext): number | null {
	return num(ctx, 'luminosityW') ?? starDerivedLuminosityW(ctx)
}

/**
 * The mass a star's binary orbit derives its period from: the pair's combined
 * mass when it orbits another star, or the system's total stellar mass when it
 * orbits the barycenter (own draft mass + every other member star).
 */
function starPrimaryMassKg(ctx: FieldContext): number | null {
	const parentStarId = text(ctx, 'parentStarId')
	if (parentStarId) {
		const parent = ctx.stars.find(option => String(option.id) === parentStarId)
		return parent?.massKg ? parent.massKg + (num(ctx, 'massKg') ?? 0) : null
	}
	const systemId = text(ctx, 'systemId')
	if (systemId) {
		let total = num(ctx, 'massKg') ?? 0
		for (const option of ctx.stars) {
			if (option.id !== ctx.selfId && String(option.systemId ?? '') === systemId && option.massKg) {
				total += option.massKg
			}
		}
		return total > 0 ? total : null
	}
	return null
}

function starEffectivePeriodDays(ctx: FieldContext): number | null {
	const stored = num(ctx, 'orbitalPeriodDays')
	if (stored != null) return stored
	const semiMajorAxisAu = num(ctx, 'semiMajorAxisAu')
	const primaryMassKg = starPrimaryMassKg(ctx)
	return semiMajorAxisAu != null && semiMajorAxisAu > 0 && primaryMassKg != null
		? computeOrbitalPeriodDays(semiMajorAxisAu, primaryMassKg)
		: null
}

function starDisplayStrings(ctx: FieldContext) {
	return deriveDisplayStrings(starEffectivePeriodDays(ctx), num(ctx, 'semiMajorAxisAu'), num(ctx, 'rotationPeriodS'))
}

const starColorField: TextFieldSpec = {
	control: 'text', key: 'color', label: 'Color', placeholder: 'Yellow-white',
	hint: 'Descriptive color name used for map rendering. Examples: yellow-white, orange-red, blue-white.',
}

const starConfig: CelestialFormConfig = {
	kind: 'star',
	noun: 'Star',
	headerNote: 'Structured star properties are managed here.',
	updateSchema: UPDATE_SCHEMAS.star,
	useTabs: true,
	passthroughKeys: ['luminosityW'],
	sections: [
		{
			id: 'identity', label: 'Identity',
			groups: [
				{
					cols: 3,
					fields: [
						nameField('Star name'),
						slugField('star-slug'),
						{
							control: 'select', key: 'systemId', label: 'System', omitFromPayload: true,
							options: ctx => [
								{ value: '', label: 'None' },
								...ctx.systems.map(system => ({ value: String(system.id), label: system.name })),
							],
						},
						starColorField,
					],
				},
				{ cols: 1, fields: [descriptionField] },
			],
		},
		{
			id: 'stellar', label: 'Stellar',
			groups: [{
				cols: 3,
				fields: [
					{ control: 'text', key: 'spectralType', label: 'Spectral Type', placeholder: 'G2V', hint: 'Morgan-Keenan classification. Letter = temperature class (O B A F G K M), number = subclass, roman numeral = luminosity class. The Sun is G2V.' },
					{ control: 'number', key: 'massKg', label: 'Mass (kg)', placeholder: '1.989e30', hint: 'Total mass in kilograms. The Sun is 1.989 × 10³⁰ kg. Used by orbiting bodies to derive orbital periods via Kepler\'s law.' },
					massDisplayField('Solar'),
					{ control: 'number', key: 'radiusM', label: 'Radius (m)', placeholder: '696340000', hint: 'Mean radius in metres. The Sun is 696,340,000 m.' },
					radiusDisplayField('Solar'),
					{ control: 'lockable', key: 'density', label: 'Density', source: { extra: 'density' }, derive: ctx => physicalDerivations(ctx).density, hint: 'Mass / volume. Derived from mass and radius. Lock to override.' },
					{ control: 'lockable', key: 'surfaceGravity', label: 'Surface Gravity', source: { extra: 'surface_gravity' }, derive: ctx => physicalDerivations(ctx).surfaceGravity, hint: 'GM/r². Derived from mass and radius. The Sun is 274 m/s².' },
					{ control: 'lockable', key: 'escapeVelocity', label: 'Escape Velocity', source: { extra: 'escape_velocity' }, derive: ctx => physicalDerivations(ctx).escapeVelocity, hint: '√(2GM/r). The Sun is 617.7 km/s.' },
					{ control: 'number', key: 'temperatureK', label: 'Temperature (K)', placeholder: '5778', hint: 'Effective surface temperature in Kelvin. The Sun is 5,778 K. Used with radius to derive luminosity via Stefan-Boltzmann law.' },
					{
						control: 'derived', label: 'Temperature',
						compute: ctx => formatFromDraft(ctx, 'temperatureK', formatTemperatureK),
						hint: 'Auto-formatted from the numeric Kelvin value.',
					},
					{
						control: 'lockable', key: 'luminosity',
						label: ctx => `Luminosity${!ctx.draft[lockFlagKey('luminosity')] && starDerivedLuminosityW(ctx) ? ' (Stefan-Boltzmann)' : ''}`,
						source: { extra: 'luminosity' },
						derive: (ctx) => {
							const luminosityW = starEffectiveLuminosityW(ctx)
							return luminosityW == null ? null : formatLuminosity(luminosityW)
						},
						hint: 'L = 4πR²σT⁴. Derived from radius and temperature. The Sun is 1.0 L☉. Lock to set a custom value for magically dim/bright stars.',
					},
					{ control: 'text', key: 'luminosityVisual', label: 'Visual Luminosity', placeholder: '1.0 L☉ (visual)', hint: 'Luminosity in the visible spectrum only. Can differ from bolometric luminosity for very hot or cool stars.' },
					{
						control: 'derived', label: 'Habitable Zone',
						visible: ctx => starEffectiveLuminosityW(ctx) != null,
						compute: (ctx) => {
							const luminosityW = starEffectiveLuminosityW(ctx)
							if (luminosityW == null) return null
							const hz = computeHabitableZoneAu(luminosityW)
							return `${hz.inner.toFixed(2)} – ${hz.outer.toFixed(2)} AU`
						},
						hint: 'Conservative HZ from luminosity: inner = √(L/1.1), outer = √(L/0.53). Where liquid water could exist on a rocky planet.',
					},
					{ control: 'text', key: 'metallicity', label: 'Metallicity', placeholder: '[Fe/H] = 0.0', hint: 'Metal content relative to the Sun. [Fe/H] = 0 is solar. Higher values mean more metals, increasing rocky planet likelihood.' },
					{ control: 'text', key: 'age', label: 'Age', placeholder: '~4.6 billion years', hint: 'Estimated age. Free text.' },
					starColorField,
				],
			}],
		},
		rotationSection(
			'2160000', '7.25',
			'Sidereal rotation period in seconds. The Sun\'s equatorial period is ~25.05 days (2,164,320 s). Stars rotate differentially.',
			'Angle between the rotational axis and the ecliptic. The Sun is 7.25°.',
		),
		{
			id: 'orbit', label: 'Orbit',
			intro: 'For binary or multiple star systems. Leave blank for single stars.',
			groups: [{
				cols: 3,
				fields: [
					{
						control: 'select', key: 'parentStarId', label: 'Orbits Star', omitFromPayload: true, clearIfInvalid: true,
						options: ctx => [
							{ value: '', label: 'None (primary star)' },
							...ctx.stars
								.filter(option => option.id !== ctx.selfId)
								.filter(option => (text(ctx, 'systemId') ? String(option.systemId ?? '') === text(ctx, 'systemId') : false))
								.map(option => ({ value: String(option.id), label: option.name })),
						],
					},
					{ control: 'number', key: 'orbitalPeriodDays', label: 'Orbital Period (days)', placeholder: '79.91', hint: 'Orbital period in days for binary/multiple systems. Leave blank — it is derived from semi-major axis and combined mass wherever it is shown.' },
					{ control: 'derived', label: 'Orbital Period', compute: ctx => starDisplayStrings(ctx).orbitalPeriod, hint: 'Human-readable period: the explicit days value, else Kepler from semi-major axis and combined mass.' },
					{ control: 'number', key: 'semiMajorAxisAu', label: 'Semi-major Axis (AU)', placeholder: '23.4', min: 0, rangeError: 'Must be 0 or greater', hint: 'Half the longest diameter of the binary orbit, in AU. Determines the orbit size on the system map.' },
					{ control: 'derived', label: 'Semi-major Axis', compute: ctx => starDisplayStrings(ctx).semiMajorAxis, hint: 'Same distance converted to kilometres.' },
					{ control: 'number', key: 'eccentricity', label: 'Eccentricity', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'How elliptical the binary orbit is. 0 = circular, approaching 1 = extremely elongated.' },
					{ control: 'number', key: 'epochPhase', label: 'Epoch Phase', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'Position along the orbit at day 0 (0–1). Used for map animation.' },
					{
						control: 'derived', label: 'Periastron',
						compute: ctx => deriveStarOrbitalFields(num(ctx, 'semiMajorAxisAu'), num(ctx, 'eccentricity')).periastron,
						hint: 'Closest approach: a × (1 − e). The near point of the binary orbit.',
					},
					{
						control: 'derived', label: 'Apastron',
						compute: ctx => deriveStarOrbitalFields(num(ctx, 'semiMajorAxisAu'), num(ctx, 'eccentricity')).apastron,
						hint: 'Farthest separation: a × (1 + e). The far point of the binary orbit.',
					},
				],
			}],
		},
		{
			id: 'observation', label: 'Observation',
			groups: [{
				cols: 3,
				fields: [
					{ control: 'text', key: 'apparentMagnitude', label: 'Apparent Magnitude', placeholder: '-26.74', hint: 'Brightness as seen from a reference point. Lower = brighter. The Sun seen from Earth is -26.74.' },
					{ control: 'text', key: 'absoluteMagnitude', label: 'Absolute Magnitude', placeholder: '4.83', hint: 'Intrinsic brightness at a standard distance of 10 parsecs. The Sun is 4.83.' },
					{ control: 'text', key: 'angularDiameter', label: 'Angular Diameter', placeholder: '31.46 arcmin', hint: 'Apparent size in the sky from a reference point. The Sun is ~31.5 arcminutes from Earth.' },
				],
			}],
		},
	],
	// The single hierarchy edge: a companion orbits its parent star, a primary
	// orbits (belongs to) the system.
	extraPayload: ctx => ({
		parentId: text(ctx, 'parentStarId')
			? Number(text(ctx, 'parentStarId'))
			: (text(ctx, 'systemId') ? Number(text(ctx, 'systemId')) : null),
	}),
	physicsWarnings: ctx => validateStarPhysics({
		massKg: num(ctx, 'massKg'),
		radiusM: num(ctx, 'radiusM'),
		semiMajorAxisAu: num(ctx, 'semiMajorAxisAu'),
		eccentricity: num(ctx, 'eccentricity'),
		temperatureK: num(ctx, 'temperatureK'),
		spectralType: text(ctx, 'spectralType') || null,
	}),
	presets: {
		placeholder: 'Choose a star...',
		names: [...STAR_PRESETS.keys()],
		patch: (name) => {
			const preset = STAR_PRESETS.get(name)
			if (!preset) return null
			return {
				spectralType: preset.spectralType,
				massKg: preset.massKg,
				radiusM: preset.radiusM,
				luminosityW: preset.luminosityW ?? null,
				temperatureK: preset.temperatureK ?? null,
				age: preset.age,
				color: preset.color,
				apparentMagnitude: preset.apparentMagnitude,
				// Preset values are canonical — re-lock every override.
				density: null, [lockFlagKey('density')]: false,
				surfaceGravity: null, [lockFlagKey('surfaceGravity')]: false,
				escapeVelocity: null, [lockFlagKey('escapeVelocity')]: false,
				luminosity: null, [lockFlagKey('luminosity')]: false,
			}
		},
	},
	deleteConfirm: {
		title: 'Delete star',
		message: name => `Delete "${name}"? This cannot be undone and may affect child records.`,
		action: 'Delete Star',
	},
	deleteNote: 'Delete this star record. Child records that depend on it may also be affected.',
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

const BODY_PRESETS = getBodyPresets()

/**
 * The body form's primary selector (`starId` draft key) holds either a star id
 * ('12') or a system barycenter ('system:3', a circumbinary orbit).
 */
function bodyPrimarySelection(ctx: FieldContext): { starId: string, systemId: string } {
	const raw = text(ctx, 'starId')
	if (raw.startsWith('system:')) return { starId: '', systemId: raw.slice('system:'.length) }
	return { starId: raw, systemId: '' }
}

/** Mass of the selected primary: the star's, or the system's total stellar mass. */
function bodyPrimaryMassKg(ctx: FieldContext): number | null {
	const { starId, systemId } = bodyPrimarySelection(ctx)
	if (starId) {
		const star = ctx.stars.find(starOption => String(starOption.id) === starId)
		return star?.massKg ?? null
	}
	if (systemId) {
		let total = 0
		for (const starOption of ctx.stars) {
			if (String(starOption.systemId ?? '') === systemId && starOption.massKg) total += starOption.massKg
		}
		return total > 0 ? total : null
	}
	return null
}

function bodyParentMassKg(ctx: FieldContext): number | null {
	const parentId = text(ctx, 'parentId')
	if (parentId) {
		const parent = ctx.siblings.find(sibling => String(sibling.id) === parentId)
		if (parent?.massKg) return parent.massKg
	}
	return bodyPrimaryMassKg(ctx)
}

function bodyOrbitalDerivations(ctx: FieldContext) {
	const unlocked = !!ctx.draft[lockFlagKey('orbitalPeriodDays')]
	return deriveBodyOrbitalFields(
		num(ctx, 'semiMajorAxisAu'),
		unlocked ? num(ctx, 'orbitalPeriodDays') : null,
		num(ctx, 'massKg'),
		bodyParentMassKg(ctx),
		num(ctx, 'eccentricity'),
	)
}

function bodyEffectivePeriodDays(ctx: FieldContext): number | null {
	return ctx.draft[lockFlagKey('orbitalPeriodDays')]
		? num(ctx, 'orbitalPeriodDays')
		: bodyOrbitalDerivations(ctx).orbitalPeriodDays
}

function bodyDisplayStrings(ctx: FieldContext) {
	return deriveDisplayStrings(bodyEffectivePeriodDays(ctx), num(ctx, 'semiMajorAxisAu'), num(ctx, 'rotationPeriodS'))
}

/** The parent body's Hill sphere (AU), so a moon orbiting beyond it can be flagged. */
function bodyParentHillAu(ctx: FieldContext): number | null {
	const parentId = text(ctx, 'parentId')
	if (!parentId) return null
	const parent = ctx.siblings.find(sibling => String(sibling.id) === parentId)
	const primaryMassKg = bodyPrimaryMassKg(ctx)
	if (!parent?.massKg || !parent?.semiMajorAxisAu || !primaryMassKg) return null
	return computeHillSphereAu(parent.semiMajorAxisAu, parent.massKg, primaryMassKg, parent.eccentricity ?? null)
}

/** Does this sibling orbit the same primary (star or system barycenter) as the draft? */
function bodySharesPrimary(ctx: FieldContext, sibling: BodyReferenceOption): boolean {
	const { starId, systemId } = bodyPrimarySelection(ctx)
	if (systemId) return String(sibling.parentSystemId ?? '') === systemId
	if (starId) return String(sibling.starId ?? '') === starId
	return sibling.starId == null && sibling.parentSystemId == null
}

/**
 * Planets sharing this body's primary (each orbiting it directly), for
 * orbit-crossing detection. Moons are checked for Hill-sphere containment instead.
 */
function bodySiblingOrbits(ctx: FieldContext) {
	if (text(ctx, 'parentId')) return []
	return ctx.siblings
		.filter(sibling => sibling.id !== ctx.selfId
			&& sibling.parentId == null
			&& bodySharesPrimary(ctx, sibling)
			&& sibling.semiMajorAxisAu != null)
		.map(sibling => ({ name: sibling.name, semiMajorAxisAu: sibling.semiMajorAxisAu as number, eccentricity: sibling.eccentricity ?? null }))
}

const bodyConfig: CelestialFormConfig = {
	kind: 'body',
	noun: 'Body',
	headerNote: 'Structured body properties are managed here.',
	updateSchema: UPDATE_SCHEMAS.body,
	useTabs: true,
	sections: [
		{
			id: 'identity', label: 'Identity',
			groups: [
				{
					cols: 3,
					fields: [
						nameField('Body name'),
						slugField('body-slug'),
						{
							control: 'select', key: 'bodyType', label: 'Body Type',
							initial: record => String(record.bodyType ?? 'planet'),
							options: () => [
								{ value: 'planet', label: 'Planet' },
								{ value: 'asteroid', label: 'Asteroid' },
								{ value: 'ring_system', label: 'Ring System' },
							],
						},
						{
							control: 'select', key: 'starId', label: 'Orbits Star / System', omitFromPayload: true,
							hint: 'The primary this body orbits: a star, or a system barycenter for a circumbinary orbit around all of its stars.',
							initial: (record) => {
								if (record.parentSystemId != null) return `system:${record.parentSystemId}`
								return record.starId == null ? '' : String(record.starId)
							},
							options: ctx => [
								{ value: '', label: 'None' },
								...ctx.stars.map(starOption => ({ value: String(starOption.id), label: starOption.name })),
								...ctx.systems.map(system => ({ value: `system:${system.id}`, label: `${system.name} — barycenter (circumbinary)` })),
							],
						},
					],
				},
				{
					cols: 2,
					fields: [
						{
							control: 'select', key: 'parentId', label: 'Orbits Body', omitFromPayload: true, clearIfInvalid: true,
							options: (ctx) => {
								const excluded = descendantIds(ctx.siblings, ctx.selfId)
								const { starId, systemId } = bodyPrimarySelection(ctx)
								return [
									{ value: '', label: starId || systemId ? 'None (orbits primary directly)' : 'None' },
									...ctx.siblings
										.filter(sibling => !excluded.has(sibling.id))
										// Under a barycenter, any body in the system may be the
										// parent; under a star, bodies of that star.
										.filter(sibling => (systemId
											? String(sibling.rootSystemId ?? '') === systemId
											: (starId
												? String(sibling.starId ?? '') === starId
												: sibling.starId == null && sibling.parentSystemId == null)))
										.map(sibling => ({ value: String(sibling.id), label: sibling.name })),
								]
							},
						},
						descriptionField,
					],
				},
			],
		},
		{
			id: 'physical', label: 'Physical',
			groups: [{
				cols: 3,
				fields: [
					{ control: 'number', key: 'massKg', label: 'Mass (kg)', placeholder: '5.972e24', hint: 'Total mass in kilograms. Earth is 5.972 × 10²⁴ kg. Used to derive density, gravity, escape velocity, and Hill sphere.' },
					massDisplayField('Earth/Jupiter/Solar'),
					{ control: 'number', key: 'radiusM', label: 'Radius (m)', placeholder: '6371000', hint: 'Mean radius in metres. Earth is 6,371,000 m. Used to derive density, gravity, and escape velocity.' },
					radiusDisplayField('Earth/Jupiter/Solar'),
					{ control: 'lockable', key: 'density', label: 'Density', source: { extra: 'density' }, derive: ctx => physicalDerivations(ctx).density, hint: 'Mass / volume. Derived from mass and radius. Earth is 5.514 g/cm³. Lock to override for exotic materials.' },
					{ control: 'lockable', key: 'surfaceGravity', label: 'Surface Gravity', source: { extra: 'surface_gravity' }, derive: ctx => physicalDerivations(ctx).surfaceGravity, hint: 'GM/r². Derived from mass and radius. Earth is 9.807 m/s². Lock to override for artificial or magical gravity.' },
					{ control: 'lockable', key: 'escapeVelocity', label: 'Escape Velocity', source: { extra: 'escape_velocity' }, derive: ctx => physicalDerivations(ctx).escapeVelocity, hint: '√(2GM/r). Earth is 11.186 km/s. Lock to override.' },
					{ control: 'text', key: 'temperature', label: 'Temperature', placeholder: '288 K (mean)', hint: 'Mean surface or cloud-top temperature. Free text — include units.' },
					{ control: 'text', key: 'age', label: 'Age', placeholder: '~4.5 billion years', hint: 'Estimated age. Free text.' },
				],
			}],
		},
		{
			id: 'composition', label: 'Composition',
			groups: [{
				cols: 3,
				fields: [
					{ control: 'text', key: 'composition', label: 'Composition', placeholder: 'Iron, nickel, silicates', hint: 'Primary materials making up the body.' },
					{ control: 'text', key: 'atmosphere', label: 'Atmosphere', placeholder: 'N2 78%, O2 21%', hint: 'Atmospheric composition. Leave blank for airless bodies.' },
					{ control: 'text', key: 'surfacePressure', label: 'Surface Pressure', placeholder: '101.325 kPa', hint: 'Atmospheric pressure at the surface. Earth is 101.325 kPa.' },
				],
			}],
		},
		{
			id: 'orbit', label: 'Orbit',
			groups: [{
				cols: 3,
				fields: [
					{
						control: 'lockable', key: 'orbitalPeriodDays', label: 'Orbital Period (days)',
						source: { record: 'orbitalPeriodDays' }, valueType: 'number', placeholder: '365.25',
						derive: (ctx) => {
							const unlocked = !!ctx.draft[lockFlagKey('orbitalPeriodDays')]
							const kepler = unlocked ? null : bodyOrbitalDerivations(ctx).orbitalPeriodDays
							return kepler ? `${kepler.toFixed(3)} days` : null
						},
						hint: 'Time for one full orbit in days. Derived from semi-major axis + parent star mass via Kepler\'s third law. Unlock to set a custom value.',
					},
					{ control: 'derived', label: 'Orbital Period', compute: ctx => bodyDisplayStrings(ctx).orbitalPeriod, hint: 'Human-readable period formatted from the days value.' },
					{ control: 'number', key: 'semiMajorAxisAu', label: 'Semi-major Axis (AU)', placeholder: '1.0', min: 0, rangeError: 'Must be 0 or greater', hint: 'Half the longest diameter of the orbit, in astronomical units. 1 AU = Earth–Sun distance.' },
					{ control: 'derived', label: 'Semi-major Axis', compute: ctx => bodyDisplayStrings(ctx).semiMajorAxis, hint: 'Same distance converted to kilometres.' },
					{ control: 'number', key: 'eccentricity', label: 'Eccentricity', placeholder: '0.0167', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'How elliptical the orbit is. 0 = perfect circle, 1 = parabolic escape. Earth is 0.0167.' },
					{ control: 'number', key: 'inclination', label: 'Inclination (deg)', placeholder: '0.0', hint: 'Angle of the orbital plane relative to the reference plane (ecliptic), in degrees.' },
					{ control: 'number', key: 'epochPhase', label: 'Epoch Phase', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'Position along the orbit at day 0 (0–1). Used for map animation. 0 = periapsis.' },
					{ control: 'derived', label: 'Orbital Velocity', compute: ctx => bodyOrbitalDerivations(ctx).orbitalVelocity, hint: 'Mean speed along the orbit: 2πa / T. Earth is ~29.78 km/s.' },
					{ control: 'derived', label: 'Hill Sphere', compute: ctx => bodyOrbitalDerivations(ctx).hillSphere, hint: 'Maximum distance at which this body can hold satellites. Derived from semi-major axis, body mass, and parent mass: a × (m/3M)^⅓.' },
				],
			}],
		},
		rotationSection(
			'86164.1', '23.44',
			'Sidereal rotation period in seconds. Earth is 86,164 s (23h 56m 4s). Not the same as a solar day.',
			'Angle between the rotational axis and the orbital plane. Earth is 23.44°. Drives seasons.',
		),
		{
			id: 'observation', label: 'Observation',
			groups: [{
				cols: 3,
				fields: [
					{ control: 'text', key: 'apparentMagnitude', label: 'Apparent Magnitude', placeholder: '-3.86', hint: 'Brightness as seen from a reference point. Lower = brighter. Venus is about -4.6, full Moon is -12.7.' },
					{ control: 'text', key: 'angularDiameter', label: 'Angular Diameter', placeholder: '3.5 arcsec', hint: 'Apparent size in the sky from a reference point. The Moon is ~31 arcminutes.' },
					{ control: 'text', key: 'albedo', label: 'Albedo', placeholder: '0.306', hint: 'Fraction of incoming light reflected. 0 = perfectly dark, 1 = perfectly reflective. Earth is 0.306.' },
					{ control: 'checkbox', key: 'hasRings', label: 'Has rings' },
				],
			}],
		},
	],
	// The single hierarchy edge: a moon orbits its parent body, a planet orbits
	// the star, a circumbinary body orbits the system barycenter.
	extraPayload: (ctx) => {
		const parentId = text(ctx, 'parentId')
		if (parentId) return { parentId: Number(parentId) }
		const { starId, systemId } = bodyPrimarySelection(ctx)
		const primary = starId || systemId
		return { parentId: primary ? Number(primary) : null }
	},
	physicsWarnings: ctx => validateBodyPhysics({
		massKg: num(ctx, 'massKg'),
		radiusM: num(ctx, 'radiusM'),
		orbitalPeriodDays: bodyEffectivePeriodDays(ctx),
		semiMajorAxisAu: num(ctx, 'semiMajorAxisAu'),
		eccentricity: num(ctx, 'eccentricity'),
		rotationPeriodS: num(ctx, 'rotationPeriodS'),
		axialTilt: num(ctx, 'axialTilt'),
		bodyType: text(ctx, 'bodyType') || null,
		isSatellite: !!text(ctx, 'parentId'),
		siblingOrbits: bodySiblingOrbits(ctx),
		parentHillAu: bodyParentHillAu(ctx),
	}),
	presets: {
		placeholder: 'Choose a body...',
		names: [...BODY_PRESETS.keys()],
		patch: (name) => {
			const preset = BODY_PRESETS.get(name)
			if (!preset) return null
			return {
				bodyType: preset.bodyType,
				massKg: preset.massKg,
				radiusM: preset.radiusM,
				temperature: preset.temperature,
				composition: preset.composition,
				atmosphere: preset.atmosphere,
				orbitalPeriodDays: preset.orbitalPeriodDays,
				[lockFlagKey('orbitalPeriodDays')]: true,
				semiMajorAxisAu: preset.semiMajorAxisAu,
				eccentricity: preset.eccentricity,
				inclination: preset.inclination,
				rotationPeriodS: preset.rotationPeriodS,
				axialTilt: preset.axialTilt,
				hasRings: preset.hasRings,
			}
		},
	},
	deleteConfirm: {
		title: 'Delete celestial body',
		message: name => `Delete "${name}"? This cannot be undone.`,
		action: 'Delete Body',
	},
	deleteNote: 'Delete this celestial body record. This cannot be undone.',
}

export const CELESTIAL_FORM_CONFIGS: Record<CelestialFormKind, CelestialFormConfig> = {
	system: systemConfig,
	star: starConfig,
	body: bodyConfig,
}
