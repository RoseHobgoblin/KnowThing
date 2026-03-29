import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

/** GET /api/search?q=...&limit=20 — full-text search across all content */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '20'), 100)

	if (!q) {
		return json([])
	}

	const tsquery = q
		.split(/\s+/)
		.filter(Boolean)
		.map(w => w + ':*')
		.join(' & ')

	const result = await db.execute(sql`
		SELECT
			domain,
			slug,
			parent_path AS "parentPath",
			title,
			ts_rank(search_vector, to_tsquery('english', ${tsquery})) AS rank,
			ts_headline('english', plain_text, to_tsquery('english', ${tsquery}),
				'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'
			) AS snippet
		FROM content_records
		WHERE search_vector @@ to_tsquery('english', ${tsquery})
		ORDER BY rank DESC
		LIMIT ${limit}
	`)

	return json(result)
}
