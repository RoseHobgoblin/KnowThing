import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { links, pages } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

/** GET /api/pages/:slug/backlinks — pages that link to this page */
export const GET: RequestHandler = async ({ params }) => {
	const result = await db
		.select({
			slug: links.sourceSlug,
			title: pages.title
		})
		.from(links)
		.leftJoin(pages, eq(links.sourceSlug, pages.slug))
		.where(eq(links.targetSlug, params.slug));

	return json(result);
};
