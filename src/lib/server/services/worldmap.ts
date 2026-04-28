import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db/index.js'
import { contentRecords, countries, media, worldMapRegionGeometry, worldMapRegions, worldMaps } from '$lib/server/db/schema.js'
import { and, eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

const COLOR_QUANTIZATION_STEP = Math.max(1, Number.parseInt(env.WORLDMAP_COLOR_QUANTIZATION_STEP || '64', 10))
const MIN_REGION_PIXEL_COUNT = Math.max(1, Number.parseInt(env.WORLDMAP_MIN_REGION_PIXELS || '24', 10))

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
	return Math.max(0, Math.min(255, Math.floor(channel / COLOR_QUANTIZATION_STEP) * COLOR_QUANTIZATION_STEP))
}

function quantizedHex(r: number, g: number, b: number) {
	return toHex(quantizeChannel(r), quantizeChannel(g), quantizeChannel(b))
}

function parseSvgColor(value: string) {
	const trimmed = value.trim()
	if (trimmed.startsWith('#')) {
		const normalized = trimmed.length === 4
			? `#${trimmed.slice(1).split('').map((char) => `${char}${char}`).join('')}`
			: trimmed
		return normalizeHex(normalized)
	}

	const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
	if (rgbMatch) {
		return toHex(
			Number.parseInt(rgbMatch[1], 10),
			Number.parseInt(rgbMatch[2], 10),
			Number.parseInt(rgbMatch[3], 10),
		)
	}

	return null
}

function getAttribute(source: string, name: string) {
	const match = source.match(new RegExp(String.raw`\b${name}\s*=\s*("([^"]*)"|'([^']*)')`, 'i'))
	return match?.[2] ?? match?.[3] ?? null
}

function getStyleValue(style: string | null, name: string) {
	if (!style) return null
	const match = style.match(new RegExp(String.raw`(?:^|;)\s*${name}\s*:\s*([^;]+)`, 'i'))
	return match?.[1]?.trim() ?? null
}

function extractClassFillMap(svgSource: string) {
	const classFillMap = new Map<string, string>()
	const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
	let styleMatch: RegExpExecArray | null

	while ((styleMatch = styleBlockRegex.exec(svgSource))) {
		const stylesheet = styleMatch[1]
		const ruleRegex = /([^{}]+)\{([^}]*)\}/g
		let ruleMatch: RegExpExecArray | null

		while ((ruleMatch = ruleRegex.exec(stylesheet))) {
			const selectors = ruleMatch[1].split(',').map((selector) => selector.trim()).filter(Boolean)
			const fillValue = getStyleValue(ruleMatch[2], 'fill')
			if (!fillValue) continue

			for (const selector of selectors) {
				const classMatches = selector.match(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)
				if (!classMatches) continue
				for (const classToken of classMatches) {
					classFillMap.set(classToken.slice(1), fillValue.trim())
				}
			}
		}
	}

	return classFillMap
}

function resolveClassFill(attributes: string, classFillMap: Map<string, string>) {
	const classAttribute = getAttribute(attributes, 'class')
	if (!classAttribute) return null

	const classNames = classAttribute.split(/\s+/).filter(Boolean)
	for (let index = classNames.length - 1; index >= 0; index -= 1) {
		const fill = classFillMap.get(classNames[index])
		if (fill) {
			return fill
		}
	}

	return null
}

function resolveEffectiveFill(attributes: string, inheritedFill: string | null, classFillMap: Map<string, string>) {
	const inlineStyleFill = getStyleValue(getAttribute(attributes, 'style'), 'fill')
	if (inlineStyleFill) return inlineStyleFill

	const attributeFill = getAttribute(attributes, 'fill')
	if (attributeFill) return attributeFill

	const classFill = resolveClassFill(attributes, classFillMap)
	if (classFill) return classFill

	return inheritedFill
}

function pointsToPathData(pointsRaw: string) {
	const points = pointsRaw.trim().split(/\s+/).map((pair) => pair.split(',').map((value) => Number.parseFloat(value)))
	if (points.length === 0 || points.some((pair) => pair.length !== 2 || pair.some((value) => !Number.isFinite(value)))) {
		return null
	}

	return `M ${points[0][0]} ${points[0][1]} ${points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`
}

