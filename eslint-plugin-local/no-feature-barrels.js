/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: { description: 'Disallow feature barrels and forwarding modules' },
		messages: {
			index: 'Feature index files are prohibited; import a named capability module directly.',
			exportAll: 'Wildcard exports are prohibited in feature modules.',
			forwarder: 'Re-export-only feature modules are prohibited; public modules must contain a concrete capability.',
		},
		schema: [],
	},
	create(context) {
		const filename = (context.filename ?? context.getFilename()).replaceAll('\\', '/')
		if (!filename.includes('/src/lib/feature/')) return {}
		const basename = filename.slice(filename.lastIndexOf('/') + 1)
		return {
			Program(node) {
				if (/^index(?:\.server)?\.[jt]s$/.test(basename)) {
					context.report({ node, messageId: 'index' })
				}
				const executable = node.body.filter(statement => statement.type !== 'ImportDeclaration')
				const sourcedExports = executable.filter(statement => (
					statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration'
				) && statement.source)
				if (executable.length > 0 && executable.length === sourcedExports.length) {
					context.report({ node, messageId: 'forwarder' })
				}
			},
			ExportAllDeclaration(node) {
				context.report({ node, messageId: 'exportAll' })
			},
		}
	},
}
