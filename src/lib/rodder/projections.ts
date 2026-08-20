/**
 * Projections: adapters that turn a typed rodder model (see `models.ts`) into
 * whatever a particular consumer needs. The model is the single source; adding a
 * consumer means adding a projection here, never re-deriving or parsing strings.
 *
 *  - `bodyInfoboxFields` / `starInfoboxFields` → the snake_case FieldMap the
 *    infobox components read (values formatted via the compute.js formatters).
 *  - `rodderStatTiles` → compact "at a glance" tiles for a non-infobox panel.
 *  - `rodderJson` → raw typed numbers for an API / external tools.
 */

import type { FieldMap } from '$lib/infoboxes/types.js'
import type { RodderEntityDocument } from './consumer-contract.js'
import type { BodyModel, StarModel } from 'tungolcraft'
import {
	formatMass, formatRadius, formatDensity, formatSurfaceGravity, formatEscapeVelocity,
	formatPeriod, formatAuAsKm, formatAu, formatOrbitalVelocity, formatTemperatureK,
	formatLuminosity,
} from 'tungolcraft'

/** Set a key only if the value is a non-empty string. */
function setText(map: FieldMap, key: string, value: string | null | undefined): void {
	if (value != null && value !== '') map.set(key, value)
}

/** Set a derived value only if the key isn't already present (overrides win). */
function setDerived(map: FieldMap, key: string, value: string | null | undefined): void {
	if (value != null && value !== '' && !map.has(key)) map.set(key, value)
}

/** Apply the stored extra/override overflow (wins over derived fields). */
function applyExtra(map: FieldMap, extra: Record<string, string>): void {
	for (const [k, v] of Object.entries(extra)) setText(map, k, v)
}

function circumferenceKm(circumferenceM: number): string {
	return `${(circumferenceM / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`
}

// ---- Planet → infobox FieldMap ----

export function bodyInfoboxFields(model: BodyModel): FieldMap {
	const f: FieldMap = new Map()

	// Passthrough text.
	setText(f, 'name', model.name)
	setText(f, 'body_type', model.bodyType)
	setText(f, 'age', model.age)
	setText(f, 'composition', model.composition)
	setText(f, 'atmosphere', model.atmosphere)
	setText(f, 'surface_pressure', model.surfacePressure)
	setText(f, 'apparent_magnitude', model.apparentMagnitude)
	setText(f, 'angular_diameter', model.angularDiameter)
	setText(f, 'description', model.description)

	// Overrides win over anything derived below.
	applyExtra(f, model.extra)
	// The former free-text field is intentionally retired. Do not let an old or
	// hand-authored extra value resurrect it as an untyped infobox row.
	f.delete('albedo')

	// Derived physical / orbital (only-if-absent so overrides survive).
	if (model.massKg != null) setDerived(f, 'mass', formatMass(model.massKg))
	if (model.radiusM != null) setDerived(f, 'radius', formatRadius(model.radiusM))
	if (model.densityKgM3 != null) setDerived(f, 'density', formatDensity(model.densityKgM3))
	if (model.gravityMs2 != null) setDerived(f, 'surface_gravity', formatSurfaceGravity(model.gravityMs2))
	if (model.escapeVelocityMs != null) setDerived(f, 'escape_velocity', formatEscapeVelocity(model.escapeVelocityMs))
	if (model.orbitalPeriodDays != null) setDerived(f, 'orbital_period', formatPeriod(model.orbitalPeriodDays * 86_400))
	if (model.semiMajorAxisAu != null) setDerived(f, 'semi_major_axis', formatAuAsKm(model.semiMajorAxisAu))
	if (model.rotationPeriodS != null) setDerived(f, 'rotation_period', formatPeriod(model.rotationPeriodS))
	if (model.temperatureK != null) setDerived(f, 'temperature', formatTemperatureK(model.temperatureK))

	// Raw scalars (unformatted, as the previous resolver emitted them).
	if (model.eccentricity != null) f.set('eccentricity', String(model.eccentricity))
	if (model.axialTilt != null) f.set('axial_tilt', String(model.axialTilt))
	if (model.inclination != null) f.set('inclination', String(model.inclination))
	if (model.satellites != null) f.set('satellites', String(model.satellites))

	// Relationships.
	if (model.satelliteOf) {
		f.set('satellite_of', model.satelliteOf.name)
		f.set('satellite_of_slug', model.satelliteOf.slug)
	}
	if (model.star) {
		f.set('parent_star', model.star.name)
		f.set('parent_star_slug', model.star.slug)
	}

	// Computed orbital extras.
	if (model.periapsisAu != null) f.set('periapsis', formatAu(model.periapsisAu))
	if (model.apoapsisAu != null) f.set('apoapsis', formatAu(model.apoapsisAu))
	if (model.meanOrbitalSpeedMs != null) f.set('mean_orbital_speed', formatOrbitalVelocity(model.meanOrbitalSpeedMs))

	// Computed geometry from radius.
	if (model.circumferenceM != null) f.set('circumference', circumferenceKm(model.circumferenceM))
	if (model.surfaceAreaM2 != null) f.set('surface_area', `${(model.surfaceAreaM2 / 1e6).toExponential(3)} km²`)
	if (model.volumeM3 != null) f.set('volume', `${(model.volumeM3 / 1e9).toExponential(3)} km³`)
	if (model.equatorialVelocityMs != null) {
		const v = model.equatorialVelocityMs
		f.set('equatorial_velocity', `${v.toFixed(v >= 100 ? 0 : 1)} m/s`)
	}

	return f
}

