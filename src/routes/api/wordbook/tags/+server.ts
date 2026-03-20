import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

/** GET /api/wordbook/tags — list all unique tags with counts */
export const GET: RequestHandler = async () => {
	const result = await db.execute(sql`
		SELECT tag, COUNT(*) as count
		FROM lexicon, UNNEST(tags) AS tag
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`)

	return json(result)
}
