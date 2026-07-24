import postgres from 'postgres'
import sharp from 'sharp'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://knowthing:knowthing@localhost:5432/knowthing'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs')
const RASTER_DIR = join(UPLOAD_DIR, 'rasters')
const RASTER_WIDTH = 1200
const THUMB_SIZES = [150, 300, 600] as const

const sql = postgres(DATABASE_URL)

await mkdir(RASTER_DIR, { recursive: true })
await mkdir(THUMB_DIR, { recursive: true })

const rows = await sql<{
	filename: string
	filepath: string
	hasRaster: boolean
	hasThumb150: boolean
	hasThumb300: boolean
	hasThumb600: boolean
}[]>`
  SELECT filename, filepath,
  	has_raster AS "hasRaster",
  	has_thumb_150 AS "hasThumb150",
  	has_thumb_300 AS "hasThumb300",
  	has_thumb_600 AS "hasThumb600"
  FROM media
  WHERE mime_type = 'image/svg+xml'
  	AND (has_raster = false
  	  OR has_thumb_150 = false
  	  OR has_thumb_300 = false
  	  OR has_thumb_600 = false)
`

console.log(`Found ${rows.length} SVG(s) needing raster work`)

let ok = 0
let failed = 0
for (const row of rows) {
	let buffer: Buffer | null = null

	try {
		const rasterPath = join(RASTER_DIR, `${row.filename}.png`)
		if (!row.hasRaster) {
			try {
				await access(rasterPath)
				await sql`UPDATE media SET has_raster = true WHERE filename = ${row.filename}`
				console.log(`  flagged existing raster: ${row.filename}`)
			} catch {
				if (!buffer) buffer = await readFile(row.filepath)
				const png = await sharp(buffer, { density: 192 })
					.resize(RASTER_WIDTH, undefined, { withoutEnlargement: false })
					.png()
					.toBuffer()
				await writeFile(rasterPath, png)
				await sql`UPDATE media SET has_raster = true WHERE filename = ${row.filename}`
				console.log(`  rasterized: ${row.filename}`)
			}
		}

		for (const size of THUMB_SIZES) {
			const flag = size === 150 ? row.hasThumb150 : (size === 300 ? row.hasThumb300 : row.hasThumb600)
			if (flag) continue

			const thumbPath = join(THUMB_DIR, `${size}_${row.filename}.png`)
			const flagColumn = size === 150 ? 'has_thumb_150' : (size === 300 ? 'has_thumb_300' : 'has_thumb_600')

			try {
				await access(thumbPath)
				await sql.unsafe(`UPDATE media SET ${flagColumn} = true WHERE filename = $1`, [row.filename])
				console.log(`  flagged existing thumb ${size}: ${row.filename}`)
				continue
			} catch {}

			if (!buffer) buffer = await readFile(row.filepath)
			const png = await sharp(buffer, { density: 192 })
				.resize(size, undefined, { withoutEnlargement: false })
				.png()
				.toBuffer()
			await writeFile(thumbPath, png)
			await sql.unsafe(`UPDATE media SET ${flagColumn} = true WHERE filename = $1`, [row.filename])
			console.log(`  thumb ${size}: ${row.filename}`)
		}

		ok++
	} catch (error) {
		console.error(`  failed: ${row.filename} —`, error instanceof Error ? error.message : error)
		failed++
	}
}

console.log(`\nDone. ${ok} succeeded, ${failed} failed.`)
await sql.end()
