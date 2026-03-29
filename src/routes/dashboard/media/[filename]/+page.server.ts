import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { media, mediaHistory, mediaCategories, contentMediaUsage, contentRecords, users } from '$lib/server/db/schema.js'
import { eq, desc, sql } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/auth/login')

	const filename = decodeURIComponent(params.filename)

	const [file] = await db
		.select({
			id: media.id,
			filename: media.filename,
			filepath: media.filepath,
			mimeType: media.mimeType,
			width: media.width,
			height: media.height,
			sizeBytes: media.sizeBytes,
			hash: media.hash,
			description: media.description,
			uploadedBy: media.uploadedBy,
			originalFilename: media.originalFilename,
			hasThumb150: media.hasThumb150,
			hasThumb300: media.hasThumb300,
			hasThumb600: media.hasThumb600,
			uploadedAt: media.uploadedAt,
		})
		.from(media)
		.where(eq(media.filename, filename))

	if (!file) error(404, 'File not found')

	// Get uploader name
	let uploaderName: string | null = null
	if (file.uploadedBy) {
		const [uploader] = await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, file.uploadedBy))
		uploaderName = uploader?.username || null
	}

	// Get categories
	const cats = await db
		.select({ category: mediaCategories.category })
		.from(mediaCategories)
		.where(eq(mediaCategories.filename, filename))

	// Get usage
	const usage = await db
		.select({ pageSlug: contentRecords.slug })
		.from(contentMediaUsage)
		.innerJoin(contentRecords, eq(contentMediaUsage.contentRecordId, contentRecords.id))
		.where(eq(contentMediaUsage.filename, filename))

	// Get history
	const history = await db
		.select({
			id: mediaHistory.id,
			action: mediaHistory.action,
			details: mediaHistory.details,
			createdAt: mediaHistory.createdAt,
			username: users.username,
		})
		.from(mediaHistory)
		.leftJoin(users, eq(mediaHistory.userId, users.id))
		.where(eq(mediaHistory.filename, filename))
		.orderBy(desc(mediaHistory.createdAt))
		.limit(50)

	return {
		file,
		uploaderName,
		categories: cats.map(c => c.category),
		usage: usage.map(u => u.pageSlug),
		history,
	}
}
