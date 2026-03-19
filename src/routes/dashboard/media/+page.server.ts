import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { media, mediaUsage } from '$lib/server/db/schema.js';
import { desc, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const files = await db
		.select({
			id: media.id,
			filename: media.filename,
			mimeType: media.mimeType,
			width: media.width,
			height: media.height,
			sizeBytes: media.sizeBytes,
			uploadedAt: media.uploadedAt,
			usageCount: sql<number>`(SELECT count(*) FROM media_usage WHERE filename = ${media.filename})::int`
		})
		.from(media)
		.orderBy(desc(media.uploadedAt));

	return { files };
};
