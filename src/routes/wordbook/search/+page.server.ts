import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, languages } from '$lib/server/db/schema.js';
import { eq, sql, asc, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() || '';
	const language = url.searchParams.get('language') || '';
	const tag = url.searchParams.get('tag') || '';
	const pos = url.searchParams.get('pos') || '';

	const conditions = [];

	if (language) {
		conditions.push(eq(languages.slug, language));
	}
	if (pos) {
		conditions.push(eq(lexicon.partOfSpeech, pos));
	}
	if (tag) {
		conditions.push(sql`${tag} = ANY(${lexicon.tags})`);
	}

	let results: any[] = [];

	if (q) {
		results = await db
			.select({
				id: lexicon.id,
				word: lexicon.word,
				pronunciation: lexicon.pronunciation,
				partOfSpeech: lexicon.partOfSpeech,
				definition: lexicon.definition,
				tags: lexicon.tags,
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
			.limit(100);
	} else if (tag || language || pos) {
		results = await db
			.select({
				id: lexicon.id,
				word: lexicon.word,
				pronunciation: lexicon.pronunciation,
				partOfSpeech: lexicon.partOfSpeech,
				definition: lexicon.definition,
				tags: lexicon.tags,
				languageName: languages.name,
				languageSlug: languages.slug,
				languageColor: languages.color
			})
			.from(lexicon)
			.innerJoin(languages, eq(lexicon.languageId, languages.id))
			.where(and(...conditions))
			.orderBy(asc(lexicon.word))
			.limit(100);
	}

	// Get all languages for filter dropdown
	const langs = await db
		.select({ name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name));

	return { results, query: q, language, tag, pos, languages: langs };
};
