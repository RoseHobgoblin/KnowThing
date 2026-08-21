/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: { description: 'Enforce direct feature capability boundaries' },
		messages: {
			privateFeature: 'Import feature capabilities through $lib/feature/{{feature}}/public/...',
			sharedFeature: 'Shared platform code must not import feature modules; wire this dependency in composition code.',
			frameworkDomain: 'Feature domain and application modules must not import SvelteKit or Drizzle.',
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename ?? context.getFilename()
		const normalized = filename.replaceAll('\\', '/')
		const sourceFeature = normalized.match(/\/src\/lib\/feature\/([^/]+)\//)?.[1]
		const isRoute = normalized.includes('/src/routes/')
		const isComposition = normalized.includes('/src/lib/composition/')
		const isSharedPlatform = /\/src\/lib\/(?:parser|renderer|templates|infoboxes|server|utils|components)\//.test(normalized)
		const isFeatureCore = /\/src\/lib\/feature\/[^/]+\/(?:domain|application)\//.test(normalized)

		return {
			ImportDeclaration(node) {
				const source = typeof node.source.value === 'string' ? node.source.value : ''
				if (isFeatureCore && (
					source === '@sveltejs/kit'
					|| source === 'drizzle-orm'
					|| source.startsWith('drizzle-orm/')
					|| source.startsWith('$lib/server/db/')
				)) {
					context.report({ node, messageId: 'frameworkDomain' })
				}

				const target = source.match(/^\$lib\/feature\/([^/]+)\/(.+)$/)
				if (!target || isComposition) return
				const [, targetFeature, targetPath] = target
				if (isSharedPlatform) {
					context.report({ node, messageId: 'sharedFeature' })
					return
				}
				if ((isRoute || (sourceFeature && sourceFeature !== targetFeature)) && !targetPath.startsWith('public/')) {
					context.report({ node, messageId: 'privateFeature', data: { feature: targetFeature } })
				}
			},
		}
	},
}
