import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { languages } from '$lib/server/db/schema.js';
import { asc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth/login');
	}

	const langs = await db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name));

	return { languages: langs };
};
