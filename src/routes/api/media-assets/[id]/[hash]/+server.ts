import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { readFile } from 'node:fs/promises'
import { findMediaRevision } from '$lib/server/services/media.js'

const HASH_PATTERN = /^[\da-f]{64}$/i

/** Serve the exact bytes selected by a celestial surface binding. */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number.parseInt(params.id)
	if (!Number.isInteger(id) || id <= 0 || !HASH_PATTERN.test(params.hash)) {
		throw error(400, 'Invalid Media revision')
	}
	const revision = await findMediaRevision(id, params.hash.toLowerCase())
	if (!revision) throw error(404, 'Media revision not found')
	try {
		return new Response(await readFile(revision.filepath), {
			headers: {
				'Content-Type': revision.mimeType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	} catch {
		throw error(404, 'Media revision is missing from storage')
	}
}
