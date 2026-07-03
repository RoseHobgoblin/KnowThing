/** Map descriptive color names to hex values for celestial bodies */
const COLOR_MAP: Record<string, string> = {
	'yellow-white': '#FFF8DC',
	'yellow': '#FFD700',
	'white': '#F0F0F0',
	'blue-white': '#CAE1FF',
	'blue': '#6B8BCD',
	'orange': '#E8820C',
	'orange-red': '#CC4400',
	'deep orange-red': '#B33000',
	'red': '#CC3333',
	'pale yellow': '#FAFAD2',
}

/** Resolve a color string — handles descriptive names, hex, rgb, css vars */
export function resolveColor(color: string | null | undefined, fallback: string): string {
	if (!color) return fallback
	if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('var')) return color
	return COLOR_MAP[color.toLowerCase()] ?? fallback
}

/** Representative color per Morgan–Keenan spectral class (leading letter). */
const SPECTRAL_CLASS_COLOR: Record<string, string> = {
	O: '#9BB0FF',
	B: '#AABFFF',
	A: '#CAD7FF',
	F: '#F8F7FF',
	G: '#FFF4EA',
	K: '#FFD2A1',
	M: '#FFCC6F',
}

/**
 * Best-effort display color for a star: its explicit color field if set, else a
 * color derived from its spectral class, else a warm default. Also accepts a bare
 * class letter (e.g. 'G') as the spectral type, for class swatches.
 */
export function spectralColor(spectralType: string | null | undefined, colorField?: string | null): string {
	if (colorField) return resolveColor(colorField, '#FFE088')
	const cls = spectralType?.trim()?.[0]?.toUpperCase()
	return (cls ? SPECTRAL_CLASS_COLOR[cls] : undefined) ?? '#FFE088'
}

/** Parse a resolved color into [r, g, b] (0–255), or null if it can't be parsed. */
function toRgb(color: string): [number, number, number] | null {
	let c = color.trim()
	if (c.startsWith('#')) {
		if (c.length === 4) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
		if (c.length >= 7) {
			const r = Number.parseInt(c.slice(1, 3), 16)
			const g = Number.parseInt(c.slice(3, 5), 16)
			const b = Number.parseInt(c.slice(5, 7), 16)
			if (![r, g, b].some(Number.isNaN)) return [r, g, b]
		}
		return null
	}
	const match = c.match(/rgba?\(([^)]+)\)/)
	if (match) {
		const parts = match[1].split(',').map(p => Number.parseFloat(p))
		if (parts.length >= 3 && parts.slice(0, 3).every(n => !Number.isNaN(n))) {
			return [parts[0], parts[1], parts[2]]
		}
	}
	return null
}

/**
 * Resolve a color and return an `rgba(...)` string with the given alpha (0–1).
 * Safe for canvas gradient stops — unlike appending a hex alpha suffix, this never
 * produces an invalid color for descriptive names, `rgb(...)`, or `var(...)` inputs
 * (CSS vars can't resolve on a canvas, so they fall back to a concrete color).
 */
export function colorWithAlpha(color: string | null | undefined, alpha: number, fallback = '#FFE088'): string {
	const rgb = toRgb(resolveColor(color, fallback)) ?? toRgb(fallback) ?? [255, 224, 136]
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}