// ---- Star → infobox FieldMap ----

export function starInfoboxFields(model: StarModel): FieldMap {
	const f: FieldMap = new Map()

	setText(f, 'name', model.name)
	setText(f, 'spectral_type', model.spectralType)
	setText(f, 'luminosity_visual', model.luminosityVisual)
	setText(f, 'age', model.age)
	setText(f, 'color', model.color)
	setText(f, 'metallicity', model.metallicity)
	setText(f, 'apparent_magnitude', model.apparentMagnitude)
	setText(f, 'absolute_magnitude', model.absoluteMagnitude)
	setText(f, 'angular_diameter', model.angularDiameter)
	setText(f, 'description', model.description)

	applyExtra(f, model.extra)

	if (model.massKg != null) setDerived(f, 'mass', formatMass(model.massKg))
	if (model.radiusM != null) setDerived(f, 'radius', formatRadius(model.radiusM))
	if (model.densityKgM3 != null) setDerived(f, 'density', formatDensity(model.densityKgM3))
	if (model.gravityMs2 != null) setDerived(f, 'surface_gravity', formatSurfaceGravity(model.gravityMs2))
	if (model.escapeVelocityMs != null) setDerived(f, 'escape_velocity', formatEscapeVelocity(model.escapeVelocityMs))
	if (model.orbitalPeriodDays != null) setDerived(f, 'orbital_period', formatPeriod(model.orbitalPeriodDays * 86_400))
	if (model.relativeSemiMajorAxisAu != null) setDerived(f, 'relative_semi_major_axis', formatAuAsKm(model.relativeSemiMajorAxisAu))
	if (model.rotationPeriodS != null) setDerived(f, 'rotation_period', formatPeriod(model.rotationPeriodS))
	if (model.temperatureK != null) setDerived(f, 'temperature', formatTemperatureK(model.temperatureK))
	if (model.luminosityW != null) setDerived(f, 'luminosity', formatLuminosity(model.luminosityW))

	if (model.periastronAu != null) f.set('periastron', formatAu(model.periastronAu))
	if (model.apastronAu != null) f.set('apastron', formatAu(model.apastronAu))
	if (model.eccentricity != null) f.set('eccentricity', String(model.eccentricity))
	if (model.axialTilt != null) f.set('axial_tilt', String(model.axialTilt))

	if (model.companionOf) {
		f.set('companion_of', model.companionOf.name)
		f.set('companion_of_slug', model.companionOf.slug)
	}

	// Companions derive from the graph (child stars + barycenter co-components)
	// and link to real entities; an `extra` override still wins for lore-only
	// companions with no catalogued record.
	if (model.companions.length > 0) {
		setDerived(f, 'companion', model.companions.map(c => `[[${c.slug}|${c.name}]]`).join(', '))
	}

	if (model.habitableZoneAu) {
		f.set('habitable_zone', `${model.habitableZoneAu.inner.toFixed(2)} – ${model.habitableZoneAu.outer.toFixed(2)} AU`)
	}
	if (model.equatorialVelocityMs != null) {
		f.set('equatorial_velocity', `${(model.equatorialVelocityMs / 1000).toFixed(2)} km/s`)
	}

	if (model.planetCount > 0) f.set('planets', String(model.planetCount))
	if (model.satelliteCount > 0) f.set('known_satellites', String(model.satelliteCount))

	return f
}

