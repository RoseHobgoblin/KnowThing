import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentRecords, media } from '$lib/server/db/schema.js'
import {
	parseWikitext,
	extractImagesFromAst,
	extractInfoboxFromRefs,
	extractInfoboxImageRef,
	stripMarkup,
} from '$lib/parser/index.js'
import { resolveAllStructuredData } from '$lib/server/structured-data.js'
import type { WikiNode } from '$lib/parser/types.js'

export interface PageCard {
	title: string
	description: string
	image: string | null
	imageMimeType: string | null
	imageHasRaster: boolean
	imageWidth: number | null
	imageHeight: number | null
}

export async function getPageCard(slug: string, domain = 'know'): Promise<PageCard | null> {
	const [record] = await db
		.select({
			title: contentRecords.title,
			content: contentRecords.content,
			plainText: contentRecords.plainText,
			parsedAst: contentRecords.parsedAst,
		})
		.from(contentRecords)
		.where(and(eq(contentRecords.domain, domain), sql`LOWER(${contentRecords.slug}) = LOWER(${slug})`))
		.limit(1)

	if (!record) return null

	const ast = (record.parsedAst as WikiNode) ?? parseWikitext(record.content)
	const imageFilename = await resolveCardImage(ast)
	const mediaRow = imageFilename ? await lookupMedia(imageFilename) : null

	return {
		title: record.title,
		description: buildDescription(record.plainText || stripMarkup(record.content)),
		image: imageFilename,
		imageMimeType: mediaRow?.mimeType ?? null,
		imageHasRaster: mediaRow?.hasRaster ?? false,
		imageWidth: mediaRow?.width ?? null,
		imageHeight: mediaRow?.height ?? null,
	}
}

async function resolveCardImage(ast: WikiNode): Promise<string | null> {
	const infoboxRef = extractInfoboxImageRef(ast)
	if (infoboxRef?.image) return infoboxRef.image
	if (infoboxRef?.fromSlug) {
		const fromRefs = extractInfoboxFromRefs(ast)
		const resolved = await resolveAllStructuredData(fromRefs)
		const fields = resolved.get(infoboxRef.fromSlug)
		const image = fields?.get('image')
		if (image) return image
	}
	return extractImagesFromAst(ast)[0] ?? null
}

/**
 * Resolve card image from an already-parsed AST + already-resolved structured
 * data — avoids re-querying when the caller (page load) already has them.
 */
export function resolveCardImageSync(
	ast: WikiNode,
	structuredData: Record<string, Record<string, string>> | null,
): string | null {
	const infoboxRef = extractInfoboxImageRef(ast)
	if (infoboxRef?.image) return infoboxRef.image
	if (infoboxRef?.fromSlug && structuredData?.[infoboxRef.fromSlug]?.image) {
		return structuredData[infoboxRef.fromSlug].image
	}
	return extractImagesFromAst(ast)[0] ?? null
}

export async function lookupMediaInfo(filename: string) {
	return lookupMedia(filename)
}

async function lookupMedia(filename: string) {
	const [row] = await db
		.select({
			mimeType: media.mimeType,
			hasRaster: media.hasRaster,
			width: media.width,
			height: media.height,
		})
		.from(media)
		.where(eq(media.filename, filename))
		.limit(1)
	return row ?? null
}

export function buildDescription(plainText: string, maxLength = 200): string {
	const clean = plainText.replaceAll(/\s+/g, ' ').trim()
	if (clean.length <= maxLength) return clean
	const truncated = clean.slice(0, maxLength)
	const lastSpace = truncated.lastIndexOf(' ')
	return `${truncated.slice(0, lastSpace > 120 ? lastSpace : truncated.length).trimEnd()}...`
}

/**
 * Build an absolute URL for the card image, preferring the rasterized PNG when
 * the source is SVG (Discord/Slack/Twitter won't embed SVG).
 */
export function buildCardImageUrl(origin: string, card: PageCard): string | null {
	if (!card.image) return null
	const base = `${origin}/api/media/${encodeURIComponent(card.image)}`
	if (card.imageMimeType === 'image/svg+xml') {
		return card.imageHasRaster ? `${base}?raster=1` : null
	}
	return base
}
