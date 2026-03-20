import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, definitions, languages, languageDialects } from '$lib/server/db/schema.js';
import { eq, sql, asc, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getAncestryChain, getChildren } from '$lib/server/wordbook/language-tree.js';

export const load: PageServerLoad = async ({ params, url }) => {
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
			wordCount: sql<number>`(SELECT COUNT(*)::int FROM lexicon WHERE language_id = ${languages.id})`.as('word_count')
		})
		.from(languages)
		.where(eq(languages.slug, params.language));

	if (!lang) error(404, 'Language not found');

	// Load ancestry, children, dialects
	const [ancestryChain, children, dialects] = await Promise.all([
		getAncestryChain(lang.id),
		getChildren(lang.id),
		db.select().from(languageDialects).where(eq(languageDialects.languageId, lang.id)).orderBy(asc(languageDialects.name))
	]);

	const letter = url.searchParams.get('letter') || '';
	const conditions = [eq(lexicon.languageId, lang.id)];
	if (letter) {
		conditions.push(sql`LOWER(LEFT(${lexicon.word}, 1)) = ${letter.toLowerCase()}`);
	}

	const entries = await db
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
		.where(and(...conditions))
		.orderBy(asc(lexicon.word))
		.limit(500);

	const activeLettersResult = await db
		.select({
			letter: sql<string>`DISTINCT UPPER(LEFT(${lexicon.word}, 1))`.as('letter')
		})
		.from(lexicon)
		.where(eq(lexicon.languageId, lang.id))
		.orderBy(sql`letter`);

	return {
		language: lang,
		entries,
		ancestryChain,
		children,
		dialects,
		activeLetters: activeLettersResult.map(r => r.letter),
		currentLetter: letter
	};
};
