import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { media } from '$lib/server/db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { env } from '$env/dynamic/private';

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads';

/** GET /api/media — list all media */
export const GET: RequestHandler = async () => {
	const result = await db
		.select()
		.from(media)
		.orderBy(desc(media.uploadedAt));

	return json(result);
};

/** POST /api/media — upload file */
export const POST: RequestHandler = async (event) => {
	requireAuth(event);

	const formData = await event.request.formData();
	const file = formData.get('file') as File;

	if (!file || !(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	// Validate MIME type
	if (!file.type.startsWith('image/')) {
		return json({ error: 'Only image files are allowed' }, { status: 400 });
	}

	const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
	const uploadDir = UPLOAD_DIR || './uploads';
	await mkdir(uploadDir, { recursive: true });

	const filepath = join(uploadDir, filename);
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(filepath, buffer);

	const [record] = await db
		.insert(media)
		.values({
			filename,
			filepath,
			mimeType: file.type,
			sizeBytes: buffer.length
		})
		.onConflictDoUpdate({
			target: media.filename,
			set: {
				filepath,
				mimeType: file.type,
				sizeBytes: buffer.length,
				uploadedAt: new Date()
			}
		})
		.returning();

	return json(record, { status: 201 });
};