function rectToPathData(attributes: string) {
	const x = Number.parseFloat(getAttribute(attributes, 'x') ?? '0')
	const y = Number.parseFloat(getAttribute(attributes, 'y') ?? '0')
	const width = Number.parseFloat(getAttribute(attributes, 'width') ?? '')
	const height = Number.parseFloat(getAttribute(attributes, 'height') ?? '')
	if (![x, y, width, height].every((value) => Number.isFinite(value))) {
		return null
	}

	return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
}

function circleToPathData(attributes: string) {
	const cx = Number.parseFloat(getAttribute(attributes, 'cx') ?? '0')
	const cy = Number.parseFloat(getAttribute(attributes, 'cy') ?? '0')
	const r = Number.parseFloat(getAttribute(attributes, 'r') ?? '')
	if (![cx, cy, r].every((value) => Number.isFinite(value))) {
		return null
	}

	return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
}

function ellipseToPathData(attributes: string) {
	const cx = Number.parseFloat(getAttribute(attributes, 'cx') ?? '0')
	const cy = Number.parseFloat(getAttribute(attributes, 'cy') ?? '0')
	const rx = Number.parseFloat(getAttribute(attributes, 'rx') ?? '')
	const ry = Number.parseFloat(getAttribute(attributes, 'ry') ?? '')
	if (![cx, cy, rx, ry].every((value) => Number.isFinite(value))) {
		return null
	}

	return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
}

function parseSvgShapeToPathData(tagName: string, attributes: string) {
	if (tagName === 'path') {
		return getAttribute(attributes, 'd')
	}

	if (tagName === 'rect') {
		return rectToPathData(attributes)
	}

	if (tagName === 'polygon') {
		const points = getAttribute(attributes, 'points')
		return points ? pointsToPathData(points) : null
	}

	if (tagName === 'polyline') {
		const points = getAttribute(attributes, 'points')
		return points ? pointsToPathData(points) : null
	}

	if (tagName === 'circle') {
		return circleToPathData(attributes)
	}

	if (tagName === 'ellipse') {
		return ellipseToPathData(attributes)
	}

	return null
}

function extractSvgDimensions(svgSource: string) {
	const svgOpenTag = svgSource.match(/<svg\b([^>]*)>/i)
	if (!svgOpenTag) {
		throw error(400, 'Could not read SVG root element')
	}

	const svgAttributes = svgOpenTag[1]
	const widthValue = Number.parseFloat(getAttribute(svgAttributes, 'width') ?? '')
	const heightValue = Number.parseFloat(getAttribute(svgAttributes, 'height') ?? '')
	const viewBoxValue = getAttribute(svgAttributes, 'viewBox')

	if (Number.isFinite(widthValue) && Number.isFinite(heightValue)) {
		return { width: widthValue, height: heightValue }
	}

	if (viewBoxValue) {
		const parts = viewBoxValue.trim().split(/\s+/).map((value) => Number.parseFloat(value))
		if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
			return { width: parts[2], height: parts[3] }
		}
	}

	throw error(400, 'Could not read SVG dimensions from world map file')
}

