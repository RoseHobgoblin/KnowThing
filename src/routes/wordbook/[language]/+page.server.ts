import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, languages } from '$lib/server/db/schema.js';
import { eq, sql, asc, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url }) => {
	// Get language
	const [lang] = await db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			script: languages.script,
			family: languages.family,
			color: languages.color,
			description: languages.description,
			pageSlug: languages.pageSlug,
			wordCount: sql<number>`(SELECT COUNT(*) FROM lexicon WHERE language_id = ${languages.id})`.as('word_count')
		})
		.from(languages)
		.where(eq(languages.slug, params.language));

	if (!lang) {
		error(404, 'Language not found');
	}

	const letter = url.searchParams.get('letter') || '';
	const conditions = [eq(lexicon.languageId, lang.id)];

	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`);
	}

	// Get entries
	const entries = await db
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
		.orderBy(asc(lexicon.word), asc(lexicon.partOfSpeech))
		.limit(500);

	// Get active letters
	const activeLettersResult = await db
		.select({
			letter: sql<string>`DISTINCT UPPER(LEFT(${lexicon.word}, 1))`.as('letter')
		})
		.from(lexicon)
		.where(eq(lexicon.languageId, lang.id))
		.orderBy(sql`letter`);

	const activeLetters = activeLettersResult.map(r => r.letter);

	return { language: lang, entries, activeLetters, currentLetter: letter };
};
