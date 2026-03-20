import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, definitions, languages } from '$lib/server/db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/auth/login');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const [entry] = await db.select().from(lexicon).where(eq(lexicon.id, id));
	if (!entry) error(404, 'Entry not found');

	const defs = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, id))
		.orderBy(asc(definitions.senseNumber));

	const langs = await db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name));

	return { entry, definitions: defs, languages: langs };
};
