import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { desc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { contentMediaUsage, contentRecords, media, mediaCategories, mediaHistory, users } from '$lib/server/db/schema.js'

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

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

	if (!file) throw error(404, 'File not found')

	let uploaderName: string | null = null
	if (file.uploadedBy) {
		const [uploader] = await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.id, file.uploadedBy))
		uploaderName = uploader?.username || null
	}

	const categories = await db
		.select({ category: mediaCategories.category })
		.from(mediaCategories)
		.where(eq(mediaCategories.filename, filename))

	const usage = await db
		.select({ pageSlug: contentRecords.slug })
		.from(contentMediaUsage)
		.innerJoin(contentRecords, eq(contentMediaUsage.contentRecordId, contentRecords.id))
		.where(eq(contentMediaUsage.filename, filename))

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
		categories: categories.map(category => category.category),
		usage: usage.map(item => item.pageSlug),
		history,
	}
}
