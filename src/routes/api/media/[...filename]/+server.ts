import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { media } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth.js';
import { readFile, unlink } from 'fs/promises';

/** GET /api/media/:filename — serve file */
export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename;

	const [record] = await db
		.select()
		.from(media)
		.where(eq(media.filename, filename))
		.limit(1);

	if (!record) throw error(404, 'File not found');

	try {
		const buffer = await readFile(record.filepath);
		return new Response(buffer, {
			headers: {
				'Content-Type': record.mimeType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, 'File not found on disk');
	}
};

/** DELETE /api/media/:filename */
export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);
	const filename = event.params.filename;

	const [record] = await db
		.select()
		.from(media)
		.where(eq(media.filename, filename))
		.limit(1);

	if (!record) throw error(404, 'File not found');

	try {
		await unlink(record.filepath);
	} catch {
		// File may already be gone from disk
	}

	await db.delete(media).where(eq(media.filename, filename));
	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
