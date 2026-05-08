import { db } from '$lib/server/db/index.js'
import { sql } from 'drizzle-orm'

export interface ContentSearchOptions {
	limit: number
	offset?: number
	headlineMaxWords: number
	headlineMinWords: number
}

export async function searchPagesRaw(
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
	// TODO Phase 7: replace this UNION with a `searchable_pages` materialised
	// view that pre-computes tsvectors. Stopgap unions celestial entity tables
	// directly so post-Phase-4 entities surface in search.
	return db.execute(sql`
		SELECT * FROM (
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

			UNION ALL

			SELECT
				'celestial' AS domain,
				slug,
				NULL AS "parentPath",
				name AS title,
				(
					CASE
						WHEN LOWER(name) = LOWER(${query}) THEN 5
						WHEN LOWER(name) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(name, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM stars
			WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})

			UNION ALL

			SELECT
				'celestial' AS domain,
				slug,
				NULL AS "parentPath",
				name AS title,
				(
					CASE
						WHEN LOWER(name) = LOWER(${query}) THEN 5
						WHEN LOWER(name) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(name, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM planetary_bodies
			WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})

			UNION ALL

			SELECT
				'celestial' AS domain,
				slug,
				NULL AS "parentPath",
				name AS title,
				(
					CASE
						WHEN LOWER(name) = LOWER(${query}) THEN 5
						WHEN LOWER(name) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(name, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM star_systems
			WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})

			UNION ALL

			SELECT
				'wordbook' AS domain,
				slug,
				NULL AS "parentPath",
				name AS title,
				(
					CASE
						WHEN LOWER(name) = LOWER(${query}) THEN 5
						WHEN LOWER(name) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(name, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM languages
			WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})

			UNION ALL

			SELECT
				'wordbook' AS domain,
				lex.word AS slug,
				lg.slug AS "parentPath",
				lex.word AS title,
				(
					CASE
						WHEN LOWER(lex.word) = LOWER(${query}) THEN 5
						WHEN LOWER(lex.word) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(lex.word, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(lex.body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					lex.body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM lexicon lex
			JOIN languages lg ON lg.id = lex.language_id
			WHERE to_tsvector('english', lex.word || ' ' || COALESCE(lex.body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})

			UNION ALL

			SELECT
				'calendar' AS domain,
				slug,
				NULL AS "parentPath",
				name AS title,
				(
					CASE
						WHEN LOWER(name) = LOWER(${query}) THEN 5
						WHEN LOWER(name) LIKE LOWER(${query + '%'}) THEN 3
						ELSE 0
					END
					+ ts_rank(
						setweight(to_tsvector('english', COALESCE(name, '')), 'A')
						|| setweight(to_tsvector('english', COALESCE(body_plain_text, '')), 'B'),
						websearch_to_tsquery('english', ${query})
					)
				) AS rank,
				ts_headline(
					'english',
					body_plain_text,
					websearch_to_tsquery('english', ${query}),
					${`StartSel=<mark>, StopSel=</mark>, MaxWords=${options.headlineMaxWords}, MinWords=${options.headlineMinWords}`}
				) AS snippet
			FROM calendars
			WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query})
		) combined
		ORDER BY rank DESC
		LIMIT ${options.limit}
		OFFSET ${options.offset ?? 0}
	`)
}

export async function countPageSearchResults(query: string): Promise<number> {
	const [{ count }] = await db.execute<{ count: number }>(sql`
		SELECT (
			(SELECT COUNT(*) FROM content_records WHERE search_vector @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM stars WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM planetary_bodies WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM star_systems WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM languages WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM lexicon WHERE to_tsvector('english', word || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
			+ (SELECT COUNT(*) FROM calendars WHERE to_tsvector('english', name || ' ' || COALESCE(body_plain_text, '')) @@ websearch_to_tsquery('english', ${query}))
		)::int AS count
	`)

	return Number(count ?? 0)
}