function applyDocumentExtensions(map: FieldMap, extensions: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(extensions)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			setText(map, key, String(value))
		}
	}
}

function systemDocumentInfoboxFields(document: RodderEntityDocument): FieldMap {
	const fields: FieldMap = new Map([['name', document.identity.name]])
	const display = document.displays.rootMap
	const system = document.authored.system
	const systemType = document.resolved.facts.systemType?.value
	if (typeof systemType === 'string') fields.set('system_type', systemType)

	if (display) {
		const stars = display.stars.map((star) => {
			const link = `[[${star.slug}|${star.name}]]`
			return star.spectralType ? `${link} (${star.spectralType})` : link
		})
		fields.set('stars', stars.join(', '))
		fields.set('star_count', String(display.stars.length))
		const planets = display.bodies.filter(body => body.parentId == null).length
		const satellites = display.bodies.length - planets
		if (planets > 0) fields.set('planets', String(planets))
		if (satellites > 0) fields.set('satellites', String(satellites))
	}

	if (system?.distanceLy != null) fields.set('distance', `${system.distanceLy.toLocaleString('en-US', { maximumFractionDigits: 2 })} ly`)
	const position = document.placement?.position
	if (document.placement && position?.x != null && position.y != null && position.z != null) {
		const formatCoordinate = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
		fields.set('coordinates', `(${formatCoordinate(position.x)}, ${formatCoordinate(position.y)}, ${formatCoordinate(position.z)}) ${document.placement.sector.units}, ${document.placement.sector.name} frame`)
	}
	setText(fields, 'formation_age', system?.formationAge)
	setText(fields, 'designations', system?.designations)
	setText(fields, 'description', document.authored.description)
	applyDocumentExtensions(fields, document.authored.extensions)
	return fields
}

/**
 * Presentation helper for Wiki infobox authors. It projects the public live
 * document into the established snake_case FieldMap without exposing storage
 * rows or collapsing the document's authored/derived distinction upstream.
 */
export function rodderDocumentInfoboxFields(document: RodderEntityDocument): FieldMap | null {
	if (document.identity.kind === 'system') return systemDocumentInfoboxFields(document)
	const model = document.resolved.facts.model?.value as BodyModel | StarModel | null | undefined
	let fields: FieldMap
	if (document.identity.kind === 'star' && model?.kind === 'star') fields = starInfoboxFields(model)
	else if (document.identity.kind === 'body' && model?.kind === 'body') fields = bodyInfoboxFields(model)
	else fields = new Map([['name', document.identity.name]])
	setText(fields, 'description', document.authored.description)
	applyDocumentExtensions(fields, document.authored.extensions)
	return fields
}

// ---- Stat tiles: a compact non-infobox projection ----

export interface StatTile {
	label: string
	value: string
	/** Optional secondary line, e.g. a reference-scaled comparison. */
	sub?: string
}

const EARTH_MASS_KG = 5.972e24
const EARTH_RADIUS_M = 6.371e6
const EARTH_GRAVITY = 9.807
const SOLAR_MASS_KG = 1.989e30
const SOLAR_RADIUS_M = 6.9634e8
const SOLAR_LUMINOSITY_W = 3.828e26

function times(ratio: number): string {
	let digits = 2
	if (ratio >= 10) digits = 0
	else if (ratio >= 1) digits = 1
	return `${ratio.toFixed(digits)}×`
}

