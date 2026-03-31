import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export interface ContentSearchOptions {
	limit: number
	offset?: number
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
			(
				CASE
					WHEN LOWER(title) = LOWER(${query}) THEN 5
					WHEN LOWER(title) LIKE LOWER(${query + '%'}) THEN 3
					ELSE 0
				END
				+ ts_rank(search_vector, websearch_to_tsquery('english', ${query}))
			) AS rank,
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
		OFFSET ${options.offset ?? 0}
	`)
}

export async function countContentSearchResults(query: string): Promise<number> {
	const [{ count }] = await db.execute<{ count: number }>(sql`
		SELECT COUNT(*)::int AS count
		FROM content_records
		WHERE search_vector @@ websearch_to_tsquery('english', ${query})
	`)

	return Number(count ?? 0)
}
