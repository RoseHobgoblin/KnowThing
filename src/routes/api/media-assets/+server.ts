import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { findMediaRecord } from '$lib/feature/media/server/service.server.js'

/** Resolve a legacy filename binding so the editor can show its real status. */
export const GET: RequestHandler = async ({ url }) => {
	const filename = url.searchParams.get('filename')?.trim()
	if (!filename) throw error(400, 'A filename is required')
	const record = await findMediaRecord(filename)
	if (!record) throw error(404, 'Media asset not found')
	return json({
		id: record.id,
		filename: record.filename,
		mimeType: record.mimeType,
		width: record.width,
		height: record.height,
		sizeBytes: record.sizeBytes,
		description: record.description,
		hash: record.hash,
		hasThumb150: record.hasThumb150,
		hasThumb300: record.hasThumb300,
		hasThumb600: record.hasThumb600,
		uploadedAt: record.uploadedAt,
		usageCount: 0,
	})
}
