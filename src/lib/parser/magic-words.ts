import type { TemplateArg as TemplateArgument } from './types.js'

/**
 * Magic words — special {{KEYWORD}} templates that resolve to dynamic values.
 * Returns the resolved string, or null if the name isn't a magic word.
 */
export function resolveMagicWord(
	name: string,
	_args: TemplateArgument[],
	context: MagicWordContext,
): string | null {
	const upper = name.toUpperCase().trim()

	switch (upper) {
		// Page info
		case 'PAGENAME':
			return context.pageName
		case 'FULLPAGENAME':
			return context.namespace ? `${context.namespace}:${context.pageName}` : context.pageName
		case 'NAMESPACE':
			return context.namespace || ''
		case 'BASEPAGENAME':
			return context.pageName.split('/')[0]
		case 'SUBPAGENAME': {
			const parts = context.pageName.split('/')
			return parts.at(-1) ?? null
		}

		// Site info
		case 'SITENAME':
			return context.siteName || 'KnowThing'
		case 'SERVERNAME':
			return context.serverName || 'localhost'

		// Counters / stats (placeholder values, API can fill real ones)
		case 'NUMBEROFPAGES':
			return String(context.pageCount ?? 0)
		case 'NUMBEROFCATEGORIES':
			return String(context.categoryCount ?? 0)

		// Formatting
		case 'DISPLAYTITLE':
			// Side effect: sets display title for the page
			return ''
		case 'TOC':
		case '__TOC__':
			return '' // Handled by renderer
		case 'NOTOC':
		case '__NOTOC__':
			return ''

		default:
			return null
	}
}

/**
 * Parser functions — {{#if:}}, {{#switch:}}, {{lc:}}, etc.
 * Returns the resolved string, or null if the name isn't a parser function.
 */
export function resolveParserFunction(name: string, args: TemplateArgument[]): string | null {
	const lower = name.toLowerCase().trim()
	const vals = args.map(a => a.value.trim())

	switch (lower) {
		case '#if':
			// {{#if: test | then | else}}
			return vals[0] ? (vals[1] ?? '') : (vals[2] ?? '')

		case '#ifeq':
			// {{#ifeq: a | b | equal | not}}
			return vals[0] === vals[1] ? (vals[2] ?? '') : (vals[3] ?? '')

		case '#switch': {
			// {{#switch: value | case1=result1 | case2=result2 | #default=fallback}}
			const testValue = vals[0] ?? ''
			let defaultResult = ''
			for (let index = 1; index < args.length; index++) {
				const argument = args[index]
				if (argument.name) {
					if (argument.name.trim() === '#default') {
						defaultResult = argument.value
					} else if (argument.name.trim() === testValue) {
						return argument.value
					}
				}
			}
			return defaultResult
		}

		case '#ifexist':
			// Can't resolve client-side — return the "doesn't exist" branch
			return vals[2] ?? ''

		case '#expr': {
			// Basic math — only handle simple cases
			const source = (vals[0] ?? '').trim()
			if (!source) return '0'
			const result = evaluateExpression(source)
			return result === null ? 'Expression error' : String(result)
		}

		case 'lc':
		case 'lc:':
			return (vals[0] ?? '').toLowerCase()

		case 'uc':
		case 'uc:':
			return (vals[0] ?? '').toUpperCase()

		case 'lcfirst':
			return (vals[0] ?? '').replace(/^./, c => c.toLowerCase())

		case 'ucfirst':
			return (vals[0] ?? '').replace(/^./, c => c.toUpperCase())

		case '#titleparts': {
			// {{#titleparts: pagename | num | offset }}
			const parts = (vals[0] ?? '').split('/')
			const num = Number.parseInt(vals[1] ?? '0') || parts.length
			const offset = Number.parseInt(vals[2] ?? '0') || 0
			return parts.slice(offset, offset + num).join('/')
		}

		case '#len':
			return String((vals[0] ?? '').length)

		case '#pos':
			// {{#pos: string | target | offset}}
			return String((vals[0] ?? '').indexOf(vals[1] ?? '', Number.parseInt(vals[2] ?? '0') || 0))

		case '#sub':
			// {{#sub: string | start | length}}
			return (vals[0] ?? '').substring(
				Number.parseInt(vals[1] ?? '0') || 0,
				vals[2] ? (Number.parseInt(vals[1] ?? '0') || 0) + (Number.parseInt(vals[2]) || 0) : undefined,
			)

		case '#replace':
			// {{#replace: string | search | replace}}
			return (vals[0] ?? '').split(vals[1] ?? '').join(vals[2] ?? '')

		case '#pad': {
			// {{#pad: string | length | padchar | direction}}
			const string_ = vals[0] ?? ''
			const length_ = Number.parseInt(vals[1] ?? '0') || 0
			const padChar = vals[2] || '0'
			const dir = (vals[3] ?? 'left').toLowerCase()
			if (dir === 'right') return string_.padEnd(length_, padChar)
			return string_.padStart(length_, padChar)
		}

		default:
			return null
	}
}

/**
 * Recursive-descent evaluator for the arithmetic subset {{#expr:}} supports:
 * decimal numbers, `+ - * /`, unary sign, and parentheses. Deliberately not
 * `new Function` — that is an eval on page content, runs during SSR, and dies
 * under a strict CSP. Returns null on anything it can't parse.
 */
function evaluateExpression(source: string): number | null {
	let position = 0

	const skipSpace = () => {
		while (position < source.length && /\s/.test(source[position])) position++
	}

	const peek = (): string | undefined => {
		skipSpace()
		return source[position]
	}

	// primary := number | '(' expr ')'
	const parsePrimary = (): number | null => {
		const char = peek()
		if (char === undefined) return null
		if (char === '(') {
			position++
			const inner = parseSum()
			if (inner === null || peek() !== ')') return null
			position++
			return inner
		}
		const match = /^\d*\.?\d+/.exec(source.slice(position))
		if (!match) return null
		position += match[0].length
		return Number(match[0])
	}

	// factor := ('+' | '-') factor | primary
	const parseFactor = (): number | null => {
		const char = peek()
		if (char === '+' || char === '-') {
			position++
			const operand = parseFactor()
			return operand === null ? null : (char === '-' ? -operand : operand)
		}
		return parsePrimary()
	}

	// product := factor (('*' | '/') factor)*
	const parseProduct = (): number | null => {
		let left = parseFactor()
		if (left === null) return null
		for (;;) {
			const operator = peek()
			if (operator !== '*' && operator !== '/') return left
			position++
			const right = parseFactor()
			if (right === null) return null
			left = operator === '*' ? left * right : left / right
		}
	}

	// sum := product (('+' | '-') product)*
	function parseSum(): number | null {
		let left = parseProduct()
		if (left === null) return null
		for (;;) {
			const operator = peek()
			if (operator !== '+' && operator !== '-') return left
			position++
			const right = parseProduct()
			if (right === null) return null
			left = operator === '+' ? left + right : left - right
		}
	}

	const value = parseSum()
	// Trailing junk means the input wasn't a well-formed expression.
	if (value === null || peek() !== undefined) return null
	return Number.isNaN(value) ? null : value
}

export interface MagicWordContext {
	pageName: string
	namespace: string
	siteName?: string
	serverName?: string
	pageCount?: number
	categoryCount?: number
}
