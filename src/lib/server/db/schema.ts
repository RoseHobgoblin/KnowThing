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

export const calendars = pgTable('calendars', {
	id: serial('id').primaryKey(),
	name: text('name').unique().notNull(),
	slug: text('slug').unique().notNull(),
	description: text('description').default(''),
	isPrimary: boolean('is_primary').default(false).notNull(),
	staticData: jsonb('static_data').notNull(),
	planetId: integer('planet_id').references((): AnyPgColumn => celestialBodies.id, { onDelete: 'set null' }),
	body: text('body').notNull().default(''),
	bodyParsedAst: jsonb('body_parsed_ast'),
	bodyPlainText: text('body_plain_text').notNull().default(''),
	bodySizeBytes: integer('body_size_bytes').notNull().default(0),
	bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
})

// ============================================================================
// Site Settings
// ============================================================================

export const siteSettings = pgTable('site_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
})

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
		// DEPRECATED: removed in Phase 9 of the namespace migration.
		pageSlug: text('page_slug'),
		parentLanguageId: integer('parent_language_id'),
		languageType: text('language_type').notNull().default('language'), // 'proto', 'language', 'historical'
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_languages_slug').on(table.slug),
		index('idx_languages_parent').on(table.parentLanguageId),
	],
)

export const languageDialects = pgTable(
	'language_dialects',
	{
		id: serial('id').primaryKey(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		region: text('region'),
		description: text('description'),
	},
	table => [
		index('idx_dialects_language').on(table.languageId),
		unique('uq_language_dialects_lang_slug').on(table.languageId, table.slug),
	],
)

export const phonemes = pgTable(
	'phonemes',
	{
		id: serial('id').primaryKey(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		ipa: text('ipa').notNull(),
		type: text('type').notNull(), // 'consonant' | 'vowel' | 'diphthong' | 'special'
		place: text('place'),
		manner: text('manner'),
		subtype: text('subtype'), // null | 'plain' | 'tense' | 'aspirated' | ...
		voicing: text('voicing'), // 'voiced' | 'voiceless' | null
		height: text('height'),
		backness: text('backness'),
		rounded: boolean('rounded'),
		marginal: boolean('marginal').notNull().default(false),
		notes: text('notes'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_phonemes_language_type').on(table.languageId, table.type, table.sortOrder),
		// A phoneme inventory is a set: a language cannot list the same IPA twice.
		unique('uq_phonemes_lang_ipa').on(table.languageId, table.ipa),
	],
)

export const graphemes = pgTable(
	'graphemes',
	{
		id: serial('id').primaryKey(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		grapheme: text('grapheme').notNull(),
		romanization: text('romanization'),
		environment: text('environment'),
		notes: text('notes'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_graphemes_language').on(table.languageId, table.sortOrder),
		// A letter may recur only in a different environment; NULLS NOT DISTINCT
		// so two unqualified (NULL-environment) copies collide instead of duplicating.
		unique('uq_graphemes_lang_grapheme_env')
			.on(table.languageId, table.grapheme, table.environment)
			.nullsNotDistinct(),
	],
)

export const graphemePhonemes = pgTable(
	'grapheme_phonemes',
	{
		graphemeId: integer('grapheme_id')
			.references(() => graphemes.id, { onDelete: 'cascade' })
			.notNull(),
		phonemeId: integer('phoneme_id')
			.references(() => phonemes.id, { onDelete: 'cascade' })
			.notNull(),
		position: integer('position').notNull(),
	},
	table => [
		primaryKey({ columns: [table.graphemeId, table.position] }),
		index('idx_grapheme_phonemes_phoneme').on(table.phonemeId),
	],
)

export const lexicon = pgTable(
	'lexicon',
	{
		id: serial('id').primaryKey(),
		word: text('word').notNull(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		pronunciation: text('pronunciation'),
		etymology: text('etymology'),
		notes: text('notes'),
		// DEPRECATED: removed in Phase 9 of the namespace migration.
		pageSlug: text('page_slug'),
		tags: text('tags').array().default([]),
		homographNumber: integer('homograph_number').notNull().default(1),
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		// Trigger-maintained (trg_lexicon_search): word A, definitions B,
		// etymology+pronunciation C, body_plain_text D. Never write from app code.
		searchVector: tsvector('search_vector'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_lexicon_word').on(table.word),
		index('idx_lexicon_language').on(table.languageId),
		index('idx_lexicon_search').using('gin', table.searchVector),
		index('idx_lexicon_tags').using('gin', table.tags),
		// Case-insensitive homograph identity (migration 0036)
		uniqueIndex('lexicon_word_lang_hom_ci_unique').on(
			table.languageId,
			sql`LOWER(${table.word})`,
			table.homographNumber,
		),
	],
)

export const lexiconRevisions = pgTable(
	'lexicon_revisions',
	{
		id: serial('id').primaryKey(),
		// Nullable + SET NULL (migration 0036): revision history survives entry
		// deletion; the snapshot JSON retains the old id/word/language.
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'set null' }),
		snapshot: jsonb('snapshot').notNull(),
		editSummary: text('edit_summary'),
		userId: integer('user_id').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_lexrev_entry').on(table.entryId),
	],
)

export const definitions = pgTable(
	'definitions',
	{
		id: serial('id').primaryKey(),
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		senseNumber: integer('sense_number').notNull().default(1),
		partOfSpeech: text('part_of_speech'),
		definition: text('definition').notNull(),
		usageExample: text('usage_example'),
		usageTranslation: text('usage_translation'),
		// Generated column (migration 0006). Never write from app code.
		searchVector: tsvector('search_vector'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_definitions_entry').on(table.entryId),
	],
)

export const lexiconVariants = pgTable(
	'lexicon_variants',
	{
		id: serial('id').primaryKey(),
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		dialectId: integer('dialect_id')
			.references(() => languageDialects.id, { onDelete: 'cascade' })
			.notNull(),
		pronunciation: text('pronunciation'),
		spelling: text('spelling'),
		notes: text('notes'),
	},
	table => [
		index('idx_variants_entry').on(table.entryId),
		unique('uq_lexicon_variants_entry_dialect').on(table.entryId, table.dialectId),
	],
)

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
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_lexrel_source').on(table.sourceId),
		index('idx_lexrel_target').on(table.targetId),
		unique('uq_lexicon_relations_edge').on(table.sourceId, table.targetId, table.relationType),
	],
)

// ============================================================================
// Celestial Bodies
// ============================================================================

/**
 * Unified celestial entity table (migration 0043). One row per system, star,
 * or body; `kind` discriminates, `parentId` is the single hierarchy edge
 * (star→system|star, body→star|body, system→none). Dynamical role (planet vs
 * moon vs companion) is NOT stored — it derives from the parent's kind.
 * Kind-specific column rules are enforced in Zod/services; the DB carries only
 * structural CHECKs (see 0043). `legacyKind`/`legacyId` are migration audit
 * columns, dropped in the follow-up cleanup migration.
 */
export const celestialBodies = pgTable(
	'celestial_bodies',
	{
		id: serial('id').primaryKey(),
		kind: text('kind').notNull(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		// RETIRED 2026-07-17: nothing reads or writes this anymore — title links
		// resolve via the underscored display name instead. Column dropped in the
		// 0044 legacy-cleanup migration.
		pageSlug: text('page_slug'),
		parentId: integer('parent_id').references((): AnyPgColumn => celestialBodies.id, { onDelete: 'set null' }),

		// Shared physical / observational.
		massKg: doublePrecision('mass_kg'),
		radiusM: doublePrecision('radius_m'),
		age: text('age'),
		apparentMagnitude: text('apparent_magnitude'),
		angularDiameter: text('angular_diameter'),

		// Orbital (stars in multiples, bodies).
		orbitalPeriodDays: doublePrecision('orbital_period_days'),
		semiMajorAxisAu: doublePrecision('semi_major_axis_au'),
		eccentricity: doublePrecision('eccentricity'),
		epochPhase: doublePrecision('epoch_phase').default(0),
		inclination: doublePrecision('inclination'),
		longitudeAscendingNode: doublePrecision('longitude_ascending_node'),
		argumentOfPeriapsis: doublePrecision('argument_of_periapsis'),

		// Rotation.
		rotationPeriodS: doublePrecision('rotation_period_s'),
		axialTilt: doublePrecision('axial_tilt'),

		// Star-only.
		spectralType: text('spectral_type'),
		luminosityW: doublePrecision('luminosity_w'),
		luminosityVisual: text('luminosity_visual'),
		temperatureK: doublePrecision('temperature_k'),
		color: text('color'),
		metallicity: text('metallicity'),
		absoluteMagnitude: text('absolute_magnitude'),

		// Body-only. bodyType is required for kind='body' (CHECK in 0043).
		bodyType: text('body_type'),
		temperature: text('temperature'),
		composition: text('composition'),
		atmosphere: text('atmosphere'),
		surfacePressure: text('surface_pressure'),
		albedo: text('albedo'),
		satellites: integer('satellites'),
		hasRings: boolean('has_rings').default(false),

		// System-only.
		distanceLy: doublePrecision('distance_ly'),
		galacticX: doublePrecision('galactic_x'),
		galacticY: doublePrecision('galactic_y'),
		galacticZ: doublePrecision('galactic_z'),
		formationAge: text('formation_age'),
		designations: text('designations'),

		// Migration audit (dropped by the cleanup migration).
		legacyKind: text('legacy_kind'),
		legacyId: integer('legacy_id'),

		extra: jsonb('extra').default({}),
		description: text('description').default(''),
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_celestial_bodies_slug').on(table.slug),
		index('idx_celestial_bodies_parent').on(table.parentId),
		index('idx_celestial_bodies_kind_parent').on(table.kind, table.parentId),
	],
)

// ============================================================================
// World Maps & Countries
// ============================================================================

export const worldMaps = pgTable(
	'world_maps',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		imageFilename: text('image_filename').notNull(),
		imageWidth: integer('image_width'),
		imageHeight: integer('image_height'),
		waterHex: text('water_hex').notNull().default('#000000'),
		timePeriod: text('time_period'),
		event: text('event'),
		linkedPageSlug: text('linked_page_slug'),
		description: text('description').default(''),
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_world_maps_slug').on(table.slug),
	],
)

export const countries = pgTable(
	'countries',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		// DEPRECATED: removed in Phase 9 of the namespace migration.
		// NOT NULL until Phase 9 first drops the constraint, then drops the column.
		pageSlug: text('page_slug').notNull(),
		capital: text('capital'),
		governance: text('governance'),
		color: text('color'),
		extra: jsonb('extra').default({}),
		description: text('description').default(''),
		body: text('body').notNull().default(''),
		bodyParsedAst: jsonb('body_parsed_ast'),
		bodyPlainText: text('body_plain_text').notNull().default(''),
		bodySizeBytes: integer('body_size_bytes').notNull().default(0),
		bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_countries_slug').on(table.slug),
		index('idx_countries_page_slug').on(table.pageSlug),
	],
)

export const worldMapRegions = pgTable(
	'world_map_regions',
	{
		id: serial('id').primaryKey(),
		mapId: integer('map_id')
			.references(() => worldMaps.id, { onDelete: 'cascade' })
			.notNull(),
		countryId: integer('country_id').references(() => countries.id, { onDelete: 'set null' }),
		hexColor: text('hex_color').notNull(),
		label: text('label').default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_world_map_regions_map').on(table.mapId),
		index('idx_world_map_regions_country').on(table.countryId),
		index('idx_world_map_regions_hex').on(table.mapId, table.hexColor),
	],
)

export const worldMapRegionGeometry = pgTable(
	'world_map_region_geometry',
	{
		id: serial('id').primaryKey(),
		regionId: integer('region_id')
			.references(() => worldMapRegions.id, { onDelete: 'cascade' })
			.notNull(),
		pathData: text('path_data').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_world_map_region_geometry_region').on(table.regionId, table.sortOrder),
	],
)

// ============================================================================
// Inflection / Declension / Conjugation
// ============================================================================

export const inflectionDimensions = pgTable(
	'inflection_dimensions',
	{
		id: serial('id').primaryKey(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		partOfSpeech: text('part_of_speech').notNull(),
		name: text('name').notNull(),
		dimValues: text('dim_values').array().notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
	},
	table => [
		index('idx_infl_dim_lang').on(table.languageId, table.partOfSpeech),
	],
)

export const paradigmClasses = pgTable(
	'paradigm_classes',
	{
		id: serial('id').primaryKey(),
		languageId: integer('language_id')
			.references(() => languages.id, { onDelete: 'cascade' })
			.notNull(),
		partOfSpeech: text('part_of_speech').notNull(),
		name: text('name').notNull(),
		description: text('description'),
	},
)

export const paradigmRules = pgTable(
	'paradigm_rules',
	{
		id: serial('id').primaryKey(),
		classId: integer('class_id')
			.references(() => paradigmClasses.id, { onDelete: 'cascade' })
			.notNull(),
		cellKey: text('cell_key').notNull(),
		pattern: text('pattern').notNull(),
	},
	table => [
		index('idx_paradigm_rules_class').on(table.classId),
		unique('uq_paradigm_rules_class_cell').on(table.classId, table.cellKey),
	],
)

export const lexiconInflections = pgTable(
	'lexicon_inflections',
	{
		id: serial('id').primaryKey(),
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		classId: integer('class_id')
			.references(() => paradigmClasses.id, { onDelete: 'set null' }),
		stem: text('stem'),
		overrides: jsonb('overrides').default({}),
	},
	table => [
		index('idx_lex_infl_entry').on(table.entryId),
	],
)

export const inflectedForms = pgTable(
	'inflected_forms',
	{
		id: serial('id').primaryKey(),
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
		form: text('form').notNull(),
		cellKey: text('cell_key').notNull(),
		isOverride: boolean('is_override').default(false),
	},
	table => [
		index('idx_inflected_forms_form').on(table.form),
		index('idx_inflected_forms_entry').on(table.entryId),
		unique('uq_inflected_forms_entry_cell').on(table.entryId, table.cellKey),
	],
)

// ============================================================================
// Namespace migration scaffolding (Phase 1 — additive). Wired up by later
// phases. See docs/MIGRATION-PHASE-0-AUDIT.md and the migration plan.
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
