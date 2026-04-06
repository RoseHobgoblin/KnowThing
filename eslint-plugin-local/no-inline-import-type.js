/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow inline import() in type positions — use top-level import type instead',
		},
		messages: {
			noInlineImport: 'Use a top-level `import type { {{name}} } from \'{{source}}\'` instead of inline import().',
		},
		schema: [],
	},
	create(context) {
		return {
			TSImportType(node) {
				const source = node.argument?.value ?? node.argument?.literal?.value ?? ''
				const qualifier = node.qualifier?.name ?? node.qualifier?.right?.name ?? 'Type'

				context.report({
					node,
					messageId: 'noInlineImport',
					data: {
						name: qualifier,
						source,
					},
				})
			},
		}
	},
}