/**
 * Key facts as tiles — the same model rendered as an at-a-glance grid instead of
 * an exhaustive vertical infobox. Reference-scaled comparisons (×Earth / ×Sun)
 * come straight from the raw SI numbers the FieldMap threw away.
 */
export function rodderStatTiles(model: BodyModel | StarModel): StatTile[] {
	const tiles: StatTile[] = []

	if (model.kind === 'body') {
		if (model.radiusM != null) tiles.push({ label: 'Radius', value: formatRadius(model.radiusM), sub: `${times(model.radiusM / EARTH_RADIUS_M)} Earth` })
		if (model.massKg != null) tiles.push({ label: 'Mass', value: formatMass(model.massKg), sub: `${times(model.massKg / EARTH_MASS_KG)} Earth` })
		if (model.gravityMs2 != null) tiles.push({ label: 'Gravity', value: formatSurfaceGravity(model.gravityMs2), sub: `${times(model.gravityMs2 / EARTH_GRAVITY)} Earth` })
		if (model.rotationPeriodS != null) tiles.push({ label: 'Day', value: formatPeriod(model.rotationPeriodS) })
		if (model.orbitalPeriodDays != null) tiles.push({ label: 'Year', value: formatPeriod(model.orbitalPeriodDays * 86_400) })
		if (model.temperatureK != null) tiles.push({ label: 'Temperature', value: formatTemperatureK(model.temperatureK) })
		return tiles
	}

	if (model.radiusM != null) tiles.push({ label: 'Radius', value: formatRadius(model.radiusM), sub: `${times(model.radiusM / SOLAR_RADIUS_M)} Sun` })
	if (model.massKg != null) tiles.push({ label: 'Mass', value: formatMass(model.massKg), sub: `${times(model.massKg / SOLAR_MASS_KG)} Sun` })
	if (model.luminosityW != null) tiles.push({ label: 'Luminosity', value: formatLuminosity(model.luminosityW), sub: `${times(model.luminosityW / SOLAR_LUMINOSITY_W)} Sun` })
	if (model.temperatureK != null) tiles.push({ label: 'Temperature', value: formatTemperatureK(model.temperatureK) })
	if (model.habitableZoneAu) tiles.push({ label: 'Habitable zone', value: `${model.habitableZoneAu.inner.toFixed(2)}–${model.habitableZoneAu.outer.toFixed(2)} AU` })
	if (model.spectralType) tiles.push({ label: 'Spectral type', value: model.spectralType })
	return tiles
}

/** Raw typed projection for APIs / external tools. Numbers stay numbers. */
export function rodderJson(model: BodyModel | StarModel): BodyModel | StarModel {
	return { ...model }
}

// ---- Fact sheet: grouped, labelled sections (the on-page replacement for the infobox) ----

export interface FactRow {
	label: string
	/** May contain `[[slug|name]]` wikilink markup; render via InlineMarkup. */
	value: string
}
export interface FactSection {
	title: string
	rows: FactRow[]
}

interface SectionSpec {
	title: string
	fields: [key: string, label: string][]
}

const PLANET_SECTIONS: SectionSpec[] = [
	{ title: 'Physical', fields: [['mass', 'Mass'], ['radius', 'Radius'], ['density', 'Density'], ['surface_gravity', 'Surface gravity'], ['escape_velocity', 'Escape velocity'], ['circumference', 'Circumference'], ['surface_area', 'Surface area'], ['volume', 'Volume'], ['temperature', 'Temperature'], ['age', 'Age']] },
	{ title: 'Orbit', fields: [['satellite_of', 'Orbits'], ['orbital_period', 'Orbital period'], ['semi_major_axis', 'Semi-major axis'], ['orbital_velocity', 'Orbital velocity'], ['eccentricity', 'Eccentricity'], ['inclination', 'Inclination'], ['periapsis', 'Periapsis'], ['apoapsis', 'Apoapsis']] },
	{ title: 'Rotation', fields: [['rotation_period', 'Rotation period'], ['axial_tilt', 'Axial tilt'], ['equatorial_velocity', 'Equatorial velocity']] },
	{ title: 'Composition', fields: [['composition', 'Composition'], ['atmosphere', 'Atmosphere'], ['surface_pressure', 'Surface pressure']] },
	{ title: 'Observation', fields: [['apparent_magnitude', 'Apparent magnitude'], ['angular_diameter', 'Angular diameter']] },
	{ title: 'System', fields: [['satellites', 'Satellites']] },
]

