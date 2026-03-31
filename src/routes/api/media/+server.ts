import { isHttpError, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentMediaUsage, media } from '$lib/server/db/schema.js'
import { requireEditorUser } from '$lib/server/auth.js'
import { uploadMediaFile } from '$lib/server/services/media.js'

/** GET /api/media — list media with search, filter, pagination */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const category = url.searchParams.get('category')?.trim()
	const sort = url.searchParams.get('sort') || 'newest'
	const unused = url.searchParams.get('unused') === 'true'
	const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50'), 200)
	const offset = Number.parseInt(url.searchParams.get('offset') || '0')

	const usageCounts = db
		.select({
			filename: contentMediaUsage.filename,
			count: sql<number>`count(*)::int`.as('count'),
		})
		.from(contentMediaUsage)
		.groupBy(contentMediaUsage.filename)
		.as('usage_counts')

	const conditions = []

	if (q) {
		conditions.push(
			sql`(${media.filename} ILIKE ${`%${q}%`} OR search_vector @@ websearch_to_tsquery('english', ${q}))`,
		)
	}
	if (category) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM media_categories mc WHERE mc.filename = ${media.filename} AND mc.category = ${category})`,
		)
	}
	if (unused) {
		conditions.push(
			sql`NOT EXISTS (SELECT 1 FROM content_media_usage cmu WHERE cmu.filename = ${media.filename})`,
		)
	}

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
			usageCount: sql<number>`COALESCE(${usageCounts.count}, 0)`.as('usage_count'),
		})
		.from(media)
		.leftJoin(usageCounts, eq(media.filename, usageCounts.filename))
		.$dynamic()

	if (conditions.length > 0) {
		query = query.where(and(...conditions))
	}

	switch (sort) {
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

	const files = await query.limit(limit).offset(offset)
	const [{ count }] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(media)
		.where(conditions.length > 0 ? and(...conditions) : undefined)

	return json({ files, total: Number(count) })
}

/** POST /api/media — upload file with processing */
export const POST: RequestHandler = async (event) => {
	const user = requireEditorUser(event)
	const formData = await event.request.formData()
	const file = formData.get('file')

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 })
	}

	try {
		return json(await uploadMediaFile(user.id, file), { status: 201 })
	} catch (err: unknown) {
		if (isHttpError(err)) {
			return json({ error: err.body?.message ?? 'Request failed' }, { status: err.status })
		}
		throw err
	}
}
