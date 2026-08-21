import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { categories, contentRecords } from '$lib/server/db/core-schema.js'
import type { NamespaceKey } from '$lib/namespaces/registry.js'
import {
	buildNamespaceHref as namespaceHref,
	createNamespaceProviders,
	missingNamespaceTarget,
	resolveNamespace,
	type NamespaceProvider,
	type ResolvedTarget,
} from '$lib/namespaces/providers.js'
import type { WordbookPath } from '$lib/parser/wordbook-path.js'
import { calendarNamespaceProvider } from '$lib/feature/calendar/public/server/namespace-provider.server.js'
import { rodderNamespaceProvider } from '$lib/feature/rodder/public/server/namespace-provider.server.js'
import { resolveWordbookPathTarget } from '$lib/feature/wordbook/public/server/namespace-provider.server.js'
import {
	countryNamespaceProvider,
	mapNamespaceProvider,
} from '$lib/feature/worldmap/public/server/namespace-providers.server.js'

export type { ResolvedTarget } from '$lib/namespaces/providers.js'

const categoryNamespaceProvider: NamespaceProvider = {
	namespace: 'Category',
	async resolve(identifier) {
		const [category] = await db
			.select({ id: categories.id, slug: categories.slug, title: categories.title })
			.from(categories)
			.where(sql`LOWER(${categories.slug}) = ${identifier.toLowerCase()}`)
			.limit(1)
		return category
			? { kind: 'category', href: namespaceHref('Category', category.slug), title: category.title, exists: true, entityId: category.id }
			: missingNamespaceTarget('Category', identifier)
	},
}

const templateNamespaceProvider: NamespaceProvider = {
	namespace: 'Template',
	async resolve(identifier) {
		const [record] = await db
			.select({ id: contentRecords.id })
			.from(contentRecords)
			.where(and(
				eq(contentRecords.domain, 'know'),
				sql`LOWER(${contentRecords.slug}) = ${`template:${identifier.toLowerCase()}`}`,
			))
			.limit(1)
		return {
			kind: record ? 'know' : null,
			href: `/know/Template:${encodeURIComponent(identifier)}`,
			title: `Template:${identifier}`,
			exists: !!record,
			entityId: record?.id,
		}
	},
}

export const NAMESPACE_PROVIDERS = createNamespaceProviders([
	rodderNamespaceProvider,
	calendarNamespaceProvider,
	categoryNamespaceProvider,
	countryNamespaceProvider,
	mapNamespaceProvider,
	templateNamespaceProvider,
])

export function buildNamespaceHref(namespace: NamespaceKey, identifier: string): string {
	return namespaceHref(namespace, identifier)
}

export type ResolverCache = Map<string, ResolvedTarget>

function cacheKey(kind: string, identifier: string): string {
	return `${kind}:${identifier.toLowerCase()}`
}

export async function resolveNamespaceTarget(
	namespace: NamespaceKey,
	identifier: string,
	cache: ResolverCache = new Map(),
): Promise<ResolvedTarget> {
	const key = cacheKey(namespace, identifier)
	const cached = cache.get(key)
	if (cached) return cached
	const resolved = await resolveNamespace(NAMESPACE_PROVIDERS, namespace, identifier)
		?? missingNamespaceTarget(namespace, identifier)
	cache.set(key, resolved)
	return resolved
}

export async function resolveWordbookPath(
	path: WordbookPath,
	cache: ResolverCache = new Map(),
): Promise<ResolvedTarget> {
	const identifier = path.word ? `${path.language}/${path.word}` : path.language
	const key = cacheKey('wordbook', identifier)
	const cached = cache.get(key)
	if (cached) return cached
	let result: ResolvedTarget
	try {
		result = await resolveWordbookPathTarget(path)
	} catch {
		result = {
			kind: null,
			href: path.word
				? `/Wordbook/${encodeURIComponent(path.language)}/${encodeURIComponent(path.word)}`
				: `/Wordbook/${encodeURIComponent(path.language)}`,
			title: path.word ? `${path.word} (${path.language})` : path.language,
			exists: false,
		}
	}
	cache.set(key, result)
	return result
}
