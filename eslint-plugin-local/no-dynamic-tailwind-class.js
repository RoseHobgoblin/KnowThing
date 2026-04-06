/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow dynamically constructed Tailwind class names (e.g. `grid-cols-${n}`) — they get purged at build time',
		},
		messages: {
			noDynamic: 'Tailwind purges classes at build time by scanning for static strings. Template literal class names like `{{text}}` will be silently stripped. Use style: directives for dynamic values instead.',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== 'Identifier' || node.callee.name !== 'cn') return

				for (const argument of node.arguments) {
					checkTemplateLiteral(argument)
				}
			},
		}

		function checkTemplateLiteral(node) {
			if (!node) return

			// Direct template literal with expressions: `grid-cols-${n}`
			if (node.type === 'TemplateLiteral' && node.expressions.length > 0) {
				reportIfTailwindPattern(node)
				return
			}

			// Ternary: condition ? `class-${x}` : `class-${y}`
			if (node.type === 'ConditionalExpression') {
				checkTemplateLiteral(node.consequent)
				checkTemplateLiteral(node.alternate)
				return
			}

			// Logical: bool && `class-${x}`
			if (node.type === 'LogicalExpression') {
				checkTemplateLiteral(node.left)
				checkTemplateLiteral(node.right)
			}
		}

		function reportIfTailwindPattern(node) {
			const source = context.sourceCode.getText(node)

			// Match patterns that look like they're building Tailwind classes:
			// - word-prefix followed by ${expr}: `grid-cols-${n}`, `text-${color}`, `p-${size}`
			// - Or just ${expr} that could be a full class name
			// We flag any template literal with expressions inside cn() since
			// there's almost no valid reason to interpolate inside cn()
			context.report({
				node,
				messageId: 'noDynamic',
				data: { text: source },
			})
		}
	},
}
