/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow px units in Tailwind arbitrary values — use rem, em, or Tailwind scale values instead',
		},
		fixable: 'code',
		messages: {
			noPx: 'Avoid px in Tailwind arbitrary values (found "{{match}}"). Use rem, em, or a Tailwind scale value instead. Only 1-3px for borders/hairlines is acceptable.',
		},
		schema: [],
	},
	create(context) {
		// Match [Npx] where N > 2, e.g. [300px], [16px], [14px]
		// Allow [1px] and [2px] for borders/hairlines
		const PX_PATTERN = /\[(\d+)px]/g

		return {
			SvelteAttribute(node) {
				if (node.key?.name !== 'class') return
				checkValues(node)
			},
			// Also catch class={cn(...)} where cn args are string literals
			CallExpression(node) {
				if (node.callee.type !== 'Identifier' || node.callee.name !== 'cn') return
				for (const argument of node.arguments) {
					if (argument.type === 'Literal' && typeof argument.value === 'string') {
						checkString(argument, argument.value)
					}
				}
			},
		}

		function checkValues(node) {
			if (!node.value || !Array.isArray(node.value)) return
			for (const v of node.value) {
				if (v.type === 'SvelteLiteral' && typeof v.value === 'string') {
					checkString(v, v.value)
				}
			}
		}

		function pxToRem(px) {
			const rem = px / 16
			// Clean output: 0.25, 0.5, 1, 1.5, etc.
			return `${rem}rem`
		}

		function checkString(node, text) {
			let match
			PX_PATTERN.lastIndex = 0
			while ((match = PX_PATTERN.exec(text)) !== null) {
				const px = Number.parseInt(match[1], 10)
				if (px > 3) {
					const fixedText = text.replace(match[0], `[${pxToRem(px)}]`)
					context.report({
						node,
						messageId: 'noPx',
						data: { match: match[0] },
						fix(fixer) {
							if (node.type === 'SvelteLiteral') {
								// SvelteLiteral.range may or may not include surrounding quote chars.
								// Read the raw source to detect and preserve delimiters.
								const raw = context.sourceCode.getText(node)
								const firstChar = raw[0]
								const hasQuotes = firstChar === '"' || firstChar === `'`
								return hasQuotes
									? fixer.replaceText(node, `${firstChar}${fixedText}${firstChar}`)
									: fixer.replaceText(node, fixedText)
							}
							// For JS string literals, preserve quotes
							const raw = context.sourceCode.getText(node)
							const quote = raw[0]
							return fixer.replaceText(node, `${quote}${fixedText}${quote}`)
						},
					})
					// Only fix one at a time to avoid overlapping fixes
					break
				}
			}
		}
	},
}
