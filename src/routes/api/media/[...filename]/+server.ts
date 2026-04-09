import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { eq } from 'drizzle-orm'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '$env/dynamic/private'
import { requireRole } from '$lib/server/auth.js'
import { db } from '$lib/server/db/index.js'
import { media } from '$lib/server/db/schema.js'
import { deleteMediaFile, updateMediaMetadata } from '$lib/server/services/media.js'
import { handleServiceCall } from '$lib/server/utils.js'

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

	if (requestedWidth && VALID_WIDTHS.has(requestedWidth)) {
		const hasThumb =
			(requestedWidth === 150 && record.hasThumb150) ||
			(requestedWidth === 300 && record.hasThumb300) ||
			(requestedWidth === 600 && record.hasThumb600)

		if (hasThumb) {
			try {
				const buffer = await readFile(join(THUMB_DIR, `${requestedWidth}_${filename}`))
				return new Response(buffer, {
					headers: {
						'Content-Type': record.mimeType || 'application/octet-stream',
						'Cache-Control': 'public, max-age=31536000, immutable',
						'Vary': 'Accept',
					},
				})
			} catch {
				// Fall back to original when the expected thumbnail is missing on disk.
			}
		}
	}

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
	const { description, categories } = body as { description?: string, categories?: string[] }

	return handleServiceCall(async () => {
		return json(await updateMediaMetadata(user.id, filename, { description, categories }))
	})
}

/** DELETE /api/media/:filename */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	return handleServiceCall(async () => {
		return json(await deleteMediaFile(user.id, event.params.filename))
	})
}