function extractPathGeometryFromSvg(svgSource: string, waterHexRaw: string) {
	const waterHex = normalizeHex(waterHexRaw)
	const waterRgb = hexToRgb(waterHex)
	const waterQuantizedHex = quantizedHex(waterRgb.r, waterRgb.g, waterRgb.b)
	const classFillMap = extractClassFillMap(svgSource)
	const tokenRegex = /<[^>]+>/g
	const colorPaths = new Map<string, string[]>()
	const fillStack: Array<string | null> = []
	const transformStack: Array<string | null> = []
	const shapeTags = new Set(['path', 'rect', 'polygon', 'polyline', 'circle', 'ellipse'])
	let match: RegExpExecArray | null
	let ignoredPathCount = 0

	while ((match = tokenRegex.exec(svgSource))) {
		const token = match[0]
		if (token.startsWith('<!--') || token.startsWith('<!') || token.startsWith('<?')) {
			continue
		}

		const closingMatch = token.match(/^<\s*\/\s*([A-Za-z][A-Za-z0-9:_-]*)\s*>$/)
		if (closingMatch) {
			if (fillStack.length > 0) {
				fillStack.pop()
				transformStack.pop()
			}
			continue
		}

		const openingMatch = token.match(/^<\s*([A-Za-z][A-Za-z0-9:_-]*)([^>]*)>$/)
		if (!openingMatch) {
			continue
		}

		const tagName = openingMatch[1].toLowerCase()
		const attributes = openingMatch[2]
		const isSelfClosing = /\/\s*>$/.test(token)
		const inheritedFill = fillStack.length > 0 ? fillStack.at(-1) ?? null : null
		const effectiveFill = resolveEffectiveFill(attributes, inheritedFill, classFillMap)
		const localTransform = getAttribute(attributes, 'transform')

		if (shapeTags.has(tagName)) {
			let pathData = parseSvgShapeToPathData(tagName, attributes)
			if (!pathData) {
				ignoredPathCount += 1
			} else if (!effectiveFill || effectiveFill.toLowerCase() === 'none') {
				ignoredPathCount += 1
			} else {
				const normalizedFill = parseSvgColor(effectiveFill)
				if (!normalizedFill) {
					ignoredPathCount += 1
				} else {
					const { r, g, b } = hexToRgb(normalizedFill)
					const hex = quantizedHex(r, g, b)
					if (hex !== waterQuantizedHex) {
						let activeTransform = [...transformStack, localTransform].filter(Boolean).join(' ').trim()
						if (activeTransform) {
							pathData = `T:${activeTransform}|${pathData}`
						}
						const currentPaths = colorPaths.get(hex)
						if (currentPaths) {
							currentPaths.push(pathData)
						} else {
							colorPaths.set(hex, [pathData])
						}
					}
				}
			}
		}

		if (!isSelfClosing) {
			fillStack.push(effectiveFill)
			transformStack.push(localTransform)
		}
	}

	return {
		colors: Array.from(colorPaths.keys()).sort(),
		pathsByColor: colorPaths,
		ignoredColorCount: ignoredPathCount,
	}
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

async function resolveMapSource(imageFilename: string) {
	const [mediaRecord] = await db
		.select({ filepath: media.filepath, mimeType: media.mimeType })
		.from(media)
		.where(eq(media.filename, imageFilename))
		.limit(1)

	if (mediaRecord?.filepath) {
		return mediaRecord
	}

	const uploadDir = env.UPLOAD_DIR || './uploads'
	return {
		filepath: join(uploadDir, imageFilename),
		mimeType: imageFilename.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : null,
	}
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

async function extractMapRegionsAndGeometry(filePath: string, mimeType: string | null, waterHex: string) {
	if (mimeType === 'image/svg+xml') {
		const svgSource = await readFile(filePath, 'utf8')
		const dimensions = extractSvgDimensions(svgSource)
		const extracted = extractPathGeometryFromSvg(svgSource, waterHex)

		return {
			colors: extracted.colors,
			pathsByColor: extracted.pathsByColor,
			width: dimensions.width,
			height: dimensions.height,
			ignoredColorCount: extracted.ignoredColorCount,
		}
	}

	const rasterExtracted = await extractUniqueNonWaterHexColors(filePath, waterHex)
	return {
		colors: rasterExtracted.colors,
		pathsByColor: null as Map<string, string[]> | null,
		width: rasterExtracted.width,
		height: rasterExtracted.height,
		ignoredColorCount: rasterExtracted.ignoredColorCount,
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

	const source = await resolveMapSource(map.imageFilename)
	const extracted = await extractMapRegionsAndGeometry(source.filepath, source.mimeType, map.waterHex)

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

			if (extracted.pathsByColor) {
				const regionPaths = extracted.pathsByColor.get(hexColor) ?? []
				if (regionPaths.length > 0) {
					const [regionRecord] = await tx
						.select({ id: worldMapRegions.id })
						.from(worldMapRegions)
						.where(and(eq(worldMapRegions.mapId, map.id), eq(worldMapRegions.hexColor, hexColor)))
						.limit(1)

					if (regionRecord) {
						await tx.insert(worldMapRegionGeometry).values(
							regionPaths.map((pathData, index) => ({
								regionId: regionRecord.id,
								pathData,
								sortOrder: index,
							})),
						)
					}
				}
			}
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

			if (pageSlug === 'NOTHING') {
				await tx
					.update(countries)
					.set({
						pageSlug: 'NOTHING',
						contentRecordId: null,
						name: 'NOTHING',
						updatedAt: new Date(),
					})
					.where(eq(countries.id, region.countryId))
				continue
			}

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
