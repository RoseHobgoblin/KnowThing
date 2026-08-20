import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { findMediaRecordById } from '$lib/server/services/media.js'

/** Metadata lookup for a stable Media identity. */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number.parseInt(params.id)
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid Media asset ID')
	const record = await findMediaRecordById(id)
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
