import { error } from '@sveltejs/kit'
import { createHash } from 'node:crypto'
import { mkdir, rename as fsRename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { and, desc, eq, sql } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db/index.js'
import {
	contentMediaUsage,
	contentRecords,
	media,
	mediaCategories,
	mediaHistory,
	mediaVersions,
	users,
} from '$lib/server/db/schema.js'
import { getSiteConfig } from '$lib/server/settings.js'
import { sanitizeSvg, stripExifMetadata, verifyMimeType } from './media-sanitize.js'
import { updateContentEffects } from '$lib/server/content-effects.js'

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const RASTER_DIR = join(UPLOAD_DIR, 'rasters')
const MAX_UPLOAD_SIZE = Number.parseInt(env.MAX_UPLOAD_SIZE || '10485760')
const THUMB_SIZES = [150, 300, 600] as const
const RASTER_WIDTH = 1200

function normalizeCategories(categories?: string[]) {
	if (!categories) return

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

	const versions = await db
		.select({
			version: mediaVersions.version,
			sizeBytes: mediaVersions.sizeBytes,
			width: mediaVersions.width,
			height: mediaVersions.height,
			archivedAt: mediaVersions.archivedAt,
			username: users.username,
		})
		.from(mediaVersions)
		.leftJoin(users, eq(mediaVersions.uploadedBy, users.id))
		.where(eq(mediaVersions.filename, filename))
		.orderBy(desc(mediaVersions.version))

	return {
		file,
		uploaderName,
		categories: categories.map(c => c.category),
		usage: usage.map(u => u.pageSlug),
		history,
		versions,
	}
}

async function ingestBuffer(rawBuffer: Buffer, declaredType: string): Promise<{ buffer: Buffer, hash: string }> {
	await verifyMimeType(rawBuffer, declaredType)

	let buffer = rawBuffer
	if (declaredType === 'image/svg+xml') {
		buffer = sanitizeSvg(rawBuffer)
	} else if (declaredType.startsWith('image/')) {
		const config = await getSiteConfig()
		if (config.stripExifOnUpload) {
			buffer = await stripExifMetadata(rawBuffer, declaredType)
		}
	}

	const hash = createHash('sha256').update(buffer).digest('hex')
	return { buffer, hash }
}

export async function uploadMediaFile(userId: number, file: File) {
	if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
		throw error(400, `Unsupported file type: ${file.type}. Allowed: image/* or application/pdf`)
	}

	const rawBuffer = Buffer.from(await file.arrayBuffer())
	if (rawBuffer.length > MAX_UPLOAD_SIZE) {
		throw error(
			400,
			`File too large (${(rawBuffer.length / 1048576).toFixed(1)}MB). Maximum: ${(MAX_UPLOAD_SIZE / 1048576).toFixed(0)}MB`,
		)
	}

	const { buffer, hash } = await ingestBuffer(rawBuffer, file.type)
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

			for (const size of THUMB_SIZES) {
				await sharp(buffer, { density: 192 })
					.resize(size, undefined, { withoutEnlargement: false })
					.png()
					.toFile(join(THUMB_DIR, `${size}_${filename}.png`))
				if (size === 150) hasThumb150 = true
				if (size === 300) hasThumb300 = true
				if (size === 600) hasThumb600 = true
			}
		} catch (error_) {
			// SVG may reference external fonts/assets sharp can't resolve — article
			// keeps the crisp SVG, share cards just won't have an image for this one.
			console.error('SVG rasterization failed:', error_)
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
		} catch (error_) {
			console.error('Image processing failed:', error_)
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

/**
 * Archive the on-disk current state of `filename` into the versions dir and
 * insert a `media_versions` row. Returns the version number assigned.
 */
async function archiveCurrentVersion(filename: string, userId: number | null) {
	const record = await getMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	const VERSIONS_DIR = join(UPLOAD_DIR, 'versions')
	await mkdir(VERSIONS_DIR, { recursive: true })

	const [{ nextVersion }] = await db
		.select({ nextVersion: sql<number>`COALESCE(MAX(${mediaVersions.version}), 0) + 1` })
		.from(mediaVersions)
		.where(eq(mediaVersions.filename, filename))

	const archivePath = join(VERSIONS_DIR, `v${nextVersion}_${filename}`)
	try {
		await fsRename(record.filepath, archivePath)
	} catch {
		// Original may already be missing; record the attempt but continue.
	}

	await db.insert(mediaVersions).values({
		filename,
		version: nextVersion,
		filepath: archivePath,
		mimeType: record.mimeType,
		width: record.width,
		height: record.height,
		sizeBytes: record.sizeBytes,
		hash: record.hash,
		uploadedBy: userId,
	})

	return nextVersion
}

export async function replaceMediaFile(userId: number, filename: string, file: File) {
	const record = await getMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	if (file.type !== record.mimeType) {
		throw error(
			400,
			`New file type (${file.type}) must match the existing file's type (${record.mimeType}). Upload as a new file instead.`,
		)
	}

	const rawBuffer = Buffer.from(await file.arrayBuffer())
	if (rawBuffer.length > MAX_UPLOAD_SIZE) {
		throw error(
			400,
			`File too large (${(rawBuffer.length / 1048576).toFixed(1)}MB). Maximum: ${(MAX_UPLOAD_SIZE / 1048576).toFixed(0)}MB`,
		)
	}

	const { buffer, hash } = await ingestBuffer(rawBuffer, file.type)
	if (hash === record.hash) {
		throw error(409, 'New version is byte-identical to current version.')
	}

	const archivedVersion = await archiveCurrentVersion(filename, userId)

	const filepath = join(UPLOAD_DIR, filename)
	await writeFile(filepath, buffer)

	let width: number | null = null
	let height: number | null = null

	if (file.type === 'image/svg+xml') {
		try {
			await mkdir(RASTER_DIR, { recursive: true })
			await sharp(buffer, { density: 192 })
				.resize(RASTER_WIDTH, undefined, { withoutEnlargement: false })
				.png()
				.toFile(join(RASTER_DIR, `${filename}.png`))

			for (const size of THUMB_SIZES) {
				await sharp(buffer, { density: 192 })
					.resize(size, undefined, { withoutEnlargement: false })
					.png()
					.toFile(join(THUMB_DIR, `${size}_${filename}.png`))
			}
		} catch (error_) {
			console.error('SVG rasterization on replace failed:', error_)
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
				}
			}
		} catch (error_) {
			console.error('Image processing on replace failed:', error_)
		}
	}

	await db.transaction(async (tx) => {
		await tx
			.update(media)
			.set({
				filepath,
				sizeBytes: buffer.length,
				hash,
				width,
				height,
				uploadedBy: userId,
				uploadedAt: new Date(),
			})
			.where(eq(media.filename, filename))

		await tx.insert(mediaHistory).values({
			filename,
			userId,
			action: 'reupload',
			details: `archived as v${archivedVersion}; new ${file.type}, ${(buffer.length / 1024).toFixed(0)}KB${width ? `, ${width}x${height}` : ''}`,
		})
	})

	return { success: true, archivedVersion }
}

