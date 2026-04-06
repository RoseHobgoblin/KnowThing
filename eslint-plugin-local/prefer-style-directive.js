const PASCAL_CASE_RE = /^[A-Z]/

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer style: directives over style="" with interpolated expressions in Svelte',
		},
		messages: {
			preferDirective: 'Use individual style: directives (e.g. style:gap, style:transform) instead of a style attribute with embedded expressions.',
		},
		schema: [],
	},
	create(context) {
		return {
			SvelteAttribute(node) {
				if (node.key?.name !== 'style') return
				if (!node.value || !Array.isArray(node.value)) return

				const hasExpression = node.value.some(v => v.type === 'SvelteMustacheTag')
				if (!hasExpression) return

				// Skip Svelte components — they don't support style: directives.
				// Components are identified by PascalCase names or dotted names (e.g. Dialog.Content).
				const parent = node.parent
				if (!parent?.name) return
				// SvelteElement name can be Identifier (name.name) or SvelteMemberExpressionName (name.type)
				const nameNode = parent.name
				if (nameNode.type === 'SvelteMemberExpressionName') return
				const tagName = nameNode.name ?? nameNode.rawName ?? ''
				if (PASCAL_CASE_RE.test(tagName)) return

				context.report({
					node,
					messageId: 'preferDirective',
				})
			},
		}
	},
}
