import postgres from 'postgres'
import sharp from 'sharp'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://knowthing:knowthing@localhost:5432/knowthing'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const RASTER_DIR = join(UPLOAD_DIR, 'rasters')
const RASTER_WIDTH = 1200

const sql = postgres(DATABASE_URL)

await mkdir(RASTER_DIR, { recursive: true })

const rows = await sql<{ filename: string, filepath: string }[]>`
	SELECT filename, filepath FROM media
	WHERE mime_type = 'image/svg+xml' AND has_raster = false
`

console.log(`Found ${rows.length} SVG(s) missing rasters`)

let ok = 0
let failed = 0
for (const row of rows) {
	const rasterPath = join(RASTER_DIR, `${row.filename}.png`)

	try {
		// If a raster file already exists on disk, just flip the flag.
		await access(rasterPath)
		await sql`UPDATE media SET has_raster = true WHERE filename = ${row.filename}`
		console.log(`  flagged existing raster: ${row.filename}`)
		ok++
		continue
	} catch {}

	try {
		const buffer = await readFile(row.filepath)
		const png = await sharp(buffer, { density: 192 })
			.resize(RASTER_WIDTH, undefined, { withoutEnlargement: false })
			.png()
			.toBuffer()
		await writeFile(rasterPath, png)
		await sql`UPDATE media SET has_raster = true WHERE filename = ${row.filename}`
		console.log(`  rasterized: ${row.filename}`)
		ok++
	} catch (cause) {
		console.error(`  failed: ${row.filename} —`, cause instanceof Error ? cause.message : cause)
		failed++
	}
}

console.log(`\nDone. ${ok} succeeded, ${failed} failed.`)
await sql.end()
