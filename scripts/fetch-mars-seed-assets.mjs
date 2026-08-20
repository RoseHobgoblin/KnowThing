import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUTPUT = path.join(ROOT, 'static', 'seed-data', 'rodder', 'mars')
const RUNTIME = path.join(OUTPUT, 'runtime')
const SOURCE = path.join(OUTPUT, 'source')
const CACHE = path.join(tmpdir(), 'knowthing-mars-seed-sources')

const PRODUCTS = {
	color: {
		url: 'https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg',
		filename: 'mars_viking_mdim21_clrmosaic_1km.jpg',
		sha256: 'fdfcd335559c3dc67052b7e8a9565d850e336ac0d1f3ea7f5eb7826ffb44ecb2',
	},
	topography: {
		url: 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img',
		filename: 'MEGT90N000EB.IMG',
		sha256: 'd18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b',
	},
	topographyLabel: {
		url: 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl',
		filename: 'MEGT90N000EB.LBL',
		sha256: '0f2bd919dddb86d83489a008d3007bd915507c892a0f22ce49ad5dd5d2fc7d8a',
	},
	bolometricAlbedo: {
		url: 'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif',
		filename: 'Mars_MGS_TES_Albedo_mosaic_global_7410m.tif',
		sha256: 'c91dfcaa1834b96db383beddec537d85e8e82b782682744ee723907ed9e58178',
	},
	bolometricAlbedoLabel: {
		url: 'https://astrogeology.usgs.gov/ckan/dataset/a5083068-715f-448d-9ff7-463a72d7c903/resource/77cb978e-f586-4b04-a28f-1d6d5dfc8488/download/mars_mgs_tes_albedo_mosaic_global_7410m.lbl',
		filename: 'Mars_MGS_TES_Albedo_mosaic_global_7410m.LBL',
		sha256: '674be9e18a8bf7498f134800a8a555bbb112de67dff8d072b4a9e31f12568a64',
	},
	planetaryConstants: {
		url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
		filename: 'pck00011.tpc',
		sha256: '3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1',
	},
}

async function sha256(path) {
	return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function download(product) {
	const cachePath = path.join(CACHE, product.filename)
	let cached = false
	try {
		await readFile(cachePath)
		cached = true
	} catch {
		// Populate the reusable OS-level cache below.
	}
	if (!cached) {
		const response = await fetch(product.url, { redirect: 'follow' })
		if (!response.ok) throw new Error(`Could not fetch ${product.url}: ${response.status} ${response.statusText}`)
		await writeFile(cachePath, Buffer.from(await response.arrayBuffer()))
	}
	const actualHash = await sha256(cachePath)
	if (actualHash !== product.sha256) {
		throw new Error(`Source checksum changed for ${product.url}: expected ${product.sha256}, received ${actualHash}`)
	}
	return cachePath
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
	let crc = value
	for (let bit = 0; bit < 8; bit++) crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
	return crc >>> 0
})

function pngChunk(type, data) {
	const name = Buffer.from(type, 'ascii')
	const length = Buffer.allocUnsafe(4)
	length.writeUInt32BE(data.length)
	let crc = 0xFFFFFFFF
	for (const byte of Buffer.concat([name, data])) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
	const checksum = Buffer.allocUnsafe(4)
	checksum.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0)
	return Buffer.concat([length, name, data, checksum])
}

async function writeGrayscalePng16(path, width, height, samples) {
	const header = Buffer.alloc(13)
	header.writeUInt32BE(width, 0)
	header.writeUInt32BE(height, 4)
	header[8] = 16 // bit depth
	header[9] = 0 // grayscale
	const scanlines = Buffer.allocUnsafe(height * (1 + width * 2))
	for (let y = 0; y < height; y++) {
		const row = y * (1 + width * 2)
		scanlines[row] = 0 // no filter: deterministic and lossless
		for (let x = 0; x < width; x++) scanlines.writeUInt16BE(samples[y * width + x], row + 1 + x * 2)
	}
	await writeFile(path, Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
		pngChunk('IEND', Buffer.alloc(0)),
	]))
}

