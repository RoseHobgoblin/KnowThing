import postgres from 'postgres'
import { extractImages } from '../src/lib/parser/index.ts'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://knowthing:knowthing@localhost:5432/knowthing'
const sql = postgres(DATABASE_URL)

const records = await sql<{ id: number, slug: string, content: string }[]>`
  SELECT id, slug, content FROM content_records WHERE content IS NOT NULL
`

console.log(`Re-extracting media usage for ${records.length} content records`)

let touched = 0
let totalUsages = 0

for (const record of records) {
	const filenames = [...new Set(extractImages(record.content))]

	await sql.begin(async (tx) => {
		await tx`DELETE FROM content_media_usage WHERE content_record_id = ${record.id}`
		if (filenames.length > 0) {
			await tx`
				INSERT INTO content_media_usage (content_record_id, filename)
				VALUES ${tx(filenames.map(filename => [record.id, filename]))}
				ON CONFLICT DO NOTHING
			`
		}
	})

	if (filenames.length > 0) {
		touched++
		totalUsages += filenames.length
	}
}

console.log(`Done. ${touched} records had media (${totalUsages} usage rows total).`)
await sql.end()
