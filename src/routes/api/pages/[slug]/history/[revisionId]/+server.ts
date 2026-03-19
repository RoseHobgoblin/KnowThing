import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { revisions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

/** GET /api/pages/:slug/history/:revisionId — get specific revision */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.revisionId);
	if (isNaN(id)) throw error(400, 'Invalid revision ID');

	const [rev] = await db
		.select()
		.from(revisions)
		.where(eq(revisions.id, id))
		.limit(1);

	if (!rev || rev.pageSlug !== params.slug) throw error(404, 'Revision not found');
	return json(rev);
};
