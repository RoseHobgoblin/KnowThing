import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { contentRecords, lexicon, languages } from '$lib/server/db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { parseWikitext, extractCategoriesFromAst, extractInfoboxFromRefs, extractSystemMapRefs } from '$lib/parser/index.js'
import { resolveAllStructuredData, resolveAllSystemMaps } from '$lib/server/structured-data.js'

export const load: PageServerLoad = async ({ params }) => {
	// Case-insensitive lookup within the 'know' domain
	const [record] = await db
		.select()
		.from(contentRecords)
		.where(and(
			eq(contentRecords.domain, 'know'),
			sql`LOWER(${contentRecords.slug}) = LOWER(${params.slug})`,
		))
		.limit(1)

	// Canonical redirect: if slug casing doesn't match stored form
	if (record && record.slug !== params.slug) {
		redirect(301, `/know/${record.slug}`)
	}

	if (!record) {
		// Check if this slug exists in another domain (e.g. moved to celestial)
		const [otherDomain] = await db
			.select({ domain: contentRecords.domain, slug: contentRecords.slug, parentPath: contentRecords.parentPath })
			.from(contentRecords)
			.where(sql`LOWER(${contentRecords.slug}) = LOWER(${params.slug})`)
			.limit(1)

		if (otherDomain) {
			const path = otherDomain.parentPath
				? `/${otherDomain.domain}/${otherDomain.parentPath}/${otherDomain.slug}`
				: `/${otherDomain.domain}/${otherDomain.slug}`
			redirect(301, path)
		}

		const normalizedSlug = params.slug[0].toUpperCase() + params.slug.slice(1)
		return {
			notFound: true,
			slug: normalizedSlug,
			title: normalizedSlug.replaceAll('_', ' '),
			ast: null,
			categories: [],
		}
	}

	// Use cached AST if available, otherwise parse fresh
	const ast = (record.parsedAst as import('$lib/parser/types.js').WikiNode) ?? parseWikitext(record.content)
	const cats = extractCategoriesFromAst(ast)

	// Pre-fetch structured data for any from=slug infobox references
	const fromRefs = extractInfoboxFromRefs(ast)
	let structuredData: Record<string, Record<string, string>> | null = null
	if (fromRefs.length > 0) {
		const resolved = await resolveAllStructuredData(fromRefs)
		if (resolved.size > 0) {
			structuredData = {}
			for (const [slug, fieldMap] of resolved) {
				structuredData[slug] = Object.fromEntries(fieldMap)
			}
		}
	}

	// Pre-fetch system map data for {{System map|slug}} templates
	const systemMapSlugs = extractSystemMapRefs(ast)
	const systemMaps = systemMapSlugs.length > 0
		? await resolveAllSystemMaps(systemMapSlugs)
		: null

	// Check if this page title matches a word in the wordbook
	const wordbookMatches = await db
		.select({
			word: lexicon.word,
			languageSlug: languages.slug,
			languageName: languages.name,
		})
		.from(lexicon)
		.innerJoin(languages, eq(lexicon.languageId, languages.id))
		.where(sql`LOWER(${lexicon.word}) = LOWER(${record.title.replaceAll(' ', '_')}) OR LOWER(${lexicon.word}) = LOWER(${record.title})`)
		.limit(1)

	return {
		notFound: false,
		slug: record.slug,
		title: record.title,
		content: record.content,
		contentRecordId: record.id,
		ast,
		categories: cats,
		updatedAt: record.updatedAt,
		wordbookMatch: wordbookMatches[0] || null,
		structuredData,
		systemMaps,
	}
}
