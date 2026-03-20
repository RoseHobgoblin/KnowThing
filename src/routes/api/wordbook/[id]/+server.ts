import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, languages } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';

/** GET /api/wordbook/:id */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const [entry] = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			partOfSpeech: lexicon.partOfSpeech,
			definition: lexicon.definition,
			etymology: lexicon.etymology,
			usageExample: lexicon.usageExample,
			usageTranslation: lexicon.usageTranslation,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			related: lexicon.related,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt,
			languageId: lexicon.languageId,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(eq(lexicon.id, id));

	if (!entry) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	return json(entry);
};

/** PUT /api/wordbook/:id */
export const PUT: RequestHandler = async (event) => {
	requireAuth(event);
	const id = parseInt(event.params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await event.request.json();
	const {
		word,
		languageId,
		pronunciation,
		partOfSpeech,
		definition,
		etymology,
		usageExample,
		usageTranslation,
		notes,
		pageSlug,
		tags,
		related
	} = body as {
		word?: string;
		languageId?: number;
		pronunciation?: string;
		partOfSpeech?: string;
		definition?: string;
		etymology?: string;
		usageExample?: string;
		usageTranslation?: string;
		notes?: string;
		pageSlug?: string;
		tags?: string[];
		related?: string[];
	};

	const [updated] = await db
		.update(lexicon)
		.set({
			...(word && { word: word.trim() }),
			...(languageId && { languageId }),
			...(pronunciation !== undefined && { pronunciation: pronunciation?.trim() || null }),
			...(partOfSpeech !== undefined && { partOfSpeech: partOfSpeech?.trim() || null }),
			...(definition && { definition: definition.trim() }),
			...(etymology !== undefined && { etymology: etymology?.trim() || null }),
			...(usageExample !== undefined && { usageExample: usageExample?.trim() || null }),
			...(usageTranslation !== undefined && { usageTranslation: usageTranslation?.trim() || null }),
			...(notes !== undefined && { notes: notes?.trim() || null }),
			...(pageSlug !== undefined && { pageSlug: pageSlug?.trim() || null }),
			...(tags && { tags }),
			...(related && { related }),
			updatedAt: new Date()
		})
		.where(eq(lexicon.id, id))
		.returning();

	if (!updated) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	return json(updated);
};

/** DELETE /api/wordbook/:id */
export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event);
	if (user.role !== 'admin') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const id = parseInt(event.params.id);
	if (isNaN(id)) return json({ error: 'Invalid ID' }, { status: 400 });

	const [deleted] = await db.delete(lexicon).where(eq(lexicon.id, id)).returning();

	if (!deleted) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	return json({ success: true });
};
