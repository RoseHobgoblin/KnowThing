import { z } from 'zod'
import type { UnifiedSearchFilters, UnifiedSearchParams, UnifiedSearchScope, UnifiedSearchSort } from './types.js'

const searchScopeSchema = z.enum(['all', 'pages', 'wordbook', 'media'])
const searchSortSchema = z.enum(['relevance', 'newest', 'oldest', 'name', 'size', 'usage'])

export function parseUnifiedSearchParams(url: URL, defaults?: Partial<UnifiedSearchParams>): UnifiedSearchParams {
	const parsed = createUnifiedSearchQuerySchema(defaults).parse({
		q: url.searchParams.get('q'),
		scope: url.searchParams.get('scope'),
		sort: url.searchParams.get('sort'),
		limit: url.searchParams.get('limit'),
		page: url.searchParams.get('page'),
		offset: url.searchParams.get('offset'),
		language: url.searchParams.get('language'),
		tag: url.searchParams.get('tag'),
		pos: url.searchParams.get('pos'),
		mediaCategory: url.searchParams.get('mediaCategory') ?? url.searchParams.get('category'),
		unused: url.searchParams.get('unused'),
	})

	const offset = parsed.offset ?? (parsed.page - 1) * parsed.limit

	const filters: UnifiedSearchFilters = {
		language: parsed.language,
		tag: parsed.tag,
		pos: parsed.pos,
		mediaCategory: parsed.mediaCategory,
		unused: parsed.unused,
		sort: parsed.sort,
	}

	return {
		q: parsed.q,
		scope: parsed.scope,
		filters,
		limit: parsed.limit,
		offset,
	}
}

function normalizeString(value: string | null | undefined) {
	const trimmed = value?.trim()
	return trimmed ? trimmed : undefined
}

function clampInt(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

function createUnifiedSearchQuerySchema(defaults?: Partial<UnifiedSearchParams>) {
	const defaultScope: UnifiedSearchScope = defaults?.scope ?? 'all'
	const defaultLimit = defaults?.limit ?? 20
	const defaultQ = defaults?.q ?? ''
	const defaultSort = defaults?.filters?.sort

	const optionalStringSchema = z.preprocess(
		value => normalizeString(typeof value === 'string' ? value : undefined),
		z.string().min(1).optional(),
	)

	return z.object({
		q: z.preprocess(
			value => typeof value === 'string' ? value.trim() : defaultQ,
			z.string().catch(defaultQ).transform(value => normalizeString(value) ?? defaultQ),
		),
		scope: z.preprocess(
			value => typeof value === 'string' ? value.trim() : defaultScope,
			searchScopeSchema.catch(defaultScope),
		),
		sort: z.preprocess(
			value => value == null ? defaultSort : (typeof value === 'string' ? value.trim() : value),
			searchSortSchema.optional().catch(defaultSort),
		),
		limit: z.preprocess(
			value => value ?? defaultLimit,
			z.coerce.number().int().catch(defaultLimit).transform(value => clampInt(value, 1, 100)),
		),
		page: z.preprocess(
			value => value ?? 1,
			z.coerce.number().int().catch(1).transform(value => clampInt(value, 1, 1000)),
		),
		offset: z.preprocess(
			value => value == null ? undefined : value,
			z.coerce.number().int().optional().catch(undefined).transform(value => value == null ? undefined : clampInt(value, 0, 10_000)),
		),
		language: optionalStringSchema,
		tag: optionalStringSchema,
		pos: optionalStringSchema,
		mediaCategory: optionalStringSchema,
		unused: z.preprocess(value => value === 'true', z.boolean()),
	})
}