const STAR_SECTIONS: SectionSpec[] = [
	{ title: 'Stellar', fields: [['spectral_type', 'Spectral type'], ['mass', 'Mass'], ['radius', 'Radius'], ['temperature', 'Temperature'], ['luminosity', 'Luminosity'], ['luminosity_visual', 'Visual luminosity'], ['density', 'Density'], ['surface_gravity', 'Surface gravity'], ['escape_velocity', 'Escape velocity'], ['metallicity', 'Metallicity'], ['color', 'Color'], ['age', 'Age']] },
	{ title: 'Environment', fields: [['habitable_zone', 'Habitable zone']] },
	{ title: 'Orbit', fields: [['companion', 'Companions'], ['companion_of', 'Orbits'], ['orbital_period', 'Orbital period'], ['relative_semi_major_axis', 'Relative semi-major axis'], ['eccentricity', 'Eccentricity'], ['periastron', 'Periastron'], ['apastron', 'Apastron']] },
	{ title: 'Rotation', fields: [['rotation_period', 'Rotation period'], ['axial_tilt', 'Axial tilt'], ['equatorial_velocity', 'Equatorial velocity']] },
	{ title: 'Observation', fields: [['apparent_magnitude', 'Apparent magnitude'], ['absolute_magnitude', 'Absolute magnitude'], ['angular_diameter', 'Angular diameter']] },
	{ title: 'System', fields: [['planets', 'Planets'], ['known_satellites', 'Known satellites']] },
]

// key → the FieldMap key holding its link target slug.
const LINK_SLUGS: Record<string, string> = {
	satellite_of: 'satellite_of_slug',
	companion_of: 'companion_of_slug',
}

// Keys that are consumed indirectly (as link targets / titles) and must not show
// up as their own rows or in the catch-all "More" section.
const NON_ROW_KEYS = new Set([
	'name', 'description', 'body_type', 'parent_star', 'parent_star_slug', 'satellite_of_slug', 'companion_of_slug',
	// Presentational, not facts.
	'image', 'image_size', 'caption', 'image_caption',
])

function humanize(key: string): string {
	const spaced = key.replaceAll('_', ' ')
	return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function buildSections(fields: FieldMap, specs: SectionSpec[]): FactSection[] {
	const used = new Set<string>(NON_ROW_KEYS)
	const sections: FactSection[] = []

	for (const spec of specs) {
		const rows: FactRow[] = []
		for (const [key, label] of spec.fields) {
			const raw = fields.get(key)
			if (!raw) continue
			used.add(key)
			let value = raw
			const slugKey = LINK_SLUGS[key]
			if (slugKey) {
				const slug = fields.get(slugKey)
				if (slug) value = `[[${slug}|${value}]]`
			}
			rows.push({ label, value })
		}
		if (rows.length > 0) sections.push({ title: spec.title, rows })
	}

	// Anything the specs didn't place (e.g. custom `extra` keys like mean_distance).
	const more: FactRow[] = []
	for (const [key, value] of fields) {
		if (used.has(key) || /^\d+$/.test(key)) continue
		more.push({ label: humanize(key), value })
	}
	if (more.length > 0) sections.push({ title: 'More', rows: more })

	return sections
}

/**
 * The full data as grouped, labelled sections — the on-page replacement for the
 * floating infobox. Values are formatted (and carry wikilink markup for relations),
 * reusing the infobox projection so the two never diverge.
 */
export function rodderFactSections(model: BodyModel | StarModel): FactSection[] {
	return model.kind === 'body'
		? buildSections(bodyInfoboxFields(model), PLANET_SECTIONS)
		: buildSections(starInfoboxFields(model), STAR_SECTIONS)
}
