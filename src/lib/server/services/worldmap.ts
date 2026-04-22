import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db/index.js'
import { contentRecords, countries, media, worldMapRegions, worldMaps } from '$lib/server/db/schema.js'
import { and, eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { join } from 'node:path'

const COLOR_QUANTIZATION_STEP = Math.max(1, Number.parseInt(env.WORLDMAP_COLOR_QUANTIZATION_STEP || '16', 10))
const MIN_REGION_PIXEL_COUNT = Math.max(1, Number.parseInt(env.WORLDMAP_MIN_REGION_PIXELS || '12', 10))

function toHex(r: number, g: number, b: number) {
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

function hexToRgb(hex: string) {
	const value = normalizeHex(hex).slice(1)
	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	}
}

function quantizeChannel(channel: number) {
	return Math.max(0, Math.min(255, Math.round(channel / COLOR_QUANTIZATION_STEP) * COLOR_QUANTIZATION_STEP))
}

function quantizedHex(r: number, g: number, b: number) {
	return toHex(quantizeChannel(r), quantizeChannel(g), quantizeChannel(b))
}

function normalizeHex(hex: string) {
	const trimmed = hex.trim().toUpperCase()
	if (!/^#[0-9A-F]{6}$/.test(trimmed)) {
		throw error(400, `Invalid hex color: ${hex}`)
	}
	return trimmed
}

function makeCountrySlug(mapId: number, hexColor: string) {
	return `wm-${mapId}-${hexColor.slice(1).toLowerCase()}`
}

async function resolveMapImagePath(imageFilename: string): Promise<string> {
	const [mediaRecord] = await db
		.select({ filepath: media.filepath })
		.from(media)
		.where(eq(media.filename, imageFilename))
		.limit(1)

	if (mediaRecord?.filepath) {
		return mediaRecord.filepath
	}

	const uploadDir = env.UPLOAD_DIR || './uploads'
	return join(uploadDir, imageFilename)
}

async function extractUniqueNonWaterHexColors(filePath: string, waterHexRaw: string) {
	const waterHex = normalizeHex(waterHexRaw)
	const waterRgb = hexToRgb(waterHex)
	const waterQuantizedHex = quantizedHex(waterRgb.r, waterRgb.g, waterRgb.b)
	const image = sharp(filePath)
	const metadata = await image.metadata()

	if (!metadata.width || !metadata.height) {
		throw error(400, 'Could not read image dimensions from world map file')
	}

	const { data, info } = await image
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true })

	const colorPixelCounts = new Map<string, number>()
	for (let index = 0; index < data.length; index += info.channels) {
		const alpha = data[index + 3]
		if (alpha === 0) continue
		const hex = quantizedHex(data[index], data[index + 1], data[index + 2])
		if (hex === waterQuantizedHex) continue
		const current = colorPixelCounts.get(hex) ?? 0
		colorPixelCounts.set(hex, current + 1)
	}

	const filtered = Array.from(colorPixelCounts.entries())
		.filter(([, pixelCount]) => pixelCount >= MIN_REGION_PIXEL_COUNT)
		.map(([hex]) => hex)
		.sort()

	return {
		colors: filtered,
		width: metadata.width,
		height: metadata.height,
		ignoredColorCount: colorPixelCounts.size - filtered.length,
	}
}

export async function ingestWorldMapBySlug(slugRaw: string) {
	const slug = slugRaw.trim().toLowerCase()
	const [map] = await db
		.select({
			id: worldMaps.id,
			slug: worldMaps.slug,
			imageFilename: worldMaps.imageFilename,
			waterHex: worldMaps.waterHex,
		})
		.from(worldMaps)
		.where(eq(worldMaps.slug, slug))
		.limit(1)

	if (!map) {
		throw error(404, 'Map not found')
	}

	const imagePath = await resolveMapImagePath(map.imageFilename)
	const extracted = await extractUniqueNonWaterHexColors(imagePath, map.waterHex)

	let createdCountries = 0
	await db.transaction(async (tx) => {
		await tx
			.update(worldMaps)
			.set({
				imageWidth: extracted.width,
				imageHeight: extracted.height,
				updatedAt: new Date(),
			})
			.where(eq(worldMaps.id, map.id))

		await tx.delete(worldMapRegions).where(eq(worldMapRegions.mapId, map.id))

		for (const hexColor of extracted.colors) {
			const countrySlug = makeCountrySlug(map.id, hexColor)
			let [country] = await tx
				.select({
					id: countries.id,
					slug: countries.slug,
				})
				.from(countries)
				.where(eq(countries.slug, countrySlug))
				.limit(1)

			if (!country) {
				[country] = await tx
					.insert(countries)
					.values({
						name: '',
						slug: countrySlug,
						pageSlug: '',
						color: hexColor,
						extra: {
							source: 'worldmap-ingest',
							mapId: map.id,
							hexColor,
						},
					})
					.returning({
						id: countries.id,
						slug: countries.slug,
					})
				createdCountries += 1
			}

			await tx.insert(worldMapRegions).values({
				mapId: map.id,
				countryId: country.id,
				hexColor,
				label: '',
			})
		}
	})

	return {
		mapId: map.id,
		mapSlug: map.slug,
		uniqueColorCount: extracted.colors.length,
		ignoredColorCount: extracted.ignoredColorCount,
		createdCountries,
		createdRegions: extracted.colors.length,
	}
}

export async function assignWorldMapRegionsToKnowPages(
	slugRaw: string,
	assignments: Array<{ regionId: number, pageSlug: string }>,
) {
	const slug = slugRaw.trim().toLowerCase()
	const [map] = await db
		.select({ id: worldMaps.id })
		.from(worldMaps)
		.where(eq(worldMaps.slug, slug))
		.limit(1)

	if (!map) {
		throw error(404, 'Map not found')
	}

	if (assignments.length === 0) {
		return { updatedCount: 0 }
	}

	const regions = await db
		.select({
			regionId: worldMapRegions.id,
			countryId: worldMapRegions.countryId,
		})
		.from(worldMapRegions)
		.where(eq(worldMapRegions.mapId, map.id))

	const regionById = new Map(regions.map((region) => [region.regionId, region]))

	const uniqueSlugs = Array.from(new Set(assignments.map((assignment) => assignment.pageSlug.trim()).filter(Boolean)))
	const pageRows = uniqueSlugs.length === 0
		? []
		: await db
			.select({
				id: contentRecords.id,
				slug: contentRecords.slug,
				title: contentRecords.title,
			})
			.from(contentRecords)
			.where(and(
				eq(contentRecords.domain, 'know'),
				inArray(contentRecords.slug, uniqueSlugs),
			))

	const pagesBySlug = new Map(pageRows.map((page) => [page.slug, page]))

	await db.transaction(async (tx) => {
		for (const assignment of assignments) {
			const region = regionById.get(assignment.regionId)
			if (!region) {
				throw error(400, `Region ${assignment.regionId} does not belong to this map`)
			}
			if (!region.countryId) {
				throw error(400, `Region ${assignment.regionId} has no country record`)
			}

			const pageSlug = assignment.pageSlug.trim()
			const page = pagesBySlug.get(pageSlug)
			if (!page) {
				throw error(400, `Know page not found: ${pageSlug}`)
			}

			await tx
				.update(countries)
				.set({
					pageSlug: page.slug,
					contentRecordId: page.id,
					name: page.title,
					updatedAt: new Date(),
				})
				.where(eq(countries.id, region.countryId))
		}
	})

	return { updatedCount: assignments.length }
}
