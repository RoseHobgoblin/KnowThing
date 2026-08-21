import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { media, mediaAssetBindings, mediaCategories } from '$lib/feature/media/server/schema.server.js'
import { contentMediaUsage } from '$lib/server/db/core-schema.js'
import type { UnifiedSearchFilters, UnifiedSearchResult } from '$lib/feature/search/public/search-contracts.js'
import type { SearchProvider } from '$lib/feature/search/public/search-contracts.js'

export interface MediaSearchParams {
	q?: string
	category?: string
	sort?: UnifiedSearchFilters['sort']
	unused?: boolean
	imageOnly?: boolean
	aspectRatio?: number
	limit: number
	offset: number
}

export interface MediaListItem {
	id: number
	filename: string
	mimeType: string | null
	width: number | null
	height: number | null
	sizeBytes: number | null
	description: string | null
	hash: string | null
	hasThumb150: boolean | null
	hasThumb300: boolean | null
	hasThumb600: boolean | null
	uploadedAt: Date
	usageCount: number
}

export async function listMediaCategoryOptions() {
	const rows = await db.selectDistinct({ category: mediaCategories.category }).from(mediaCategories).orderBy(asc(mediaCategories.category))
	return rows.map(row => row.category)
}

export const mediaSearchProvider: SearchProvider = {
	scope: 'media',
	async search(query) {
		const response = await searchMediaUnified({
			q: query.q, category: query.filters.mediaCategory, unused: query.filters.unused,
			sort: query.filters.sort ?? (query.scope === 'media' ? 'newest' : 'relevance'),
			limit: query.limit, offset: query.offset,
		})
		return response.results
	},
	async count(query) {
		const response = await searchMediaUnified({
			q: query.q, category: query.filters.mediaCategory, unused: query.filters.unused,
			sort: query.filters.sort ?? 'relevance', limit: 1, offset: 0,
		})
		return response.total
	},
}

export async function listMedia(params: MediaSearchParams): Promise<{ files: MediaListItem[], total: number }> {
	const usageCounts = db
		.select({
			filename: contentMediaUsage.filename,
			count: sql<number>`count(*)::int`.as('count'),
		})
		.from(contentMediaUsage)
		.groupBy(contentMediaUsage.filename)
		.as('usage_counts')
	const assetUsageCounts = db
		.select({
			mediaId: mediaAssetBindings.mediaId,
			count: sql<number>`count(*)::int`.as('count'),
		})
		.from(mediaAssetBindings)
		.groupBy(mediaAssetBindings.mediaId)
		.as('asset_usage_counts')

	const conditions = buildMediaConditions(params)

	let query = db
		.select({
			id: media.id,
			filename: media.filename,
			mimeType: media.mimeType,
			width: media.width,
			height: media.height,
			sizeBytes: media.sizeBytes,
			description: media.description,
			hash: media.hash,
			hasThumb150: media.hasThumb150,
			hasThumb300: media.hasThumb300,
			hasThumb600: media.hasThumb600,
			uploadedAt: media.uploadedAt,
			usageCount: sql<number>`COALESCE(${usageCounts.count}, 0) + COALESCE(${assetUsageCounts.count}, 0)`.as('usage_count'),
		})
		.from(media)
		.leftJoin(usageCounts, eq(media.filename, usageCounts.filename))
		.leftJoin(assetUsageCounts, eq(media.id, assetUsageCounts.mediaId))
		.$dynamic()

	if (conditions.length > 0) {
		query = query.where(and(...conditions))
	}

	switch (params.sort) {
		case 'oldest':
			query = query.orderBy(asc(media.uploadedAt))
			break
		case 'name':
			query = query.orderBy(asc(media.filename))
			break
		case 'size':
			query = query.orderBy(desc(media.sizeBytes))
			break
		case 'usage':
			query = query.orderBy(sql`usage_count DESC`)
			break
		default:
			query = query.orderBy(desc(media.uploadedAt))
	}

	const files = await query.limit(params.limit).offset(params.offset)
	const [{ count }] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(media)
		.where(conditions.length > 0 ? and(...conditions) : undefined)

	return { files, total: Number(count) }
}

export async function searchMediaUnified(params: MediaSearchParams): Promise<{
	results: UnifiedSearchResult[]
	total: number
}> {
	const { files, total } = await listMedia(params)

	return {
		results: files.map(file => ({
			kind: 'media',
			title: file.filename,
			href: `/media/${encodeURIComponent(file.filename)}`,
			badge: 'Media',
			snippet: file.description ?? '',
			meta: [
				file.mimeType ?? 'Unknown type',
				file.usageCount === 1 ? 'Used on 1 page' : `Used on ${file.usageCount} pages`,
			],
			rank: computeMediaRank(file, params.q),
			thumbnailUrl: file.mimeType?.startsWith('image/') ? `/api/media/${encodeURIComponent(file.filename)}?w=150` : undefined,
		})),
		total,
	}
}

function buildMediaConditions(params: MediaSearchParams) {
	const conditions = []

	if (params.q) {
		conditions.push(
			sql`(${media.filename} ILIKE ${`%${params.q}%`} OR search_vector @@ websearch_to_tsquery('english', ${params.q}))`,
		)
	}
	if (params.category) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM media_categories mc WHERE mc.filename = ${media.filename} AND mc.category = ${params.category})`,
		)
	}
	if (params.unused) {
		conditions.push(
			sql`
				NOT EXISTS (SELECT 1 FROM content_media_usage cmu WHERE cmu.filename = ${media.filename})
				AND NOT EXISTS (SELECT 1 FROM media_asset_bindings mab WHERE mab.media_id = ${media.id})
			`,
		)
	}
	if (params.imageOnly) {
		conditions.push(sql`${media.mimeType} LIKE 'image/%'`)
	}
	if (params.aspectRatio && Number.isFinite(params.aspectRatio)) {
		// A small tolerance permits plates whose metadata was rounded during export.
		conditions.push(
			sql`${media.width} IS NOT NULL AND ${media.height} IS NOT NULL AND ${media.height} > 0`,
			sql`ABS((${media.width}::double precision / ${media.height}) - ${params.aspectRatio}) <= 0.04`,
			sql`${media.hash} IS NOT NULL`,
		)
	}

	return conditions
}

function computeMediaRank(file: MediaListItem, query?: string) {
	if (!query) return 1

	const normalizedQuery = query.toLowerCase()
	const normalizedFilename = file.filename.toLowerCase()
	const normalizedDescription = file.description?.toLowerCase() ?? ''

	if (normalizedFilename === normalizedQuery) return 5
	if (normalizedFilename.startsWith(normalizedQuery)) return 4
	if (normalizedFilename.includes(normalizedQuery)) return 3
	if (normalizedDescription.includes(normalizedQuery)) return 2
	return 1
}
