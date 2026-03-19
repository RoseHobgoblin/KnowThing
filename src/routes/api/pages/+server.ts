import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages, revisions } from '$lib/server/db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth.js';
import { updatePageEffects } from '$lib/server/page-effects.js';
import { slugify } from '$lib/renderer/context.js';

/** GET /api/pages — list all pages */
export const GET: RequestHandler = async () => {
	const result = await db
		.select({
			slug: pages.slug,
			title: pages.title,
			sizeBytes: pages.sizeBytes,
			updatedAt: pages.updatedAt
		})
		.from(pages)
		.orderBy(desc(pages.updatedAt));

	return json(result);
};

/** POST /api/pages — create a new page */
export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const body = await event.request.json();
	const { title, content } = body as { title: string; content: string };

	if (!title?.trim()) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	const slug = body.slug || slugify(title);
	const sizeBytes = new TextEncoder().encode(content || '').length;
	const plainText = await updatePageEffects(slug, content || '');

	const [page] = await db
		.insert(pages)
		.values({ slug, title: title.trim(), content: content || '', plainText, sizeBytes })
		.returning();

	// Create initial revision
	await db.insert(revisions).values({
		pageId: page.id,
		pageSlug: slug,
		title: page.title,
		content: page.content,
		sizeBytes,
		editSummary: 'Page created',
		userId: user.id
	});

	return json(page, { status: 201 });
};
