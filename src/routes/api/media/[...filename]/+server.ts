import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { media, mediaHistory, mediaCategories } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'
import { requireRole } from '$lib/server/auth.js'
import { readFile, unlink } from 'node:fs/promises'
import join from 'node:path'
import { env } from '$env/dynamic/private'

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const VALID_WIDTHS = new Set([150, 300, 600])

/** GET /api/media/:filename — serve file or thumbnail */
export const GET: RequestHandler = async ({ params, url }) => {
	const filename = params.filename
	const requestedWidth = Number.parseInt(url.searchParams.get('w') || '0')

	const [record] = await db
		.select()
		.from(media)
		.where(eq(media.filename, filename))
		.limit(1)

	if (!record) throw error(404, 'File not found')

	// Try to serve a thumbnail if requested
	if (requestedWidth && VALID_WIDTHS.has(requestedWidth)) {
		const hasThumb =
			(requestedWidth === 150 && record.hasThumb150) ||
			(requestedWidth === 300 && record.hasThumb300) ||
			(requestedWidth === 600 && record.hasThumb600)

		if (hasThumb) {
			try {
				const thumbPath = join(THUMB_DIR, `${requestedWidth}_${filename}`)
				const buffer = await readFile(thumbPath)
				return new Response(buffer, {
					headers: {
						'Content-Type': record.mimeType || 'application/octet-stream',
						'Cache-Control': 'public, max-age=31536000, immutable',
						'Vary': 'Accept',
					},
				})
			} catch {
				// Thumb missing on disk, fall through to original
			}
		}
	}

	// Serve original
	try {
		const buffer = await readFile(record.filepath)
		return new Response(buffer, {
			headers: {
				'Content-Type': record.mimeType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	} catch {
		throw error(404, 'File not found on disk')
	}
}

/** PUT /api/media/:filename — update description, categories */
export const PUT: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const filename = event.params.filename
	const body = await event.request.json()
	const { description, categories } = body as {
		description?: string
		categories?: string[]
	}

	const [record] = await db
		.select({ id: media.id })
		.from(media)
		.where(eq(media.filename, filename))

	if (!record) throw error(404, 'File not found')

	// Update description
	if (description !== undefined) {
		await db.update(media).set({ description: description.trim() || null }).where(eq(media.filename, filename))
		await db.insert(mediaHistory).values({
			filename,
			userId: user.id,
			action: 'describe',
			details: description.trim() || '(cleared)',
		})
	}

	// Update categories
	if (categories !== undefined) {
		await db.delete(mediaCategories).where(eq(mediaCategories.filename, filename))
		if (categories.length > 0) {
			await db.insert(mediaCategories).values(
				categories.map(c => ({ filename, category: c.trim() })),
			)
		}
	}

	return json({ success: true })
}

/** DELETE /api/media/:filename */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const filename = event.params.filename

	const [record] = await db
		.select()
		.from(media)
		.where(eq(media.filename, filename))
		.limit(1)

	if (!record) throw error(404, 'File not found')

	// Delete original file
	try {
		await unlink(record.filepath)
	} catch {
		// File may already be gone
	}

	// Delete thumbnails
	for (const size of [150, 300, 600]) {
		try {
			await unlink(join(THUMB_DIR, `${size}_${filename}`))
		} catch {
			// Thumb may not exist
		}
	}

	// Log before deleting record
	await db.insert(mediaHistory).values({
		filename,
		userId: user.id,
		action: 'delete',
		details: `${record.mimeType}, ${record.sizeBytes} bytes`,
	})

	await db.delete(mediaCategories).where(eq(mediaCategories.filename, filename))
	await db.delete(media).where(eq(media.filename, filename))

	return json({ success: true })
}
