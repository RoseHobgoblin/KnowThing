const MAX_CELL_KEYS = 1000

export interface DimensionLike {
	values: string[]
	sortOrder: number
}

/**
 * Generate all cell keys from dimensions (cartesian product).
 * Cell keys are dot-separated strings: "nominative.singular", "accusative.plural", etc.
 * Dimensions are sorted by sortOrder: 0 = rows, 1 = columns, 2+ = grouped sections.
 */
export function generateCellKeys(dimensions: DimensionLike[]): string[] {
	if (dimensions.length === 0) return []

	const total = dimensions.reduce((accumulator, d) => accumulator * d.values.length, 1)
	if (total > MAX_CELL_KEYS) {
		throw new Error(`Too many inflection cells (${total}). Maximum is ${MAX_CELL_KEYS}. Reduce dimension values.`)
	}

	const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder)

	function cartesian(dimIndex: number): string[] {
		if (dimIndex >= sorted.length) return ['']
		const rest = cartesian(dimIndex + 1)
		const result: string[] = []
		for (const value of sorted[dimIndex].values) {
			for (const suffix of rest) {
				result.push(suffix ? `${value}.${suffix}` : value)
			}
		}
		return result
	}

	return cartesian(0)
}

/** Format a cell key for display: "nominative.singular" → "nominative · singular" */
export function cellKeyLabel(key: string): string {
	return key.split('.').join(' · ')
}
