import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages } from '$lib/server/db/schema.js';
import { sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [randomPage] = await db
		.select({ slug: pages.slug })
		.from(pages)
		.orderBy(sql`RANDOM()`)
		.limit(1);

	if (randomPage) {
		throw redirect(302, `/know/${randomPage.slug}`);
	}

	// No pages exist yet
	throw redirect(302, '/');
};
