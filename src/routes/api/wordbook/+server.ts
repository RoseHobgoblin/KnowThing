import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, lexiconRelations, definitions, languages } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq, sql, asc, desc, and } from 'drizzle-orm';

/** GET /api/wordbook — search and browse */
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
	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`);
	}
	if (tag) {
		conditions.push(sql`${tag} = ANY(${lexicon.tags})`);
	}
	if (pos) {
		conditions.push(sql`EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.part_of_speech = ${pos})`);
	}

	if (q) {
		const results = await db
			.select({
				id: lexicon.id,
				word: lexicon.word,
				pronunciation: lexicon.pronunciation,
				tags: lexicon.tags,
				languageName: languages.name,
				languageSlug: languages.slug,
				languageColor: languages.color,
				// First definition for preview
				definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('definition'),
				partOfSpeech: sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('part_of_speech'),
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
						OR lexicon.search_vector @@ plainto_tsquery('english', ${q})
						OR EXISTS (SELECT 1 FROM definitions d WHERE d.entry_id = ${lexicon.id} AND d.search_vector @@ plainto_tsquery('english', ${q}))
					)`,
					...(conditions.length > 0 ? conditions : [])
				)
			)
			.orderBy(sql`relevance DESC`, asc(lexicon.word))
			.limit(limit)
			.offset(offset);

		return json(results);
	}

	// Browse mode
	const results = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			tags: lexicon.tags,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color,
			definition: sql<string>`(SELECT definition FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('definition'),
			partOfSpeech: sql<string>`(SELECT part_of_speech FROM definitions WHERE entry_id = ${lexicon.id} ORDER BY sense_number LIMIT 1)`.as('part_of_speech')
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(asc(lexicon.word))
		.limit(limit)
		.offset(offset);

	return json(results);
};

/** POST /api/wordbook — create entry with definitions */
export const POST: RequestHandler = async (event) => {
	requireAuth(event);
	const body = await event.request.json();
	const {
		word,
		languageId,
		pronunciation,
		etymology,
		notes,
		pageSlug,
		tags,
		defs,
		relations
	} = body as {
		word: string;
		languageId: number;
		pronunciation?: string;
		etymology?: string;
		notes?: string;
		pageSlug?: string;
		tags?: string[];
		defs?: Array<{ partOfSpeech?: string; definition: string; usageExample?: string; usageTranslation?: string }>;
		relations?: Array<{ targetId: number; relationType: string }>;
	};

	if (!word?.trim() || !languageId) {
		return json({ error: 'Word and language are required' }, { status: 400 });
	}

	const defsList: Array<{ partOfSpeech?: string; definition: string; usageExample?: string; usageTranslation?: string }> =
		defs && defs.length > 0 ? defs : [{ definition: body.definition || '' }];
	if (!defsList[0]?.definition?.trim()) {
		return json({ error: 'At least one definition is required' }, { status: 400 });
	}

	// Normalize tags
	const normalizedTags = (tags || []).map((t: string) => t.trim().toLowerCase()).filter((t: string, i: number, a: string[]) => t && a.indexOf(t) === i);

	// Check for existing word in same language — auto-assign homograph number
	const existing = await db
		.select({ id: lexicon.id, homographNumber: lexicon.homographNumber, word: lexicon.word })
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(and(sql`LOWER(${lexicon.word}) = LOWER(${word.trim()})`, eq(lexicon.languageId, languageId)));

	let homographNumber = 1;
	if (existing.length > 0) {
		// If there's already an entry, check if user intended a homograph
		const isHomograph = body.isHomograph === true;
		if (!isHomograph) {
			const lang = await db.select({ name: languages.name, slug: languages.slug }).from(languages).where(eq(languages.id, languageId));
			return json({
				error: `"${word.trim()}" already exists in ${lang[0]?.name || 'this language'}. Add a definition to the existing entry, or set isHomograph: true to create a separate homograph.`,
				existingId: existing[0].id,
				existingSlug: lang[0]?.slug
			}, { status: 409 });
		}
		homographNumber = Math.max(...existing.map(e => e.homographNumber)) + 1;
	}

	const [entry] = await db
		.insert(lexicon)
		.values({
			word: word.trim(),
			languageId,
			pronunciation: pronunciation?.trim() || null,
			etymology: etymology?.trim() || null,
			notes: notes?.trim() || null,
			pageSlug: pageSlug?.trim() || null,
			tags: normalizedTags,
			homographNumber
		})
		.returning();

	// Insert definitions
	for (let i = 0; i < defsList.length; i++) {
		const d = defsList[i];
		if (d.definition?.trim()) {
			await db.insert(definitions).values({
				entryId: entry.id,
				senseNumber: i + 1,
				partOfSpeech: d.partOfSpeech?.trim() || null,
				definition: d.definition.trim(),
				usageExample: d.usageExample?.trim() || null,
				usageTranslation: d.usageTranslation?.trim() || null
			});
		}
	}

	// Refresh search vector (definitions now exist)
	await db.update(lexicon).set({ updatedAt: new Date() }).where(eq(lexicon.id, entry.id));

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
