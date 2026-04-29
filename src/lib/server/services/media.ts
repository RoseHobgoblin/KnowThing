import { error } from '@sveltejs/kit'
import { createHash } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { desc, eq } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db/index.js'
import {
	contentMediaUsage,
	contentRecords,
	media,
	mediaCategories,
	mediaHistory,
	users,
} from '$lib/server/db/schema.js'

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const RASTER_DIR = join(UPLOAD_DIR, 'rasters')
const MAX_UPLOAD_SIZE = Number.parseInt(env.MAX_UPLOAD_SIZE || '10485760')
const THUMB_SIZES = [150, 300, 600] as const
const RASTER_WIDTH = 1200

function normalizeCategories(categories?: string[]) {
	if (!categories) return undefined

	return categories
		.map(category => category.trim())
		.filter((category, index, all) => category && all.indexOf(category) === index)
}

async function getMediaRecord(filename: string) {
	const [record] = await db.select().from(media).where(eq(media.filename, filename)).limit(1)
	return record ?? null
}

export async function findMediaRecord(filename: string) {
	return getMediaRecord(filename)
}

export async function getMediaDetail(filename: string) {
	const [file] = await db
		.select({
			id: media.id,
			filename: media.filename,
			filepath: media.filepath,
			mimeType: media.mimeType,
			width: media.width,
			height: media.height,
			sizeBytes: media.sizeBytes,
			hash: media.hash,
			description: media.description,
			uploadedBy: media.uploadedBy,
			originalFilename: media.originalFilename,
			hasThumb150: media.hasThumb150,
			hasThumb300: media.hasThumb300,
			hasThumb600: media.hasThumb600,
			uploadedAt: media.uploadedAt,
		})
		.from(media)
		.where(eq(media.filename, filename))

	if (!file) throw error(404, 'File not found')

	let uploaderName: string | null = null
	if (file.uploadedBy) {
		const [uploader] = await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, file.uploadedBy))
		uploaderName = uploader?.username || null
	}

	const categories = await db
		.select({ category: mediaCategories.category })
		.from(mediaCategories)
		.where(eq(mediaCategories.filename, filename))

	const usage = await db
		.select({ pageSlug: contentRecords.slug })
		.from(contentMediaUsage)
		.innerJoin(contentRecords, eq(contentMediaUsage.contentRecordId, contentRecords.id))
		.where(eq(contentMediaUsage.filename, filename))

	const history = await db
		.select({
			id: mediaHistory.id,
			action: mediaHistory.action,
			details: mediaHistory.details,
			createdAt: mediaHistory.createdAt,
			username: users.username,
		})
		.from(mediaHistory)
		.leftJoin(users, eq(mediaHistory.userId, users.id))
		.where(eq(mediaHistory.filename, filename))
		.orderBy(desc(mediaHistory.createdAt))
		.limit(50)

	return {
		file,
		uploaderName,
		categories: categories.map(c => c.category),
		usage: usage.map(u => u.pageSlug),
		history,
	}
}

