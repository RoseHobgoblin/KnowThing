import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentRecords, media } from '$lib/server/db/schema.js'
import {
	parseWikitext,
	extractImagesFromAst,
	extractInfoboxFromRefs,
	extractInfoboxImageRef,
	extractSummaryFromAst,
	getInfoboxImageFields,
} from '$lib/parser/index.js'
import { resolveAllStructuredData } from '$lib/composition/structured-data.server.js'
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
		description: extractSummaryFromAst(ast, { maxLength: 200 }),
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
		if (fields) {
			for (const field of getInfoboxImageFields(infoboxRef.subtype ?? 'generic')) {
				const value = fields.get(field)
				if (value) return value
			}
		}
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
	if (infoboxRef?.fromSlug) {
		const fields = structuredData?.[infoboxRef.fromSlug]
		if (fields) {
			for (const field of getInfoboxImageFields(infoboxRef.subtype ?? 'generic')) {
				const value = fields[field]
				if (value) return value
			}
		}
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
