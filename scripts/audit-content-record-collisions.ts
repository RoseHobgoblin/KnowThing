import postgres from 'postgres'

const sql = postgres('postgres://knowthing:knowthing@localhost:5432/knowthing')

type Row = { domain: string, slug: string, n: number, ids: number[], parent_paths: (string | null)[] }
const collisions = await sql<Row[]>`
	SELECT domain, slug, COUNT(*)::int AS n,
		ARRAY_AGG(id ORDER BY id) AS ids,
		ARRAY_AGG(parent_path ORDER BY id) AS parent_paths
	FROM content_records
	GROUP BY domain, slug
	HAVING COUNT(*) > 1
	ORDER BY domain, slug
`

if (collisions.length === 0) {
	console.log('No (domain, slug) collisions. Safe to add unique index.')
} else {
	console.log(`Found ${collisions.length} colliding (domain, slug) pairs:\n`)
	for (const c of collisions) {
		console.log(`  ${c.domain}/${c.slug}  ×${c.n}  ids=[${c.ids.join(', ')}]  parent_paths=[${c.parent_paths.map(p => p ?? 'NULL').join(', ')}]`)
	}
	console.log('\nResolve these before adding the unique constraint.')
}

await sql.end()
