import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, lexiconVariants, languageDialects } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';

/** GET /api/wordbook/:id/variants */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = parseInt(params.id);
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 });

	const variants = await db
		.select({
			id: lexiconVariants.id,
			pronunciation: lexiconVariants.pronunciation,
			spelling: lexiconVariants.spelling,
			notes: lexiconVariants.notes,
			dialectId: lexiconVariants.dialectId,
			dialectName: languageDialects.name,
			dialectSlug: languageDialects.slug,
			dialectRegion: languageDialects.region
		})
		.from(lexiconVariants)
		.innerJoin(languageDialects, eq(lexiconVariants.dialectId, languageDialects.id))
		.where(eq(lexiconVariants.entryId, entryId));

	return json(variants);
};

/** POST /api/wordbook/:id/variants */
export const POST: RequestHandler = async (event) => {
	requireAuth(event);

	const entryId = parseInt(event.params.id);
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 });

	const [entry] = await db.select({ id: lexicon.id }).from(lexicon).where(eq(lexicon.id, entryId));
	if (!entry) return json({ error: 'Entry not found' }, { status: 404 });

	const body = await event.request.json();
	const { dialectId, pronunciation, spelling, notes } = body as {
		dialectId: number;
		pronunciation?: string;
		spelling?: string;
		notes?: string;
	};

	if (!dialectId) return json({ error: 'dialectId is required' }, { status: 400 });
	if (!pronunciation?.trim() && !spelling?.trim()) {
		return json({ error: 'At least pronunciation or spelling is required' }, { status: 400 });
	}

	const [variant] = await db
		.insert(lexiconVariants)
		.values({
			entryId,
			dialectId,
			pronunciation: pronunciation?.trim() || null,
			spelling: spelling?.trim() || null,
			notes: notes?.trim() || null
		})
		.returning();

	return json(variant, { status: 201 });
};
