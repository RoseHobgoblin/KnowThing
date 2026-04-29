/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow direct db/schema imports from src/routes/** — route handlers should call services in $lib/server/services/ instead',
		},
		messages: {
			noDbImport: 'Route handlers must not import from $lib/server/db/.... Move the query into a service module under $lib/server/services/ and call it from the handler.',
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const isRoute = /src[/\\]routes[/\\]/.test(filename)
		if (!isRoute) return {}

		return {
			ImportDeclaration(node) {
				const source = typeof node.source.value === 'string' ? node.source.value : ''
				if (source.startsWith('$lib/server/db/') || source === '$lib/server/db') {
					context.report({ node, messageId: 'noDbImport' })
				}
			},
		}
	},
}
