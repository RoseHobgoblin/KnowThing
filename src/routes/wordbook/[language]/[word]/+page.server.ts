import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, languages } from '$lib/server/db/schema.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js';

export const load: PageServerLoad = async ({ params }) => {
	const word = decodeURIComponent(params.word);

	// Get language
	const [lang] = await db
		.select()
		.from(languages)
		.where(eq(languages.slug, params.language));

	if (!lang) {
		error(404, 'Language not found');
	}

	// Get all senses of this word
	const entries = await db
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
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(and(
			sql`LOWER(${lexicon.word}) = LOWER(${word})`,
			eq(lexicon.languageId, lang.id)
		))
		.orderBy(asc(lexicon.partOfSpeech));

	if (entries.length === 0) {
		error(404, `No entry for "${word}" in ${lang.name}`);
	}

	// Load etymological relations for the first entry
	const primaryId = entries[0].id;
	const [direct, cognates, etymologyChain] = await Promise.all([
		getDirectRelations(primaryId),
		computeCognates(primaryId, lang.id),
		getEtymologyChain(primaryId)
	]);

	return {
		word,
		language: lang,
		entries,
		relations: { direct, cognates, etymologyChain }
	};
};
