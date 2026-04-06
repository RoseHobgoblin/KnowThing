/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow cn() calls where all arguments are static string literals',
		},
		fixable: 'code',
		messages: {
			staticOnly: 'All arguments to cn() are static strings — use a plain class string instead.',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== 'Identifier' || node.callee.name !== 'cn') return
				if (node.arguments.length === 0) return
				if (!node.arguments.every(argument => argument.type === 'Literal' && typeof argument.value === 'string')) return

				const combined = node.arguments.map(argument => argument.value).join(' ')

				context.report({
					node,
					messageId: 'staticOnly',
					fix(fixer) {
						return fixer.replaceText(node, `'${combined}'`)
					},
				})
			},
		}
	},
}
