import {
	pgTable,
	serial,
	text,
	integer,
	timestamp,
	boolean,
	jsonb,
	primaryKey,
	index
} from 'drizzle-orm/pg-core';

// ============================================================================
// Users & Auth
// ============================================================================

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: text('username').unique().notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role').notNull().default('editor'), // 'admin' | 'editor'
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable('sessions', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	token: text('token').unique().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

// ============================================================================
// Pages & Revisions
// ============================================================================

export const pages = pgTable(
	'pages',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').unique().notNull(),
		title: text('title').notNull(),
		content: text('content').notNull().default(''),
		plainText: text('plain_text').notNull().default(''), // stripped markup for FTS
		sizeBytes: integer('size_bytes').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_pages_slug').on(table.slug),
		index('idx_pages_updated').on(table.updatedAt)
	]
);

export const revisions = pgTable(
	'revisions',
	{
		id: serial('id').primaryKey(),
		pageId: integer('page_id')
			.references(() => pages.id, { onDelete: 'cascade' })
			.notNull(),
		pageSlug: text('page_slug').notNull(),
		title: text('title').notNull(),
		content: text('content').notNull(),
		sizeBytes: integer('size_bytes').notNull().default(0),
		editSummary: text('edit_summary').default(''),
		userId: integer('user_id').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_revisions_page').on(table.pageSlug),
		index('idx_revisions_date').on(table.createdAt)
	]
);

// ============================================================================
// Templates (DB-stored simple templates for the hybrid system)
// ============================================================================

export const templates = pgTable('templates', {
	id: serial('id').primaryKey(),
	name: text('name').unique().notNull(),
	source: text('source').notNull(),
	description: text('description').default(''),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Calendars (JSONB for the complex config)
// ============================================================================

export const calendars = pgTable('calendars', {
	id: serial('id').primaryKey(),
	name: text('name').unique().notNull(),
	description: text('description').default(''),
	isPrimary: boolean('is_primary').default(false).notNull(),
	staticData: jsonb('static_data').notNull(), // months, weekdays, leap days, moons, eras, seasons
	calendarDate: jsonb('calendar_date').notNull() // { year, monthIndex, day }
});

// ============================================================================
// Link & Category tracking
// ============================================================================

export const links = pgTable(
	'links',
	{
		sourceSlug: text('source_slug').notNull(),
		targetSlug: text('target_slug').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.sourceSlug, table.targetSlug] }),
		index('idx_links_target').on(table.targetSlug)
	]
);

export const categories = pgTable(
	'categories',
	{
		pageSlug: text('page_slug').notNull(),
		category: text('category').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.pageSlug, table.category] }),
		index('idx_categories_cat').on(table.category)
	]
);

// ============================================================================
// Media
// ============================================================================

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
	uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull()
});

export const mediaHistory = pgTable(
	'media_history',
	{
		id: serial('id').primaryKey(),
		filename: text('filename').notNull(),
		userId: integer('user_id').references(() => users.id),
		action: text('action').notNull(), // 'upload', 'reupload', 'delete', 'describe'
		details: text('details'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('idx_media_history_filename').on(table.filename)]
);

export const mediaCategories = pgTable(
	'media_categories',
	{
		filename: text('filename').notNull(),
		category: text('category').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.filename, table.category] }),
		index('idx_media_categories_cat').on(table.category)
	]
);

export const mediaUsage = pgTable(
	'media_usage',
	{
		pageSlug: text('page_slug').notNull(),
		filename: text('filename').notNull()
	},
	(table) => [primaryKey({ columns: [table.pageSlug, table.filename] })]
);

// ============================================================================
// Wordbook: Languages & Lexicon
// ============================================================================

export const languages = pgTable(
	'languages',
	{
		id: serial('id').primaryKey(),
		name: text('name').unique().notNull(),
		slug: text('slug').unique().notNull(),
		nativeName: text('native_name'),
		script: text('script').default('Latin'),
		family: text('family'),
		color: text('color').default('#d97706'),
		description: text('description'),
		pageSlug: text('page_slug'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_languages_slug').on(table.slug)
	]
);

export const lexicon = pgTable(
	'lexicon',
	{
		id: serial('id').primaryKey(),
		word: text('word').notNull(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		pronunciation: text('pronunciation'),
		partOfSpeech: text('part_of_speech'),
		definition: text('definition').notNull(),
		etymology: text('etymology'),
		usageExample: text('usage_example'),
		usageTranslation: text('usage_translation'),
		notes: text('notes'),
		pageSlug: text('page_slug'),
		tags: text('tags').array().default([]),
		related: text('related').array().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_lexicon_word').on(table.word),
		index('idx_lexicon_language').on(table.languageId)
	]
);

export const lexiconRelations = pgTable(
	'lexicon_relations',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		targetId: integer('target_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		relationType: text('relation_type').notNull(), // 'derived_from', 'loan_from', 'compound_of'
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_lexrel_source').on(table.sourceId),
		index('idx_lexrel_target').on(table.targetId)
	]
);
