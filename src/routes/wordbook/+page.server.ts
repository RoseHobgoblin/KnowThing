import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { languages, lexicon } from '$lib/server/db/schema.js';
import { asc, desc, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Languages with word counts
	const langs = await db
		.select({
			id: languages.id,
			name: languages.name,
			slug: languages.slug,
			nativeName: languages.nativeName,
			script: languages.script,
			family: languages.family,
			color: languages.color,
			description: languages.description,
			wordCount: sql<number>`(SELECT COUNT(*) FROM lexicon WHERE language_id = ${languages.id})`.as('word_count')
		})
		.from(languages)
		.orderBy(asc(languages.name));

	// Recently added words
	const recent = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			partOfSpeech: lexicon.partOfSpeech,
			definition: lexicon.definition,
			languageName: languages.name,
			languageSlug: languages.slug,
			languageColor: languages.color
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.orderBy(desc(lexicon.createdAt))
		.limit(10);

	// Total word count
	const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(lexicon);

	return { languages: langs, recent, totalWords: Number(count) };
};
