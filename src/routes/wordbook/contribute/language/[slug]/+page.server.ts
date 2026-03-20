import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { languages } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/auth/login');

	const [lang] = await db.select().from(languages).where(eq(languages.slug, params.slug));
	if (!lang) error(404, 'Language not found');

	return { language: lang };
};
