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


export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: text('username').unique().notNull(),
	displayUsername: text('display_username'),
	name: text('name').notNull(),
	email: text('email').unique().notNull(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	role: text('role').notNull().default('editor'), // 'owner' | 'admin' | 'editor' | 'viewer'
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})


export const sessions = pgTable('sessions', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	token: text('token').unique().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
})


export const accounts = pgTable(
	'accounts',
	{
		id: serial('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: integer('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_accounts_user_id').on(table.userId),
		uniqueIndex('uq_accounts_provider_account').on(table.providerId, table.accountId),
	],
)


export const verifications = pgTable(
	'verifications',
	{
		id: serial('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [index('idx_verifications_identifier').on(table.identifier)],
)

/** Better Auth's own limiter table. Owned by Better Auth — the application's
 * limiter uses `rateLimits` below rather than sharing keys in here. */

export const authRateLimits = pgTable('auth_rate_limits', {
	id: serial('id').primaryKey(),
	key: text('key').unique().notNull(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

/** Backing store for `rate-limiter-flexible`'s `RateLimiterDrizzle`. The column
 * names and types are dictated by that adapter (key / points / expire), so do
 * not rename them. See `$lib/server/rate-limit.ts`. */

export const rateLimits = pgTable('rate_limits', {
	key: text('key').primaryKey(),
	points: integer('points').notNull(),
	expire: timestamp('expire', { withTimezone: true, mode: 'date' }),
}, table => [index('idx_rate_limits_expire').on(table.expire)])


export const registrationCodes = pgTable('registration_codes', {
	id: serial('id').primaryKey(),
	code: text('code').unique().notNull(),
	createdBy: integer('created_by').references(() => users.id),
	usedBy: integer('used_by').references(() => users.id),
	role: text('role').notNull().default('editor'),
	usedAt: timestamp('used_at', { withTimezone: true }),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================================
// Unified Content Records
// ============================================================================


export const contentRecords = pgTable(
	'content_records',
	{
		id: serial('id').primaryKey(),
		domain: text('domain').notNull(),
		slug: text('slug').notNull(),
		parentPath: text('parent_path'),
		title: text('title').notNull(),
		content: text('content').notNull().default(''),
		plainText: text('plain_text').notNull().default(''),
		parsedAst: jsonb('parsed_ast'),
		sizeBytes: integer('size_bytes').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		uniqueIndex('uq_cr_domain_slug').on(table.domain, sql`LOWER(${table.slug})`),
		index('idx_cr_domain').on(table.domain),
		index('idx_cr_updated').on(table.updatedAt),
	],
)


export const contentRevisions = pgTable(
	'content_revisions',
	{
		id: serial('id').primaryKey(),
		contentRecordId: integer('content_record_id')
			.references(() => contentRecords.id, { onDelete: 'cascade' })
			.notNull(),
		title: text('title').notNull(),
		content: text('content').notNull(),
		sizeBytes: integer('size_bytes').notNull().default(0),
		editSummary: text('edit_summary').default(''),
		userId: integer('user_id').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_crev_record').on(table.contentRecordId),
		index('idx_crev_date').on(table.createdAt),
	],
)


export const contentLinks = pgTable(
	'content_links',
	{
		// Legacy: nullable now; entity-sourced links leave this NULL.
		sourceId: integer('source_id')
			.references(() => contentRecords.id, { onDelete: 'cascade' }),
		// Generalised source: 'know' | 'star' | 'planet' | 'system' | 'language' | 'lexicon' | 'calendar' | 'category' | 'country' | 'map' | …
		sourceKind: text('source_kind').notNull().default('know'),
		sourceEntityId: integer('source_entity_id').notNull(),
		targetDomain: text('target_domain').notNull(),
		targetSlug: text('target_slug').notNull(),
		targetId: integer('target_id')
			.references(() => contentRecords.id, { onDelete: 'set null' }),
	},
	table => [
		primaryKey({ columns: [table.sourceKind, table.sourceEntityId, table.targetDomain, table.targetSlug] }),
		index('idx_clinks_target').on(table.targetId),
		index('idx_clinks_target_slug').on(table.targetDomain, table.targetSlug),
		index('idx_clinks_source_entity').on(table.sourceKind, table.sourceEntityId),
	],
)


export const contentCategories = pgTable(
	'content_categories',
	{
		contentRecordId: integer('content_record_id')
			.references(() => contentRecords.id, { onDelete: 'cascade' })
			.notNull(),
		category: text('category').notNull(),
	},
	table => [
		primaryKey({ columns: [table.contentRecordId, table.category] }),
		index('idx_ccat_cat').on(table.category),
	],
)


export const contentMediaUsage = pgTable(
	'content_media_usage',
	{
		contentRecordId: integer('content_record_id')
			.references(() => contentRecords.id, { onDelete: 'cascade' })
			.notNull(),
		filename: text('filename').notNull(),
	},
	table => [
		primaryKey({ columns: [table.contentRecordId, table.filename] }),
		index('idx_cmu_filename').on(table.filename),
	],
)

// ============================================================================
// Templates (DB-stored simple templates for the hybrid system)
// ============================================================================


export const templates = pgTable('templates', {
	id: serial('id').primaryKey(),
	name: text('name').unique().notNull(),
	source: text('source').notNull(),
	description: text('description').default(''),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================================
// Calendars (JSONB for the complex config)
// ============================================================================


export const siteSettings = pgTable('site_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
})

// ============================================================================
// Media
// ============================================================================


export const categories = pgTable(
	'categories',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').unique().notNull(),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_categories_slug').on(sql`LOWER(${table.slug})`),
	],
)


export const entityRevisions = pgTable(
	'entity_revisions',
	{
		id: serial('id').primaryKey(),
		entityType: text('entity_type').notNull(),
		entityId: integer('entity_id').notNull(),
		title: text('title').notNull(),
		snapshot: jsonb('snapshot').notNull(),
		editSummary: text('edit_summary'),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_entity_revisions_entity').on(table.entityType, table.entityId, table.createdAt),
	],
)


export const entityCategories = pgTable(
	'entity_categories',
	{
		entityType: text('entity_type').notNull(),
		entityId: integer('entity_id').notNull(),
		category: text('category').notNull(),
	},
	table => [
		primaryKey({ columns: [table.entityType, table.entityId, table.category] }),
		index('idx_entity_categories_cat').on(table.category),
	],
)
