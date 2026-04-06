/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer cn() over string concatenation in class attributes with dynamic expressions',
		},
		messages: {
			useCn: 'Use cn() instead of string concatenation in class attributes.',
		},
		schema: [],
	},
	create(context) {
		return {
			SvelteAttribute(node) {
				if (node.key?.name !== 'class') return
				if (!node.value) return

				// node.value is an array of text chunks and expression chunks
				// If there's only one element and it's a literal string, skip (fully static)
				// If there's any expression chunk mixed with static text, flag it
				const values = node.value
				if (!Array.isArray(values)) return

				const hasExpression = values.some(v => v.type === 'SvelteMustacheTag')
				const hasStatic = values.some(v => v.type === 'SvelteLiteral' && v.value.trim() !== '')

				if (hasExpression && hasStatic) {
					context.report({
						node,
						messageId: 'useCn',
					})
				}
			},
		}
	},
}
