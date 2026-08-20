import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '$env/dynamic/private'
import { requireRole } from '$lib/server/auth.js'
import {
	deleteMediaFile,
	findMediaRecord,
	renameMediaFile,
	replaceMediaFile,
	restoreMediaVersion,
	updateMediaMetadata,
} from '$lib/feature/media/server/service.server.js'
import { handleServiceCall } from '$lib/server/utils.js'

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const RASTER_DIR = join(UPLOAD_DIR, 'rasters')
const VALID_WIDTHS = new Set([150, 300, 600])

const PNG_HEADERS = {
	'Content-Type': 'image/png',
	'Cache-Control': 'public, max-age=31536000, immutable',
}

/** GET /api/media/:filename — serve file or thumbnail */
export const GET: RequestHandler = async ({ params, url }) => {
	const filename = params.filename
	const requestedWidth = Number.parseInt(url.searchParams.get('w') || '0')
	const wantsSvg = url.searchParams.get('format') === 'svg'

	const record = await findMediaRecord(filename)
	if (!record) throw error(404, 'File not found')

	const isSvg = record.mimeType === 'image/svg+xml'
	const sizedThumbAvailable =
		requestedWidth && VALID_WIDTHS.has(requestedWidth) &&
		((requestedWidth === 150 && record.hasThumb150) ||
			(requestedWidth === 300 && record.hasThumb300) ||
			(requestedWidth === 600 && record.hasThumb600))

	// SVG sources: default to PNG raster output, opt out with ?format=svg.
	if (isSvg && !wantsSvg) {
		if (sizedThumbAvailable) {
			try {
				const buffer = await readFile(join(THUMB_DIR, `${requestedWidth}_${filename}.png`))
				return new Response(buffer, { headers: PNG_HEADERS })
			} catch {
				// Fall through to raster.
			}
		}
		if (record.hasRaster) {
			try {
				const buffer = await readFile(join(RASTER_DIR, `${filename}.png`))
				return new Response(buffer, { headers: PNG_HEADERS })
			} catch {
				// Fall through to original SVG.
			}
		}
	}

	// Non-SVG sized thumb (existing behavior).
	if (!isSvg && sizedThumbAvailable) {
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
			// Fall back to original.
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

/** POST /api/media/:filename — replace file with new version (multipart) */
export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const filename = event.params.filename
	const formData = await event.request.formData()
	const file = formData.get('file')

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 })
	}

	return handleServiceCall(async () => {
		return json(await replaceMediaFile(user.id, filename, file))
	})
}

/** PATCH /api/media/:filename — rename or restore (JSON body) */
export const PATCH: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')
	const filename = event.params.filename
	const body = await event.request.json() as
		| { action: 'rename', newFilename: string }
		| { action: 'restore', version: number }

	return handleServiceCall(async () => {
		if (body.action === 'rename') {
			return json(await renameMediaFile(user.id, filename, body.newFilename))
		}
		if (body.action === 'restore') {
			return json(await restoreMediaVersion(user.id, filename, body.version))
		}
		return json({ error: 'Unknown action' }, { status: 400 })
	})
}

/** DELETE /api/media/:filename */
export const DELETE: RequestHandler = async (event) => {
	const user = requireRole(event, 'editor')

	return handleServiceCall(async () => {
		return json(await deleteMediaFile(user.id, event.params.filename))
	})
}
