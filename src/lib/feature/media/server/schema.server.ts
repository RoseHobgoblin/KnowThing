import { sql } from 'drizzle-orm'
import {
	pgTable,
	serial,
	text,
	integer,
	bigint,
	doublePrecision,
	timestamp,
	boolean,
	jsonb,
	primaryKey,
	index,
	uniqueIndex,
	unique,
	customType,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/**
 * Postgres tsvector. Maintained by DB triggers (see drizzle/0006, 0040) —
 * declared here so the ORM knows the FTS layer exists; never written from app code.
 */
const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector'
	},
})

// ============================================================================
// Users & Auth
// ============================================================================

import { users } from '$lib/server/db/core-schema.js'

export const media = pgTable('media', {
	id: serial('id').primaryKey(),
	filename: text('filename').unique().notNull(),
	filepath: text('filepath').notNull(),
	mimeType: text('mime_type'),
	width: integer('width'),
	height: integer('height'),
	sizeBytes: integer('size_bytes'),
	hash: text('hash'),
	description: text('description'),
	uploadedBy: integer('uploaded_by').references(() => users.id),
	originalFilename: text('original_filename'),
	hasThumb150: boolean('has_thumb_150').default(false),
	hasThumb300: boolean('has_thumb_300').default(false),
	hasThumb600: boolean('has_thumb_600').default(false),
	hasRaster: boolean('has_raster').default(false),
	uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
})


export const mediaHistory = pgTable(
	'media_history',
	{
		id: serial('id').primaryKey(),
		filename: text('filename').notNull(),
		userId: integer('user_id').references(() => users.id),
		action: text('action').notNull(), // 'upload', 'reupload', 'delete', 'describe'
		details: text('details'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [index('idx_media_history_filename').on(table.filename)],
)


export const mediaVersions = pgTable(
	'media_versions',
	{
		id: serial('id').primaryKey(),
		filename: text('filename').notNull(),
		version: integer('version').notNull(),
		filepath: text('filepath').notNull(),
		mimeType: text('mime_type'),
		width: integer('width'),
		height: integer('height'),
		sizeBytes: integer('size_bytes'),
		hash: text('hash'),
		uploadedBy: integer('uploaded_by').references(() => users.id),
		archivedAt: timestamp('archived_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [index('idx_media_versions_filename').on(table.filename)],
)


export const mediaCategories = pgTable(
	'media_categories',
	{
		filename: text('filename').notNull(),
		category: text('category').notNull(),
	},
	table => [
		primaryKey({ columns: [table.filename, table.category] }),
		index('idx_media_categories_cat').on(table.category),
	],
)

// ============================================================================
// Wordbook: Languages & Lexicon
// ============================================================================


export const mediaAssetBindings = pgTable(
	'media_asset_bindings',
	{
		id: serial('id').primaryKey(),
		mediaId: integer('media_id').references(() => media.id, { onDelete: 'restrict' }).notNull(),
		ownerType: text('owner_type').notNull(),
		ownerId: integer('owner_id').notNull(),
		slot: text('slot').notNull(),
		contentHash: text('content_hash').notNull(),
		filenameSnapshot: text('filename_snapshot').notNull(),
		interpretation: jsonb('interpretation').default({}).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		uniqueIndex('uidx_media_asset_binding_owner_slot').on(table.ownerType, table.ownerId, table.slot),
		index('idx_media_asset_bindings_media').on(table.mediaId),
		index('idx_media_asset_bindings_owner').on(table.ownerType, table.ownerId),
	],
)

// ============================================================================
// World Maps & Countries
// ============================================================================

