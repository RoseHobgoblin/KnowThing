import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { media, mediaHistory, contentMediaUsage } from '$lib/server/db/schema.js'
import { desc, sql, eq, asc } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { env } from '$env/dynamic/private'
import sharp from 'sharp'

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const MAX_UPLOAD_SIZE = Number.parseInt(env.MAX_UPLOAD_SIZE || '10485760') // 10MB default
const THUMB_SIZES = [150, 300, 600] as const

/** GET /api/media — list media with search, filter, pagination */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const category = url.searchParams.get('category')
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

	if (q) {
		query = query.where(sql`search_vector @@ plainto_tsquery('english', ${q}) OR ${media.filename} ILIKE ${'%' + q + '%'}`)
	}

	if (unused) {
		query = query.where(sql`NOT EXISTS (SELECT 1 FROM content_media_usage WHERE filename = ${media.filename})`)
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

	const result = await query.limit(limit).offset(offset)

	// Get total count for pagination
	const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(media)

	return json({ files: result, total: Number(count) })
}

/** POST /api/media — upload file with processing */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	const formData = await event.request.formData()
	const file = formData.get('file')

	if (!file || !(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 })
	}

	if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
		return json({ error: `Unsupported file type: ${file.type}. Allowed: image/* or application/pdf` }, { status: 400 })
	}

	// Size limit
	const buffer = Buffer.from(await file.arrayBuffer())
	if (buffer.length > MAX_UPLOAD_SIZE) {
		return json({ error: `File too large (${(buffer.length / 1048576).toFixed(1)}MB). Maximum: ${(MAX_UPLOAD_SIZE / 1048576).toFixed(0)}MB` }, { status: 400 })
	}

	// Compute hash for duplicate detection
	const hash = createHash('sha256').update(buffer).digest('hex')

	// Check for duplicates
	const [existing] = await db.select({ filename: media.filename }).from(media).where(eq(media.hash, hash))
	if (existing) {
		return json({
			error: `Duplicate file — already uploaded as "${existing.filename}"`,
			existingFilename: existing.filename,
		}, { status: 409 })
	}

	const originalFilename = file.name
	const filename = file.name.replaceAll(/[^\p{L}\p{N}_.-]/gu, '_')

	// Ensure directories exist
	await mkdir(UPLOAD_DIR, { recursive: true })
	await mkdir(THUMB_DIR, { recursive: true })

	const filepath = join(UPLOAD_DIR, filename)
	await writeFile(filepath, buffer)

	// Extract dimensions and generate thumbnails
	let width: number | null = null
	let height: number | null = null
	let hasThumb150 = false
	let hasThumb300 = false
	let hasThumb600 = false

	const isSvg = file.type === 'image/svg+xml'

	if (!isSvg) {
		try {
			const image = sharp(buffer)
			const metadata = await image.metadata()
			width = metadata.width || null
			height = metadata.height || null

			// Generate thumbnails for sizes smaller than original
			if (width) {
				for (const size of THUMB_SIZES) {
					if (width > size) {
						const thumbPath = join(THUMB_DIR, `${size}_${filename}`)
						await image
							.clone()
							.resize(size, undefined, { withoutEnlargement: true })
							.toFile(thumbPath)

						if (size === 150) hasThumb150 = true
						if (size === 300) hasThumb300 = true
						if (size === 600) hasThumb600 = true
					}
				}
			}
		} catch (error) {
			// Sharp failed — store without dimensions/thumbs
			console.error('Image processing failed:', error)
		}
	}

	// Check if this is a reupload
	const [existingFile] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename))
	const isReupload = !!existingFile

	const [record] = await db
		.insert(media)
		.values({
			filename,
			filepath,
			mimeType: file.type,
			sizeBytes: buffer.length,
			width,
			height,
			hash,
			description: null,
			uploadedBy: user.id,
			originalFilename,
			hasThumb150,
			hasThumb300,
			hasThumb600,
		})
		.onConflictDoUpdate({
			target: media.filename,
			set: {
				filepath,
				mimeType: file.type,
				sizeBytes: buffer.length,
				width,
				height,
				hash,
				uploadedBy: user.id,
				originalFilename,
				hasThumb150,
				hasThumb300,
				hasThumb600,
				uploadedAt: new Date(),
			},
		})
		.returning()

	// Log history
	await db.insert(mediaHistory).values({
		filename,
		userId: user.id,
		action: isReupload ? 'reupload' : 'upload',
		details: `${file.type}, ${(buffer.length / 1024).toFixed(0)}KB${width ? `, ${width}×${height}` : ''}`,
	})

	return json(record, { status: 201 })
}
