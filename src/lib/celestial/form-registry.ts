import type { ZodType } from 'zod'
import { UPDATE_SCHEMAS } from './schema.js'
import { getStarPresets, getBodyPresets } from './presets.js'
import {
	computeHabitableZoneAu,
	computeHillSphereAu,
	computeLuminosity,
	computeOrbitalPeriodDays,
	deriveSystemType,
	deriveBodyFields,
	deriveBodyOrbitalFields,
	deriveDisplayStrings,
	deriveStarOrbitalFields,
	formatLuminosity,
	formatMass,
	formatRadius,
	formatTemperatureK,
	au, kg, m, kelvin, watts,
} from 'tungolcraft'
import { validateBodyPhysics, validateStarPhysics, type PhysicsWarning } from 'tungolcraft'
import { spectralColor } from './colors.js'

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
/** A selectable display unit: storage = typed × factor. The factor-1 entry is the storage unit. */
export interface UnitOption { label: string, factor: number }

export interface NumberFieldSpec extends FieldBase {
	control: 'number'
	key: string
	placeholder?: string
	min?: number
	max?: number
	rangeError?: string
	/** Selectable display units (ascending by factor). Omit for a plain numeric input. */
	units?: UnitOption[]
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
	| LockableFieldSpec

/** One row of the live "computed properties" side panel. Null values are hidden. */
export interface ComputedSpec {
	label: string
	compute: (ctx: FieldContext) => string | null
	/** Section id this row belongs to — the panel scopes to the active tab by default. */
	tab?: string
}

/** The entity preview card at the top of the side panel. */
export interface FormPreview {
	title: string
	subtitle: string | null
	/** Swatch color (resolved hex), or null for a neutral dot. */
	color: string | null
}

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
	/** Live-derived rows for the side panel. */
	computed?: ComputedSpec[]
	/** Lockable derived fields, rendered as their own "Overrides" section below the form. */
	overrides?: LockableFieldSpec[]
	/** Entity preview card for the side panel. */
	preview?: (ctx: FieldContext) => FormPreview
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
	return [
		...config.sections.flatMap(section => section.groups.flatMap(group => group.fields)),
		...(config.overrides ?? []),
	]
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

function physicalDerivations(ctx: FieldContext) {
	return deriveBodyFields(num(ctx, 'massKg'), num(ctx, 'radiusM'))
}

// ---- Display units (storage = typed × factor; the factor-1 entry is storage) ----

const MASS_UNITS: UnitOption[] = [
	{ label: 'kg', factor: 1 },
	{ label: 'M⊕', factor: 5.972e24 },
	{ label: 'Mⱼ', factor: 1.898e27 },
	{ label: 'M☉', factor: 1.989e30 },
]

const RADIUS_UNITS: UnitOption[] = [
	{ label: 'm', factor: 1 },
	{ label: 'km', factor: 1e3 },
	{ label: 'R⊕', factor: 6.371e6 },
	{ label: 'Rⱼ', factor: 6.9911e7 },
	{ label: 'R☉', factor: 6.9634e8 },
]

const ROTATION_UNITS: UnitOption[] = [
	{ label: 's', factor: 1 },
	{ label: 'hours', factor: 3600 },
	{ label: 'days', factor: 86_400 },
]

const ORBITAL_PERIOD_UNITS: UnitOption[] = [
	{ label: 'days', factor: 1 },
	{ label: 'years', factor: 365.25 },
]

const SEMI_MAJOR_AXIS_UNITS: UnitOption[] = [
	{ label: 'km', factor: 1 / 1.495_978_707e8 },
	{ label: 'AU', factor: 1 },
]

const KELVIN_UNITS: UnitOption[] = [{ label: 'K', factor: 1 }]

const LIGHT_YEAR_UNITS: UnitOption[] = [
	{ label: 'ly', factor: 1 },
	{ label: 'pc', factor: 3.26156 },
]

function rotationSection(placeholder: string, tiltPlaceholder: string, periodHint: string, tiltHint: string): FormSection {
	return {
		id: 'rotation', label: 'Rotation',
		groups: [{
			cols: 2,
			fields: [
				{ control: 'number', key: 'rotationPeriodS', label: 'Rotation Period', placeholder, hint: periodHint, units: ROTATION_UNITS },
				{ control: 'number', key: 'axialTilt', label: 'Axial Tilt (deg)', placeholder: tiltPlaceholder, hint: tiltHint },
			],
		}],
	}
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

/** Stars catalogued in the system being edited (for the live type preview). */
function systemStarCount(ctx: FieldContext): number {
	if (ctx.selfId == null) return 0
	return ctx.stars.filter(star => star.systemId === ctx.selfId).length
}

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
						{ control: 'number', key: 'distanceLy', label: 'Distance', placeholder: '4.24', hint: 'Distance from the reference point.', units: LIGHT_YEAR_UNITS },
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
	preview: ctx => ({
		title: text(ctx, 'name') || 'New system',
		subtitle: `${deriveSystemType(systemStarCount(ctx))} system`,
		color: null,
	}),
	computed: [
		{ label: 'System type', compute: ctx => deriveSystemType(systemStarCount(ctx)) },
		{ label: 'Stars', compute: ctx => String(systemStarCount(ctx)) },
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
		? computeLuminosity(m(radiusM), kelvin(temperatureK))
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
		? computeOrbitalPeriodDays(au(semiMajorAxisAu), kg(primaryMassKg))
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
				cols: 2,
				fields: [
					{ control: 'text', key: 'spectralType', label: 'Spectral type', placeholder: 'G2V', hint: 'Morgan-Keenan classification. Letter = temperature class (O B A F G K M), number = subclass, roman numeral = luminosity class. The Sun is G2V.' },
					{ control: 'number', key: 'temperatureK', label: 'Temperature', placeholder: '5778', hint: 'Effective surface temperature. The Sun is 5,778 K. Used with radius to derive luminosity via Stefan-Boltzmann law.', units: KELVIN_UNITS },
					{ control: 'number', key: 'massKg', label: 'Mass', placeholder: '1.989e30', hint: 'Total mass. The Sun is 1 M☉. Used by orbiting bodies to derive orbital periods via Kepler\'s law.', units: MASS_UNITS },
					{ control: 'number', key: 'radiusM', label: 'Radius', placeholder: '696340000', hint: 'Mean radius. The Sun is 1 R☉.', units: RADIUS_UNITS },
					{ control: 'text', key: 'metallicity', label: 'Metallicity [Fe/H]', placeholder: '0.0', hint: 'Metal content relative to the Sun. [Fe/H] = 0 is solar. Higher values mean more metals, increasing rocky planet likelihood.' },
					{ control: 'text', key: 'age', label: 'Age', placeholder: '4.6 billion years', hint: 'Estimated age. Free text.' },
					{ control: 'text', key: 'luminosityVisual', label: 'Visual Luminosity', placeholder: '1.0 L☉ (visual)', hint: 'Luminosity in the visible spectrum only. Can differ from bolometric luminosity for very hot or cool stars.' },
				],
			}],
		},
		rotationSection(
			'2160000', '7.25',
			'Sidereal rotation period. The Sun\'s equatorial period is ~25.05 days. Stars rotate differentially.',
			'Angle between the rotational axis and the ecliptic. The Sun is 7.25°.',
		),
		{
			id: 'orbit', label: 'Orbit',
			intro: 'For binary or multiple star systems. Leave blank for single stars.',
			groups: [{
				cols: 2,
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
					{ control: 'number', key: 'orbitalPeriodDays', label: 'Orbital Period', placeholder: '79.91', hint: 'Orbital period for binary/multiple systems. Leave blank — it is derived from semi-major axis and combined mass wherever it is shown.', units: ORBITAL_PERIOD_UNITS },
					{ control: 'number', key: 'semiMajorAxisAu', label: 'Semi-major Axis', placeholder: '23.4', min: 0, rangeError: 'Must be 0 or greater', hint: 'Half the longest diameter of the binary orbit. Determines the orbit size on the system map.', units: SEMI_MAJOR_AXIS_UNITS },
					{ control: 'number', key: 'eccentricity', label: 'Eccentricity', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'How elliptical the binary orbit is. 0 = circular, approaching 1 = extremely elongated.' },
					{ control: 'number', key: 'epochPhase', label: 'Epoch Phase', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'Position along the orbit at day 0 (0–1). Used for map animation.' },
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
	overrides: [
		{ control: 'lockable', key: 'density', label: 'Density', source: { extra: 'density' }, derive: ctx => physicalDerivations(ctx).density, hint: 'Mass / volume. Derived from mass and radius. Unlock to override.' },
		{ control: 'lockable', key: 'surfaceGravity', label: 'Surface Gravity', source: { extra: 'surface_gravity' }, derive: ctx => physicalDerivations(ctx).surfaceGravity, hint: 'GM/r². Derived from mass and radius. The Sun is 274 m/s².' },
		{ control: 'lockable', key: 'escapeVelocity', label: 'Escape Velocity', source: { extra: 'escape_velocity' }, derive: ctx => physicalDerivations(ctx).escapeVelocity, hint: '√(2GM/r). The Sun is 617.7 km/s.' },
		{
			control: 'lockable', key: 'luminosity', label: 'Luminosity',
			source: { extra: 'luminosity' },
			derive: (ctx) => {
				const luminosityW = starEffectiveLuminosityW(ctx)
				return luminosityW == null ? null : formatLuminosity(luminosityW)
			},
			hint: 'L = 4πR²σT⁴. Derived from radius and temperature. The Sun is 1.0 L☉. Unlock for magically dim/bright stars.',
		},
	],
	computed: [
		{ tab: 'stellar', label: 'Mass', compute: ctx => formatFromDraft(ctx, 'massKg', formatMass) },
		{ tab: 'stellar', label: 'Radius', compute: ctx => formatFromDraft(ctx, 'radiusM', formatRadius) },
		{ tab: 'stellar', label: 'Temperature', compute: ctx => formatFromDraft(ctx, 'temperatureK', formatTemperatureK) },
		{ tab: 'stellar', label: 'Density', compute: ctx => physicalDerivations(ctx).density },
		{ tab: 'stellar', label: 'Surface gravity', compute: ctx => physicalDerivations(ctx).surfaceGravity },
		{ tab: 'stellar', label: 'Escape velocity', compute: ctx => physicalDerivations(ctx).escapeVelocity },
		{
			tab: 'stellar',
			label: 'Luminosity',
			compute: (ctx) => {
				const luminosityW = starEffectiveLuminosityW(ctx)
				return luminosityW == null ? null : formatLuminosity(luminosityW)
			},
		},
		{
			tab: 'stellar',
			label: 'Habitable zone',
			compute: (ctx) => {
				const luminosityW = starEffectiveLuminosityW(ctx)
				if (luminosityW == null) return null
				const hz = computeHabitableZoneAu(watts(luminosityW))
				return `${hz.inner.toFixed(2)} – ${hz.outer.toFixed(2)} AU`
			},
		},
		{ tab: 'orbit', label: 'Orbital period', compute: ctx => starDisplayStrings(ctx).orbitalPeriod },
		{ tab: 'orbit', label: 'Semi-major axis', compute: ctx => starDisplayStrings(ctx).semiMajorAxis },
		{ tab: 'orbit', label: 'Periastron', compute: ctx => deriveStarOrbitalFields(num(ctx, 'semiMajorAxisAu'), num(ctx, 'eccentricity')).periastron },
		{ tab: 'orbit', label: 'Apastron', compute: ctx => deriveStarOrbitalFields(num(ctx, 'semiMajorAxisAu'), num(ctx, 'eccentricity')).apastron },
		{ tab: 'rotation', label: 'Rotation period', compute: ctx => starDisplayStrings(ctx).rotationPeriod },
	],
	preview: ctx => ({
		title: text(ctx, 'name') || 'New star',
		subtitle: [text(ctx, 'spectralType'), text(ctx, 'color')].filter(Boolean).join(' · ') || null,
		color: spectralColor(text(ctx, 'spectralType') || null, text(ctx, 'color') || null),
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
	return computeHillSphereAu(au(parent.semiMajorAxisAu), kg(parent.massKg), kg(primaryMassKg), parent.eccentricity ?? null)
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
				cols: 2,
				fields: [
					{ control: 'number', key: 'massKg', label: 'Mass', placeholder: '5.972e24', hint: 'Total mass. Earth is 1 M⊕. Used to derive density, gravity, escape velocity, and Hill sphere.', units: MASS_UNITS },
					{ control: 'number', key: 'radiusM', label: 'Radius', placeholder: '6371000', hint: 'Mean radius. Earth is 1 R⊕. Used to derive density, gravity, and escape velocity.', units: RADIUS_UNITS },
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
			intro: 'The orbital period is derived from the semi-major axis and the primary\'s mass — see the computed panel. Pin a custom period in the Overrides section below.',
			groups: [{
				cols: 2,
				fields: [
					{ control: 'number', key: 'semiMajorAxisAu', label: 'Semi-major Axis', placeholder: '1.0', min: 0, rangeError: 'Must be 0 or greater', hint: 'Half the longest diameter of the orbit. 1 AU = Earth–Sun distance.', units: SEMI_MAJOR_AXIS_UNITS },
					{ control: 'number', key: 'eccentricity', label: 'Eccentricity', placeholder: '0.0167', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'How elliptical the orbit is. 0 = perfect circle, 1 = parabolic escape. Earth is 0.0167.' },
					{ control: 'number', key: 'inclination', label: 'Inclination (deg)', placeholder: '0.0', hint: 'Angle of the orbital plane relative to the reference plane (ecliptic), in degrees.' },
					{ control: 'number', key: 'epochPhase', label: 'Epoch Phase', placeholder: '0.0', min: 0, max: 1, rangeError: 'Use a value from 0 to 1', hint: 'Position along the orbit at day 0 (0–1). Used for map animation. 0 = periapsis.' },
				],
			}],
		},
		rotationSection(
			'86164.1', '23.44',
			'Sidereal rotation period. Earth is 86,164 s (23h 56m 4s). Not the same as a solar day.',
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
	overrides: [
		{
			control: 'lockable', key: 'orbitalPeriodDays', label: 'Orbital Period (days)',
			source: { record: 'orbitalPeriodDays' }, valueType: 'number', placeholder: '365.25',
			derive: (ctx) => {
				const unlocked = !!ctx.draft[lockFlagKey('orbitalPeriodDays')]
				const kepler = unlocked ? null : bodyOrbitalDerivations(ctx).orbitalPeriodDays
				return kepler ? `${kepler.toFixed(3)} days` : null
			},
			hint: 'Derived from semi-major axis + primary mass via Kepler\'s third law. Unlock to set a custom value in days.',
		},
		{ control: 'lockable', key: 'density', label: 'Density', source: { extra: 'density' }, derive: ctx => physicalDerivations(ctx).density, hint: 'Mass / volume. Derived from mass and radius. Earth is 5.514 g/cm³. Unlock for exotic materials.' },
		{ control: 'lockable', key: 'surfaceGravity', label: 'Surface Gravity', source: { extra: 'surface_gravity' }, derive: ctx => physicalDerivations(ctx).surfaceGravity, hint: 'GM/r². Derived from mass and radius. Earth is 9.807 m/s². Unlock for artificial or magical gravity.' },
		{ control: 'lockable', key: 'escapeVelocity', label: 'Escape Velocity', source: { extra: 'escape_velocity' }, derive: ctx => physicalDerivations(ctx).escapeVelocity, hint: '√(2GM/r). Earth is 11.186 km/s. Unlock to override.' },
	],
	computed: [
		{ tab: 'physical', label: 'Mass', compute: ctx => formatFromDraft(ctx, 'massKg', formatMass) },
		{ tab: 'physical', label: 'Radius', compute: ctx => formatFromDraft(ctx, 'radiusM', formatRadius) },
		{ tab: 'physical', label: 'Density', compute: ctx => physicalDerivations(ctx).density },
		{ tab: 'physical', label: 'Surface gravity', compute: ctx => physicalDerivations(ctx).surfaceGravity },
		{ tab: 'physical', label: 'Escape velocity', compute: ctx => physicalDerivations(ctx).escapeVelocity },
		{ tab: 'orbit', label: 'Orbital period', compute: ctx => bodyDisplayStrings(ctx).orbitalPeriod },
		{ tab: 'orbit', label: 'Orbital velocity', compute: ctx => bodyOrbitalDerivations(ctx).orbitalVelocity },
		{ tab: 'orbit', label: 'Semi-major axis', compute: ctx => bodyDisplayStrings(ctx).semiMajorAxis },
		{ tab: 'orbit', label: 'Hill sphere', compute: ctx => bodyOrbitalDerivations(ctx).hillSphere },
		{ tab: 'rotation', label: 'Rotation period', compute: ctx => bodyDisplayStrings(ctx).rotationPeriod },
	],
	preview: (ctx) => {
		const bodyType = text(ctx, 'bodyType') || 'planet'
		const subtitleParts = [bodyType.replace('_', ' ')]
		if (ctx.draft.hasRings) subtitleParts.push('ringed')
		return {
			title: text(ctx, 'name') || 'New body',
			subtitle: subtitleParts.join(' · '),
			color: null,
		}
	},
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
