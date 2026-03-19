import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { pages } from '$lib/server/db/schema.js';
import { sql } from 'drizzle-orm';

/** GET /api/search?q=...&limit=20 — full-text search */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

	if (!q) {
		return json([]);
	}

	// Convert user query to tsquery format
	const tsquery = q
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w + ':*')
		.join(' & ');

	const result = await db.execute(sql`
		SELECT
			slug,
			title,
			ts_rank(search_vector, to_tsquery('english', ${tsquery})) AS rank,
			ts_headline('english', plain_text, to_tsquery('english', ${tsquery}),
				'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'
			) AS snippet
		FROM pages
		WHERE search_vector @@ to_tsquery('english', ${tsquery})
		ORDER BY rank DESC
		LIMIT ${limit}
	`);

	return json(result);
};
