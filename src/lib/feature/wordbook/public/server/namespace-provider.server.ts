import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { languages, lexicon } from '../../server/schema.server.js'
import { buildWordbookHref, type WordbookPath } from '$lib/parser/wordbook-path.js'
import type { ResolvedTarget } from '$lib/namespaces/providers.js'

export async function resolveWordbookPathTarget(path: WordbookPath): Promise<ResolvedTarget> {
	const [language] = await db
		.select({ id: languages.id, slug: languages.slug, name: languages.name })
		.from(languages)
		.where(sql`LOWER(${languages.slug}) = ${path.language.toLowerCase()}`)
		.limit(1)
	if (!language) return {
		kind: null,
		href: buildWordbookHref(path),
		title: path.word ? `${path.word} (${path.language})` : path.language,
		exists: false,
	}
	if (!path.word) return {
		kind: 'wordbook-language',
		href: buildWordbookHref({ language: language.slug }),
		title: language.name,
		exists: true,
		entityId: language.id,
	}
	const [entry] = await db
		.select({ id: lexicon.id, word: lexicon.word })
		.from(lexicon)
		.where(and(eq(lexicon.languageId, language.id), sql`LOWER(${lexicon.word}) = ${path.word.toLowerCase()}`))
		.limit(1)
	return entry
		? {
			kind: 'wordbook-word',
			href: buildWordbookHref({ language: language.slug, word: entry.word }),
			title: `${entry.word} (${language.name})`,
			exists: true,
			entityId: entry.id,
		}
		: {
			kind: null,
			href: buildWordbookHref({ language: language.slug, word: path.word }),
			title: `${path.word} (${language.name})`,
			exists: false,
		}
}
