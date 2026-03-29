import { json, type RequestHandler } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { contentRecords } from '$lib/server/db/schema.js'
import { eq, and, sql } from 'drizzle-orm'

/**
 * GET /api/pages/summary?slug=onchera
 * Returns a short summary of a page for link preview popups.
 * Extracts the first paragraph of wikitext, strips markup, truncates.
 */
export const GET: RequestHandler = async ({ url }) => {
	const slug = url.searchParams.get('slug')?.toLowerCase()
	if (!slug) {
		return json({ error: 'Missing slug' }, { status: 400 })
	}

	const [page] = await db
		.select({
			title: contentRecords.title,
			content: contentRecords.content,
		})
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, 'know'), eq(sql`LOWER(${contentRecords.slug})`, slug)))
		.limit(1)

	if (!page) {
		return json({ error: 'Not found' }, { status: 404 })
	}

	const summary = extractSummary(page.content, 300)

	return json({
		title: page.title,
		summary,
	})
}

/**
 * Extract first meaningful paragraph from wikitext and strip markup.
 */
function extractSummary(wikitext: string, maxLength: number): string {
	const lines = wikitext.split('\n')
	let paragraph = ''

	for (const line of lines) {
		const trimmed = line.trim()
		// Skip empty lines, headings, templates, categories, images, tables
		if (!trimmed) continue
		if (trimmed.startsWith('=')) continue
		if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) continue
		if (trimmed.startsWith('[[Category:')) continue
		if (trimmed.startsWith('[[File:') || trimmed.startsWith('[[Image:')) continue
		if (trimmed.startsWith('{|') || trimmed.startsWith('|}') || trimmed.startsWith('|') || trimmed.startsWith('!')) continue
		if (trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith(':') || trimmed.startsWith(';')) continue

		paragraph = trimmed
		break
	}

	if (!paragraph) return ''

	// Strip wikitext markup
	let text = paragraph
	// Strip '''bold''' and ''italic''
	text = text.replaceAll(/'{2,3}/g, '')
	// Convert [[link|display]] to display, [[link]] to link
	text = text.replaceAll(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
	// Strip {{templates}}
	text = text.replaceAll(/\{\{[^}]*\}\}/g, '')
	// Strip <ref>...</ref> and <ref ... />
	text = text.replaceAll(/<ref[^>]*>[\S\s]*?<\/ref>/gi, '')
	text = text.replaceAll(/<ref[^>]*\/>/gi, '')
	// Strip remaining HTML tags
	text = text.replaceAll(/<[^>]+>/g, '')
	// Clean up whitespace
	text = text.replaceAll(/\s+/g, ' ').trim()

	if (text.length > maxLength) {
		// Truncate at last word boundary
		const truncated = text.slice(0, maxLength)
		const lastSpace = truncated.lastIndexOf(' ')
		text = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...'
	}

	return text
}
