/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Discourage Svelte $effect usage',
		},
		messages: {
			noEffect: 'Avoid $effect. Prefer $derived for reactive values and event handlers or lifecycle APIs for imperative work.',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				const { callee } = node
				const isDirectEffect = callee.type === 'Identifier' && callee.name === '$effect'
				const isEffectMember = callee.type === 'MemberExpression'
					&& callee.object.type === 'Identifier'
					&& callee.object.name === '$effect'

				if (!isDirectEffect && !isEffectMember) return

				context.report({
					node: callee,
					messageId: 'noEffect',
				})
			},
		}
	},
}