export async function uploadMediaFile(userId: number, file: File) {
	if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
		throw error(400, `Unsupported file type: ${file.type}. Allowed: image/* or application/pdf`)
	}

	const buffer = Buffer.from(await file.arrayBuffer())
	if (buffer.length > MAX_UPLOAD_SIZE) {
		throw error(
			400,
			`File too large (${(buffer.length / 1048576).toFixed(1)}MB). Maximum: ${(MAX_UPLOAD_SIZE / 1048576).toFixed(0)}MB`,
		)
	}

	const hash = createHash('sha256').update(buffer).digest('hex')
	const [existingHash] = await db.select({ filename: media.filename }).from(media).where(eq(media.hash, hash))

	if (existingHash) {
		throw error(409, `Duplicate file already uploaded as "${existingHash.filename}"`)
	}

	const originalFilename = file.name
	const filename = file.name.replaceAll(/[^\p{L}\p{N}_.-]/gu, '_')
	const existingFile = await getMediaRecord(filename)
	if (existingFile) {
		throw error(
			409,
			`A file stored as "${filename}" already exists after filename normalization. Rename the file and upload again.`,
		)
	}

	await mkdir(UPLOAD_DIR, { recursive: true })
	await mkdir(THUMB_DIR, { recursive: true })

	const filepath = join(UPLOAD_DIR, filename)
	await writeFile(filepath, buffer)

	let width: number | null = null
	let height: number | null = null
	let hasThumb150 = false
	let hasThumb300 = false
	let hasThumb600 = false
	let hasRaster = false

	if (file.type === 'image/svg+xml') {
		try {
			await mkdir(RASTER_DIR, { recursive: true })
			await sharp(buffer, { density: 192 })
				.resize(RASTER_WIDTH, undefined, { withoutEnlargement: false })
				.png()
				.toFile(join(RASTER_DIR, `${filename}.png`))
			hasRaster = true
		} catch (cause) {
			// SVG may reference external fonts/assets sharp can't resolve — article
			// keeps the crisp SVG, share cards just won't have an image for this one.
			console.error('SVG rasterization failed:', cause)
		}
	} else {
		try {
			const image = sharp(buffer)
			const metadata = await image.metadata()
			width = metadata.width || null
			height = metadata.height || null

			if (width) {
				for (const size of THUMB_SIZES) {
					if (width <= size) continue

					await image
						.clone()
						.resize(size, undefined, { withoutEnlargement: true })
						.toFile(join(THUMB_DIR, `${size}_${filename}`))

					if (size === 150) hasThumb150 = true
					if (size === 300) hasThumb300 = true
					if (size === 600) hasThumb600 = true
				}
			}
		} catch (cause) {
			console.error('Image processing failed:', cause)
		}
	}

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
			uploadedBy: userId,
			originalFilename,
			hasThumb150,
			hasThumb300,
			hasThumb600,
			hasRaster,
		})
		.returning()

	await db.insert(mediaHistory).values({
		filename,
		userId,
		action: 'upload',
		details: `${file.type}, ${(buffer.length / 1024).toFixed(0)}KB${width ? `, ${width}x${height}` : ''}`,
	})

	return record
}

export async function updateMediaMetadata(
	userId: number,
	filename: string,
	updates: { description?: string, categories?: string[] },
) {
	const record = await getMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	await db.transaction(async (tx) => {
		if (updates.description !== undefined) {
			const description = updates.description.trim() || null

			await tx.update(media).set({ description }).where(eq(media.filename, filename))
			await tx.insert(mediaHistory).values({
				filename,
				userId,
				action: 'describe',
				details: description || '(cleared)',
			})
		}

		if (updates.categories !== undefined) {
			const categories = normalizeCategories(updates.categories) ?? []
			await tx.delete(mediaCategories).where(eq(mediaCategories.filename, filename))

			if (categories.length > 0) {
				await tx.insert(mediaCategories).values(
					categories.map(category => ({ filename, category })),
				)
			}
		}
	})

	return { success: true }
}

export async function deleteMediaFile(userId: number, filename: string) {
	const record = await getMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	try {
		await unlink(record.filepath)
	} catch {
		// File may already be missing on disk.
	}

	for (const size of THUMB_SIZES) {
		try {
			await unlink(join(THUMB_DIR, `${size}_${filename}`))
		} catch {
			// Thumbnail may already be missing on disk.
		}
	}

	if (record.hasRaster) {
		try {
			await unlink(join(RASTER_DIR, `${filename}.png`))
		} catch {
			// Raster may already be missing on disk.
		}
	}

	await db.transaction(async (tx) => {
		await tx.insert(mediaHistory).values({
			filename,
			userId,
			action: 'delete',
			details: `${record.mimeType}, ${record.sizeBytes} bytes`,
		})
		await tx.delete(mediaCategories).where(eq(mediaCategories.filename, filename))
		await tx.delete(media).where(eq(media.filename, filename))
	})

	return { success: true }
}
