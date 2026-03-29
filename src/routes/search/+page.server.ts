import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() || ''

	if (!q) return { query: '', results: [] }

	const tsquery = q
		.split(/\s+/)
		.filter(Boolean)
		.map(w => w + ':*')
		.join(' & ')

	const results = await db.execute(sql`
		SELECT
			domain,
			slug,
			parent_path AS "parentPath",
			title,
			ts_rank(search_vector, to_tsquery('english', ${tsquery})) AS rank,
			ts_headline('english', plain_text, to_tsquery('english', ${tsquery}),
				'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25'
			) AS snippet
		FROM content_records
		WHERE search_vector @@ to_tsquery('english', ${tsquery})
		ORDER BY rank DESC
		LIMIT 50
	`)

	return { query: q, results }
}
