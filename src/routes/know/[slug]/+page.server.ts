import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages, categories } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { parseWikitext, extractCategories } from '$lib/parser/index.js';

export const load: PageServerLoad = async ({ params }) => {
	const [page] = await db
		.select()
		.from(pages)
		.where(eq(pages.slug, params.slug))
		.limit(1);

	if (!page) {
		return {
			notFound: true,
			slug: params.slug,
			title: params.slug.replace(/_/g, ' '),
			ast: null,
			categories: []
		};
	}

	const ast = parseWikitext(page.content);
	const cats = extractCategories(page.content);

	return {
		notFound: false,
		slug: page.slug,
		title: page.title,
		content: page.content,
		ast,
		categories: cats,
		updatedAt: page.updatedAt
	};
};