export async function restoreMediaVersion(userId: number, filename: string, version: number) {
	const record = await getMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	const [target] = await db
		.select()
		.from(mediaVersions)
		.where(and(eq(mediaVersions.filename, filename), eq(mediaVersions.version, version)))

	if (!target) throw error(404, `Version ${version} not found for ${filename}`)

	await archiveCurrentVersion(filename, userId)

	const filepath = join(UPLOAD_DIR, filename)
	await fsRename(target.filepath, filepath)

	await db.transaction(async (tx) => {
		await tx
			.update(media)
			.set({
				filepath,
				sizeBytes: target.sizeBytes,
				hash: target.hash,
				width: target.width,
				height: target.height,
				uploadedBy: userId,
				uploadedAt: new Date(),
			})
			.where(eq(media.filename, filename))

		await tx.delete(mediaVersions).where(and(
			eq(mediaVersions.filename, filename),
			eq(mediaVersions.version, version),
		))

		await tx.insert(mediaHistory).values({
			filename,
			userId,
			action: 'restore',
			details: `restored from v${version}`,
		})
	})

	return { success: true }
}

const FILENAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u

/**
 * Rename a media file. Moves on-disk artifacts (original, thumbs, raster,
 * archived versions), updates DB tables (`media`, `media_versions`,
 * `media_categories`, `media_history`, `content_media_usage`), and rewrites
 * the wikitext of every page that references it so that internal `[[File:...]]`
 * and template-argument references resolve to the new name.
 */
