import type { LayoutServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages } from '$lib/server/db/schema.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	const allPages = await db
		.select({ slug: pages.slug, title: pages.title })
		.from(pages);

	return {
		user: locals.user,
		existingPages: allPages.map((p) => p.slug)
	};
};
