/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer $derived.by(() => ...) over $derived((() => ...)())',
		},
		fixable: 'code',
		messages: {
			preferDerivedBy: 'Use $derived.by(() => ...) instead of $derived((() => ...)()).',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== 'Identifier' || node.callee.name !== '$derived') return
				if (node.arguments.length !== 1) return

				const argument = node.arguments[0]
				if (argument.type !== 'CallExpression') return
				if (argument.callee.type !== 'ArrowFunctionExpression' && argument.callee.type !== 'FunctionExpression') return
				if (argument.arguments.length > 0) return

				const innerFunction = argument.callee
				const source = context.sourceCode

				context.report({
					node,
					messageId: 'preferDerivedBy',
					fix(fixer) {
						const functionText = source.getText(innerFunction)
						return fixer.replaceText(node, `$derived.by(${functionText})`)
					},
				})
			},
		}
	},
}
