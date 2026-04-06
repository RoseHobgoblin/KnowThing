/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow `items = [...items, x]` on $state arrays — use .push() instead',
		},
		fixable: 'code',
		messages: {
			useArrayMutation: '$state arrays are reactive proxies — use .push() instead of spreading into a new array.',
		},
		schema: [],
	},
	create(context) {
		const stateVariables = new Set()

		return {
			// Track variables declared with $state
			VariableDeclarator(node) {
				if (!node.init) return
				if (node.init.type !== 'CallExpression') return
				if (node.init.callee.type !== 'Identifier' || node.init.callee.name !== '$state') return
				// Check the $state arg is an array
				if (node.init.arguments.length === 0) return
				const argument = node.init.arguments[0]
				if (argument.type !== 'ArrayExpression') return

				if (node.id.type === 'Identifier') {
					stateVariables.add(node.id.name)
				}
			},

			// Detect: x = [...x, item] or x = [...x]
			AssignmentExpression(node) {
				if (node.operator !== '=') return
				if (node.left.type !== 'Identifier') return
				if (!stateVariables.has(node.left.name)) return
				if (node.right.type !== 'ArrayExpression') return

				const name = node.left.name
				const elements = node.right.elements

				const spreadIndex = elements.findIndex(
					element => element?.type === 'SpreadElement'
						&& element.argument.type === 'Identifier'
						&& element.argument.name === name,
				)

				if (spreadIndex !== -1) {
					// Only autofix the append pattern: [...items, x, y]
					// where spread is first and there are additional elements after it
					const isAppend = spreadIndex === 0 && elements.length > 1
					const newItems = isAppend
						? elements.slice(1).filter(Boolean)
						: null

					context.report({
						node,
						messageId: 'useArrayMutation',
						fix: isAppend
							? (fixer) => {
								const source = context.sourceCode
								const arguments_ = newItems.map(element => source.getText(element)).join(', ')
								return fixer.replaceText(node, `${name}.push(${arguments_})`)
							}
							: undefined,
					})
				}
			},
		}
	},
}
