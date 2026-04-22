import type { TemplateArg } from '$lib/parser/types.js'

/** Get the value of a named argument by key (case-insensitive, trimmed). */
export function namedArg(args: TemplateArg[], key: string): string | undefined {
	const target = key.toLowerCase()
	const found = args.find(a => a.name?.toLowerCase().trim() === target)
	return found?.value
}

/** Try multiple alias keys, return the first hit. */
export function namedArgAny(args: TemplateArg[], ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = namedArg(args, key)
		if (value !== undefined) return value
	}
	return undefined
}

/** All positional (unnamed) argument values, in order. */
export function positionalArgs(args: TemplateArg[]): string[] {
	return args.filter(a => !a.name).map(a => a.value)
}

/** A specific positional arg (1-indexed in callers' minds, 0-indexed here). */
export function positionalArg(args: TemplateArg[], index: number): string | undefined {
	return positionalArgs(args)[index]
}

/** Format args back to wikitext-style for fallback rendering. */
export function formatArgs(args: TemplateArg[]): string {
	return args.map(a => (a.name ? `${a.name}=${a.value}` : a.value)).join(' | ')
}
