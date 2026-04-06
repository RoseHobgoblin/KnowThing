/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow console.log/error/warn in server files — use structured error responses instead',
		},
		messages: {
			noConsole: 'Use a structured error response instead of console.{{method}}().',
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const isServer = /\+server\.[jt]s$/.test(filename)
			|| /\+page\.server\.[jt]s$/.test(filename)
			|| /\+layout\.server\.[jt]s$/.test(filename)
			|| /src[/\\]lib[/\\]server[/\\]/.test(filename)
			|| /src[/\\]hooks\.server\.[jt]s$/.test(filename)

		if (!isServer) return {}

		return {
			MemberExpression(node) {
				if (node.object.type !== 'Identifier' || node.object.name !== 'console') return
				if (node.property.type !== 'Identifier') return

				const method = node.property.name
				if (!['log', 'error', 'warn', 'info', 'debug'].includes(method)) return

				context.report({
					node,
					messageId: 'noConsole',
					data: { method },
				})
			},
		}
	},
}
