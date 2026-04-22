/**
 * Unit conversion for {{convert}} template.
 *
 * Conversions are stored as canonical-unit factors. To convert A → B, we go
 * A → canonical → B. This avoids the N² pair table the old inline impl had.
 */

export type UnitKind = 'length' | 'mass' | 'area' | 'volume' | 'temperature'

interface UnitDef {
	kind: UnitKind
	/** Display label (with proper symbols/superscripts) */
	label: string
	/** Multiplier to canonical unit. For temperature, see special-case branch. */
	toCanonical: number
}

// Canonical units: length=m, mass=kg, area=m², volume=m³, temperature=K
const UNITS: Record<string, UnitDef> = {
	// length
	mm: { kind: 'length', label: 'mm', toCanonical: 0.001 },
	cm: { kind: 'length', label: 'cm', toCanonical: 0.01 },
	m: { kind: 'length', label: 'm', toCanonical: 1 },
	km: { kind: 'length', label: 'km', toCanonical: 1000 },
	in: { kind: 'length', label: 'in', toCanonical: 0.0254 },
	ft: { kind: 'length', label: 'ft', toCanonical: 0.3048 },
	yd: { kind: 'length', label: 'yd', toCanonical: 0.9144 },
	mi: { kind: 'length', label: 'mi', toCanonical: 1609.344 },
	nmi: { kind: 'length', label: 'nmi', toCanonical: 1852 },

	// mass
	g: { kind: 'mass', label: 'g', toCanonical: 0.001 },
	kg: { kind: 'mass', label: 'kg', toCanonical: 1 },
	t: { kind: 'mass', label: 't', toCanonical: 1000 },
	oz: { kind: 'mass', label: 'oz', toCanonical: 0.0283495 },
	lb: { kind: 'mass', label: 'lb', toCanonical: 0.453592 },
	st: { kind: 'mass', label: 'st', toCanonical: 6.35029 },

	// area
	m2: { kind: 'area', label: 'm²', toCanonical: 1 },
	km2: { kind: 'area', label: 'km²', toCanonical: 1_000_000 },
	ha: { kind: 'area', label: 'ha', toCanonical: 10_000 },
	acre: { kind: 'area', label: 'acres', toCanonical: 4046.86 },
	sqft: { kind: 'area', label: 'sq ft', toCanonical: 0.092903 },
	sqmi: { kind: 'area', label: 'sq mi', toCanonical: 2_589_988.11 },

	// volume
	ml: { kind: 'volume', label: 'mL', toCanonical: 1e-6 },
	l: { kind: 'volume', label: 'L', toCanonical: 1e-3 },
	m3: { kind: 'volume', label: 'm³', toCanonical: 1 },
	galus: { kind: 'volume', label: 'US gal', toCanonical: 0.00378541 },
	galuk: { kind: 'volume', label: 'imp gal', toCanonical: 0.00454609 },

	// temperature — handled specially (offset, not factor)
	c: { kind: 'temperature', label: '°C', toCanonical: 0 },
	f: { kind: 'temperature', label: '°F', toCanonical: 0 },
	k: { kind: 'temperature', label: 'K', toCanonical: 0 },
}

/** Default counterpart for each unit (metric ↔ imperial pairing) */
const DEFAULT_PAIR: Record<string, string> = {
	mm: 'in', cm: 'in', m: 'ft', km: 'mi',
	in: 'cm', ft: 'm', yd: 'm', mi: 'km', nmi: 'mi',
	g: 'oz', kg: 'lb', t: 'lb',
	oz: 'g', lb: 'kg', st: 'kg',
	m2: 'sqft', km2: 'sqmi', ha: 'acre',
	sqft: 'm2', sqmi: 'km2', acre: 'ha',
	ml: 'galus', l: 'galus', m3: 'galus',
	galus: 'l', galuk: 'l',
	c: 'f', f: 'c', k: 'c',
}

function normalizeUnit(raw: string): string {
	const cleaned = raw.toLowerCase().trim()
		.replace(/^°/, '')
		.replaceAll('²', '2').replaceAll('³', '3')

	const aliases: Record<string, string> = {
		'sq mi': 'sqmi', 'sq km': 'km2', 'sq m': 'm2', 'sq ft': 'sqft',
		'us gal': 'galus', 'imp gal': 'galuk',
	}
	if (aliases[cleaned]) return aliases[cleaned]

	return cleaned.replaceAll(/\s+/g, '')
}

function toKelvin(value: number, unit: string): number {
	if (unit === 'c') return value + 273.15
	if (unit === 'f') return (value - 32) * 5 / 9 + 273.15
	return value // already K
}

function fromKelvin(kelvin: number, unit: string): number {
	if (unit === 'c') return kelvin - 273.15
	if (unit === 'f') return (kelvin - 273.15) * 9 / 5 + 32
	return kelvin
}

function formatNumber(n: number, precision?: number): string {
	if (precision !== undefined) return n.toFixed(precision)
	const abs = Math.abs(n)
	if (abs === 0) return '0'
	if (abs < 0.01) return n.toPrecision(2)
	if (abs < 10) return n.toFixed(2)
	if (abs < 1000) return n.toFixed(1)
	return Math.round(n).toLocaleString()
}

export interface ConvertResult {
	/** Formatted source value with its unit label */
	source: { value: string, unit: string }
	/** Formatted converted value with its unit label, or null if unknown */
	target: { value: string, unit: string } | null
}

/**
 * Convert `value` from `fromUnit` to `toUnit` (or to a sensible default if `toUnit` is empty).
 * Returns null target if the source unit is unknown or the units are incompatible.
 */
export function convert(value: number, fromUnit: string, toUnit?: string, precision?: number): ConvertResult {
	const fromKey = normalizeUnit(fromUnit)
	const fromDef = UNITS[fromKey]

	const sourceLabel = fromDef?.label ?? fromUnit
	const sourceFormatted = Number.isFinite(value) ? formatNumber(value, precision) : String(value)
	const source = { value: sourceFormatted, unit: sourceLabel }

	if (!fromDef || !Number.isFinite(value)) return { source, target: null }

	const toKey = (toUnit && normalizeUnit(toUnit)) || DEFAULT_PAIR[fromKey]
	if (!toKey) return { source, target: null }

	const toDef = UNITS[toKey]
	if (!toDef || toDef.kind !== fromDef.kind) return { source, target: null }

	let result: number
	if (fromDef.kind === 'temperature') {
		result = fromKelvin(toKelvin(value, fromKey), toKey)
	} else {
		result = (value * fromDef.toCanonical) / toDef.toCanonical
	}

	return { source, target: { value: formatNumber(result, precision), unit: toDef.label } }
}
