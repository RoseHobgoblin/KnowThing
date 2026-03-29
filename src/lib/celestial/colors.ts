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
