import { and, eq, inArray } from 'drizzle-orm'
import { validationError } from '$lib/application/errors.js'
import { db } from '$lib/server/db/index.js'
import { media, mediaAssetBindings, mediaVersions } from '$lib/feature/media/server/schema.server.js'
import { assessMediaCompatibility, parseMediaAssetBinding, type MediaAssetBinding, type MediaBindingProfile } from './media-binding.js'

export type MediaBindingDatabase = Pick<typeof db, 'delete' | 'insert' | 'select'>
export type MediaRecordDatabase = Pick<typeof db, 'insert' | 'select'>
export type MediaBindingRow = typeof mediaAssetBindings.$inferInsert

export async function resolvePinnedImageBinding(database: MediaBindingDatabase, raw: unknown, profile: MediaBindingProfile): Promise<MediaAssetBinding | null> {
	const binding = parseMediaAssetBinding(raw, profile.interpretation)
	if (!binding) return null
	const [current] = binding.mediaId
		? await database.select().from(media).where(eq(media.id, binding.mediaId)).limit(1)
		: await database.select().from(media).where(eq(media.filename, binding.filename)).limit(1)
	if (!current) throw validationError('media_asset_missing', `The selected ${profile.label} no longer exists in Media.`)
	if (!current.hash) throw validationError('media_hash_missing', `${current.filename} has no immutable content hash.`)
	const selectedHash = binding.contentHash ?? current.hash
	let revision: Pick<typeof current, 'mimeType' | 'width' | 'height' | 'hash'> | null = current.hash === selectedHash ? current : null
	if (!revision) {
		const [archived] = await database.select({ mimeType: mediaVersions.mimeType, width: mediaVersions.width, height: mediaVersions.height, hash: mediaVersions.hash }).from(mediaVersions).where(and(eq(mediaVersions.filename, current.filename), eq(mediaVersions.hash, selectedHash))).limit(1)
		revision = archived ?? null
	}
	if (!revision) throw validationError('media_revision_missing', `The pinned revision of ${current.filename} is no longer available.`)
	const compatibility = assessMediaCompatibility(revision, profile.compatibility)
	if (!compatibility.compatible) throw validationError('media_incompatible', `${current.filename} cannot be used as a ${profile.label}: ${compatibility.errors.join('; ')}`, compatibility)
	return { ...binding, mediaId: current.id, filename: current.filename, contentHash: selectedHash }
}

export async function replaceMediaBindingsForOwner(database: MediaBindingDatabase, ownerType: string, ownerId: number, rows: MediaBindingRow[]) {
	await database.delete(mediaAssetBindings).where(and(eq(mediaAssetBindings.ownerType, ownerType), eq(mediaAssetBindings.ownerId, ownerId)))
	if (rows.length > 0) await database.insert(mediaAssetBindings).values(rows)
}

export async function removeMediaBindingsForOwners(database: MediaBindingDatabase, ownerType: string, ownerIds: number[]) {
	if (ownerIds.length === 0) return
	await database.delete(mediaAssetBindings).where(and(eq(mediaAssetBindings.ownerType, ownerType), inArray(mediaAssetBindings.ownerId, ownerIds)))
}

export type MediaRecordInput = {
	filename: string
	filepath: string
	mimeType: string
	width: number | null
	height: number | null
	sizeBytes: number
	hash: string
	description: string
	originalFilename: string
	hasThumb150: boolean
	hasThumb300: boolean
	hasThumb600: boolean
	hasRaster: boolean
}

export async function findOrCreateMediaRecord(database: MediaRecordDatabase, input: MediaRecordInput) {
	const [existing] = await database.select().from(media).where(eq(media.filename, input.filename)).limit(1)
	if (existing) return { record: existing, created: false }
	const [record] = await database.insert(media).values(input).returning()
	return { record, created: true }
}
