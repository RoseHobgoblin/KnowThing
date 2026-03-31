import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export interface ContentSearchOptions {
	limit: number
	headlineMaxWords: number
	headlineMinWords: number
}

export async function searchContent(
	query: string,
	options: ContentSearchOptions,
): Promise<Array<{
	domain: string
	slug: string
	parentPath: string | null
	title: string
	rank: number
	snippet: string
}>> {
	return db.execute(sql`
		SELECT
			domain,
			slug,
			parent_path AS "parentPath",
			title,
			ts_rank(search_vector, websearch_to_tsquery('english', ${query})) AS rank,
			ts_headline(
				'english',
				plain_text,
				websearch_to_tsquery('english', ${query}),
				${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
			) AS snippet
		FROM content_records
		WHERE search_vector @@ websearch_to_tsquery('english', ${query})
		ORDER BY rank DESC
		LIMIT ${options.limit}
	`)
}