async function deriveColor(sourcePath) {
	const outputPath = path.join(RUNTIME, 'mars-mdim21-color-4096x2048.webp')
	await sharp(sourcePath)
		.resize(4096, 2048, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.webp({ quality: 92, smartSubsample: true })
		.toFile(outputPath)
	return outputPath
}

async function deriveTopography(sourcePath) {
	const width = 5760
	const height = 2880
	const minimumM = -8177
	const maximumM = 21171
	const source = await readFile(sourcePath)
	if (source.length !== width * height * 2) {
		throw new Error(`Unexpected MOLA byte length: ${source.length}`)
	}

	const pixels = Buffer.allocUnsafe(width * height)
	let observedMinimum = Infinity
	let observedMaximum = -Infinity
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// MEGDR is 0..360 east. Roll it to the renderer's -180..180 plate.
			const sourceX = (x + width / 2) % width
			const elevationM = source.readInt16BE((y * width + sourceX) * 2)
			observedMinimum = Math.min(observedMinimum, elevationM)
			observedMaximum = Math.max(observedMaximum, elevationM)
			const encoded = Math.round(((elevationM - minimumM) / (maximumM - minimumM)) * 65535)
			pixels[y * width + x] = Math.min(255, Math.max(0, Math.round(encoded / 257)))
		}
	}
	if (observedMinimum !== minimumM || observedMaximum !== maximumM) {
		throw new Error(`Unexpected MOLA range: ${observedMinimum}..${observedMaximum} m`)
	}

	const outputPath = path.join(RUNTIME, 'mars-mola-megdr-topography-4096x2048.png')
	await sharp(pixels, { raw: { width, height, channels: 1 } })
		.resize(4096, 2048, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.png({ compressionLevel: 9, palette: false })
		.toFile(outputPath)
	return outputPath
}

async function deriveBolometricAlbedo(sourcePath) {
	const width = 1440
	const height = 720
	const { data, info } = await sharp(sourcePath)
		.resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.raw({ depth: 'float' })
		.toBuffer({ resolveWithObject: true })
	if (info.width !== width || info.height !== height || info.channels < 1) {
		throw new Error(`Unexpected TES raster: ${JSON.stringify(info)}`)
	}

	const pixels = new Uint16Array(width * height)
	let observedMinimum = Infinity
	let observedMaximum = -Infinity
	for (let index = 0; index < width * height; index++) {
		// libvips expands the one-band floating-point TIFF to repeated RGB
		// samples for raw output. Read the first sample of each pixel.
		const value = data.readFloatLE(index * info.channels * 4)
		if (Number.isFinite(value)) {
			observedMinimum = Math.min(observedMinimum, value)
			observedMaximum = Math.max(observedMaximum, value)
		}
		const encoded = Number.isFinite(value) ? Math.round(Math.min(1, Math.max(0, value)) * 65535) : 0
		pixels[index] = encoded
	}
	if (observedMinimum < 0 || observedMaximum > 1) {
		throw new Error(`TES albedo falls outside the expected 0..1 fraction: ${observedMinimum}..${observedMaximum}`)
	}

	const outputPath = path.join(RUNTIME, 'mars-tes-bolometric-albedo-1440x720.png')
	await writeGrayscalePng16(outputPath, width, height, pixels)
	return { path: outputPath, observedMinimum, observedMaximum }
}

await Promise.all([mkdir(CACHE, { recursive: true }), mkdir(RUNTIME, { recursive: true }), mkdir(SOURCE, { recursive: true })])
const downloaded = Object.fromEntries(await Promise.all(
	Object.entries(PRODUCTS).map(async ([key, product]) => [key, await download(product)]),
))

const [colorPath, topographyPath, albedo] = await Promise.all([
	deriveColor(downloaded.color),
	deriveTopography(downloaded.topography),
	deriveBolometricAlbedo(downloaded.bolometricAlbedo),
])

for (const key of ['topographyLabel', 'bolometricAlbedoLabel', 'planetaryConstants']) {
	await copyFile(downloaded[key], path.join(SOURCE, path.basename(downloaded[key])))
}


for (const output of [colorPath, topographyPath, albedo.path, ...Object.values(downloaded)]) {
	const buffer = await readFile(output)
	console.log(JSON.stringify({
		file: output.startsWith(ROOT) ? output.slice(ROOT.length + 1).replaceAll('\\', '/') : output,
		bytes: buffer.length,
		sha256: await sha256(output),
	}))
}
console.log(JSON.stringify({ tesAlbedoRange: [albedo.observedMinimum, albedo.observedMaximum] }))
