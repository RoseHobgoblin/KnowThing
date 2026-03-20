import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { pages } from '$lib/server/db/schema.js'
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
			slug,
			title,
			ts_rank(search_vector, to_tsquery('english', ${tsquery})) AS rank,
			ts_headline('english', plain_text, to_tsquery('english', ${tsquery}),
				'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25'
			) AS snippet
		FROM pages
		WHERE search_vector @@ to_tsquery('english', ${tsquery})
		ORDER BY rank DESC
		LIMIT 50
	`)

	return { query: q, results }
}
