import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexicon, definitions, languages } from '$lib/server/db/schema.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDirectRelations, computeCognates, getEtymologyChain } from '$lib/server/wordbook/etymology.js';

export const load: PageServerLoad = async ({ params }) => {
	const word = decodeURIComponent(params.word);

	const [lang] = await db
		.select()
		.from(languages)
		.where(eq(languages.slug, params.language));

	if (!lang) error(404, 'Language not found');

	// Get the headword entry
	const [entry] = await db
		.select({
			id: lexicon.id,
			word: lexicon.word,
			pronunciation: lexicon.pronunciation,
			etymology: lexicon.etymology,
			notes: lexicon.notes,
			pageSlug: lexicon.pageSlug,
			tags: lexicon.tags,
			createdAt: lexicon.createdAt,
			updatedAt: lexicon.updatedAt
		})
		.from(lexicon)
		.where(and(
			sql`LOWER(${lexicon.word}) = LOWER(${word})`,
			eq(lexicon.languageId, lang.id)
		));

	if (!entry) error(404, `No entry for "${word}" in ${lang.name}`);

	// Get all definitions
	const defs = await db
		.select()
		.from(definitions)
		.where(eq(definitions.entryId, entry.id))
		.orderBy(asc(definitions.senseNumber));

	// Load etymological relations
	const [direct, cognates, etymologyChain] = await Promise.all([
		getDirectRelations(entry.id),
		computeCognates(entry.id, lang.id),
		getEtymologyChain(entry.id)
	]);

	return {
		word: entry.word,
		language: lang,
		entry,
		definitions: defs,
		relations: { direct, cognates, etymologyChain }
	};
};
