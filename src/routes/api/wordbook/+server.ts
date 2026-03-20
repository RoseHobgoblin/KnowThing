import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, lexiconRelations, languages } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq, sql, asc, desc, and, ilike } from 'drizzle-orm';

/** GET /api/wordbook — search and browse lexicon entries */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	const language = url.searchParams.get('language');
	const tag = url.searchParams.get('tag');
	const letter = url.searchParams.get('letter');
	const pos = url.searchParams.get('pos');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
	const offset = parseInt(url.searchParams.get('offset') || '0');

	const conditions = [];

	if (language) {
		conditions.push(eq(languages.slug, language));
	}

	if (pos) {
		conditions.push(eq(lexicon.partOfSpeech, pos));
	}

	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`);
	}

	if (tag) {
		conditions.push(sql`${tag} = ANY(${lexicon.tags})`);
	}

	// If there's a search query, use tiered matching
	if (q) {
		const results = await db
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
				languageName: languages.name,
				languageSlug: languages.slug,
				languageColor: languages.color,
				relevance: sql<number>`
					CASE
						WHEN LOWER(${lexicon.word}) = LOWER(${q}) THEN 4
						WHEN LOWER(${lexicon.word}) LIKE LOWER(${q + '%'}) THEN 3
						WHEN ${lexicon.word} % ${q} THEN 2
						ELSE 1
					END
				`.as('relevance')
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(
				and(
					sql`(
						LOWER(${lexicon.word}) = LOWER(${q})
						OR LOWER(${lexicon.word}) LIKE LOWER(${q + '%'})
						OR ${lexicon.word} % ${q}
						OR search_vector @@ plainto_tsquery('english', ${q})
					)`,
					...conditions
				)
			)
			.orderBy(sql`relevance DESC`, asc(lexicon.word))
			.limit(limit)
			.offset(offset);

		return json(results);
	}

	// No search query — browse mode
	const results = await db
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
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(asc(lexicon.word), asc(lexicon.partOfSpeech))
		.limit(limit)
		.offset(offset);

	return json(results);
};

/** POST /api/wordbook — create a lexicon entry */
export const POST: RequestHandler = async (event) => {
	requireAuth(event);
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
		relations
	} = body as {
		word: string;
		languageId: number;
		pronunciation?: string;
		partOfSpeech?: string;
		definition: string;
		etymology?: string;
		usageExample?: string;
		usageTranslation?: string;
		notes?: string;
		pageSlug?: string;
		tags?: string[];
		relations?: Array<{ targetId: number; relationType: string }>;
	};

	if (!word?.trim() || !definition?.trim() || !languageId) {
		return json({ error: 'Word, definition, and language are required' }, { status: 400 });
	}

	const [entry] = await db
		.insert(lexicon)
		.values({
			word: word.trim(),
			languageId,
			pronunciation: pronunciation?.trim() || null,
			partOfSpeech: partOfSpeech?.trim() || null,
			definition: definition.trim(),
			etymology: etymology?.trim() || null,
			usageExample: usageExample?.trim() || null,
			usageTranslation: usageTranslation?.trim() || null,
			notes: notes?.trim() || null,
			pageSlug: pageSlug?.trim() || null,
			tags: tags || [],
			related: []
		})
		.returning();

	// Insert etymology relations if provided
	if (relations && relations.length > 0) {
		const validTypes = ['derived_from', 'loan_from', 'compound_of'];
		const validRelations = relations.filter((r: { targetId: number; relationType: string }) => r.targetId && validTypes.includes(r.relationType));
		if (validRelations.length > 0) {
			await db.insert(lexiconRelations).values(
				validRelations.map((r: { targetId: number; relationType: string }) => ({
					sourceId: entry.id,
					targetId: r.targetId,
					relationType: r.relationType
				}))
			).onConflictDoNothing();
		}
	}

	return json(entry, { status: 201 });
};
