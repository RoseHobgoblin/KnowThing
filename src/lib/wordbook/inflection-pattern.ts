/** Apply a stem to a paradigm rule pattern, replacing `{stem}` placeholders. */
export function applyStem(pattern: string, stem: string): string {
	if (!pattern) return ''
	if (!pattern.includes('{stem}')) return pattern
	return pattern.replaceAll('{stem}', stem)
}
