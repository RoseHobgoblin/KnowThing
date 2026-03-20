import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, lexiconInflections } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';
import { getInflectionTable, rebuildInflectedForms } from '$lib/server/wordbook/inflection.js';

/** GET /api/wordbook/:id/inflection — get inflection table */
export const GET: RequestHandler = async ({ params }) => {
	const entryId = parseInt(params.id);
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 });

	const table = await getInflectionTable(entryId);
	return json(table);
};

/** PUT /api/wordbook/:id/inflection — set class + stem + overrides */
export const PUT: RequestHandler = async (event) => {
	requireAuth(event);
	const entryId = parseInt(event.params.id);
	if (isNaN(entryId)) return json({ error: 'Invalid ID' }, { status: 400 });

	const [entry] = await db.select({ id: lexicon.id }).from(lexicon).where(eq(lexicon.id, entryId));
	if (!entry) return json({ error: 'Entry not found' }, { status: 404 });

	const body = await event.request.json();
	const { classId, stem, overrides } = body as {
		classId?: number | null;
		stem?: string;
		overrides?: Record<string, string>;
	};

	// Upsert inflection record
	const [existing] = await db.select().from(lexiconInflections).where(eq(lexiconInflections.entryId, entryId));

	if (existing) {
		await db.update(lexiconInflections).set({
			...(classId !== undefined && { classId: classId || null }),
			...(stem !== undefined && { stem: stem?.trim() || null }),
			...(overrides !== undefined && { overrides })
		}).where(eq(lexiconInflections.entryId, entryId));
	} else {
		await db.insert(lexiconInflections).values({
			entryId,
			classId: classId || null,
			stem: stem?.trim() || null,
			overrides: overrides || {}
		});
	}

	// Rebuild search index
	await rebuildInflectedForms(entryId);

	const table = await getInflectionTable(entryId);
	return json(table);
};