export async function renameMediaFile(userId: number, oldFilename: string, newFilenameRaw: string) {
	const record = await getMediaRecord(oldFilename)
	if (!record) throw error(404, 'File not found')

	const newFilename = newFilenameRaw.trim().replaceAll(/[^\p{L}\p{N}_.-]/gu, '_')
	if (!newFilename) throw error(400, 'New filename is empty after normalization.')
	if (newFilename === oldFilename) throw error(400, 'New filename matches existing filename.')
	if (!FILENAME_PATTERN.test(newFilename)) {
		throw error(400, 'Filename contains invalid characters.')
	}

	const collision = await getMediaRecord(newFilename)
	if (collision) throw error(409, `A file named "${newFilename}" already exists.`)

	const newFilepath = join(UPLOAD_DIR, newFilename)

	// Move primary file.
	try {
		await fsRename(record.filepath, newFilepath)
	} catch (error_) {
		throw error(500, `Could not rename file on disk: ${(error_ as Error).message}`)
	}

	// Move thumbs (different naming for SVG-derived vs raster-original).
	const isSvg = record.mimeType === 'image/svg+xml'
	for (const size of THUMB_SIZES) {
		const oldThumb = join(THUMB_DIR, isSvg ? `${size}_${oldFilename}.png` : `${size}_${oldFilename}`)
		const newThumb = join(THUMB_DIR, isSvg ? `${size}_${newFilename}.png` : `${size}_${newFilename}`)
		try { await fsRename(oldThumb, newThumb) } catch {}
	}

	if (record.hasRaster) {
		try {
			await fsRename(join(RASTER_DIR, `${oldFilename}.png`), join(RASTER_DIR, `${newFilename}.png`))
		} catch {}
	}

	// Move archived versions.
	const versions = await db.select().from(mediaVersions).where(eq(mediaVersions.filename, oldFilename))
	const VERSIONS_DIR = join(UPLOAD_DIR, 'versions')
	for (const v of versions) {
		const newVersionPath = join(VERSIONS_DIR, `v${v.version}_${newFilename}`)
		try { await fsRename(v.filepath, newVersionPath) } catch {}
	}

	// Find content records that reference the old filename.
	const referencingRows = await db
		.select({ id: contentRecords.id, content: contentRecords.content, domain: contentRecords.domain })
		.from(contentMediaUsage)
		.innerJoin(contentRecords, eq(contentMediaUsage.contentRecordId, contentRecords.id))
		.where(eq(contentMediaUsage.filename, oldFilename))

	const escapedOld = oldFilename.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)
	// Match the filename only when it's a complete token (not a substring of another name).
	// Bounded by [|=\s\[\]] and start/end-of-line variants typically present in wikitext.
	const referenceRegex = new RegExp(String.raw`(?<=^|[|=\s\[\n>])${escapedOld}(?=$|[|=\s\[\]\n<])`, 'g')

	await db.transaction(async (tx) => {
		await tx
			.update(media)
			.set({ filename: newFilename, filepath: newFilepath })
			.where(eq(media.filename, oldFilename))

		await tx.update(mediaVersions)
			.set({ filename: newFilename })
			.where(eq(mediaVersions.filename, oldFilename))

		for (const v of versions) {
			const newVersionPath = join(VERSIONS_DIR, `v${v.version}_${newFilename}`)
			await tx
				.update(mediaVersions)
				.set({ filepath: newVersionPath })
				.where(and(eq(mediaVersions.filename, newFilename), eq(mediaVersions.version, v.version)))
		}

		await tx.update(mediaCategories)
			.set({ filename: newFilename })
			.where(eq(mediaCategories.filename, oldFilename))

		await tx.update(mediaHistory)
			.set({ filename: newFilename })
			.where(eq(mediaHistory.filename, oldFilename))

		await tx.update(contentMediaUsage)
			.set({ filename: newFilename })
			.where(eq(contentMediaUsage.filename, oldFilename))

		await tx.insert(mediaHistory).values({
			filename: newFilename,
			userId,
			action: 'rename',
			details: `renamed from "${oldFilename}"`,
		})

		// Rewrite referencing wikitext.
		for (const row of referencingRows) {
			const updated = row.content.replace(referenceRegex, newFilename)
			if (updated === row.content) continue

			await tx
				.update(contentRecords)
				.set({ content: updated, updatedAt: new Date() })
				.where(eq(contentRecords.id, row.id))

			await updateContentEffects(tx, row.id, updated, row.domain)
		}
	})

	return { success: true, oldFilename, newFilename, rewrittenPages: referencingRows.length }
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
