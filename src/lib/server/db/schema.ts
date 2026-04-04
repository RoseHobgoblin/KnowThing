import {
	pgTable,
	serial,
	text,
	integer,
	doublePrecision,
	timestamp,
	boolean,
	jsonb,
	primaryKey,
	index,
} from 'drizzle-orm/pg-core'

// ============================================================================
// Users & Auth
// ============================================================================

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: text('username').unique().notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role').notNull().default('editor'), // 'owner' | 'admin' | 'editor' | 'viewer'
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	token: text('token').unique().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

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

export const loginAttempts = pgTable(
	'login_attempts',
	{
		id: serial('id').primaryKey(),
		username: text('username').notNull(),
		ipAddress: text('ip_address'),
		success: boolean('success').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_login_attempts_username').on(table.username, table.createdAt),
	],
)

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
		index('idx_cr_domain_slug').on(table.domain, table.slug),
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
		sourceId: integer('source_id')
			.references(() => contentRecords.id, { onDelete: 'cascade' })
			.notNull(),
		targetDomain: text('target_domain').notNull(),
		targetSlug: text('target_slug').notNull(),
		targetId: integer('target_id')
			.references(() => contentRecords.id, { onDelete: 'set null' }),
	},
	table => [
		primaryKey({ columns: [table.sourceId, table.targetDomain, table.targetSlug] }),
		index('idx_clinks_target').on(table.targetId),
		index('idx_clinks_target_slug').on(table.targetDomain, table.targetSlug),
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
	planetId: integer('planet_id').references(() => planetaryBodies.id, { onDelete: 'set null' }),
	contentRecordId: integer('content_record_id').references(() => contentRecords.id, { onDelete: 'set null' }),
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
		pageSlug: text('page_slug'),
		parentLanguageId: integer('parent_language_id'),
		languageType: text('language_type').notNull().default('language'), // 'proto', 'language', 'historical'
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
		pageSlug: text('page_slug'),
		tags: text('tags').array().default([]),
		homographNumber: integer('homograph_number').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_lexicon_word').on(table.word),
		index('idx_lexicon_language').on(table.languageId),
	],
)

export const lexiconRevisions = pgTable(
	'lexicon_revisions',
	{
		id: serial('id').primaryKey(),
		entryId: integer('entry_id')
			.references(() => lexicon.id, { onDelete: 'cascade' })
			.notNull(),
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
		dialectId: integer('dialect_id').references(() => languageDialects.id, { onDelete: 'set null' }),
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
	],
)

// ============================================================================
// Celestial Bodies
// ============================================================================

export const starSystems = pgTable(
	'star_systems',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		pageSlug: text('page_slug'),
		systemType: text('system_type').default('single'),
		contentRecordId: integer('content_record_id').references(() => contentRecords.id, { onDelete: 'set null' }),
		description: text('description').default(''),
		extra: jsonb('extra').default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_star_systems_slug').on(table.slug),
	],
)

export const stars = pgTable(
	'stars',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		pageSlug: text('page_slug'),

		spectralType: text('spectral_type'),
		mass: text('mass'),
		massKg: doublePrecision('mass_kg'),
		radius: text('radius'),
		radiusM: doublePrecision('radius_m'),
		luminosity: text('luminosity'),
		luminosityW: doublePrecision('luminosity_w'),
		luminosityVisual: text('luminosity_visual'),
		temperature: text('temperature'),
		temperatureK: doublePrecision('temperature_k'),
		age: text('age'),
		color: text('color'),

		density: text('density'),
		surfaceGravity: text('surface_gravity'),
		escapeVelocity: text('escape_velocity'),

		rotationPeriod: text('rotation_period'),
		rotationPeriodS: doublePrecision('rotation_period_s'),
		axialTilt: doublePrecision('axial_tilt'),

		orbitalPeriod: text('orbital_period'),
		orbitalPeriodDays: doublePrecision('orbital_period_days'),
		semiMajorAxis: text('semi_major_axis'),
		semiMajorAxisAu: doublePrecision('semi_major_axis_au'),
		eccentricity: doublePrecision('eccentricity'),
		periastron: text('periastron'),
		apastron: text('apastron'),

		apparentMagnitude: text('apparent_magnitude'),
		absoluteMagnitude: text('absolute_magnitude'),
		angularDiameter: text('angular_diameter'),

		metallicity: text('metallicity'),
		companion: text('companion'),
		parentStarId: integer('parent_star_id'),
		systemId: integer('system_id').references(() => starSystems.id, { onDelete: 'set null' }),
		contentRecordId: integer('content_record_id').references(() => contentRecords.id, { onDelete: 'set null' }),
		epochPhase: doublePrecision('epoch_phase').default(0),

		extra: jsonb('extra').default({}),
		description: text('description').default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_stars_slug').on(table.slug),
	],
)

export const planetaryBodies = pgTable(
	'planetary_bodies',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		bodyType: text('body_type').notNull().default('planet'),
		starId: integer('star_id').references(() => stars.id, { onDelete: 'set null' }),
		parentId: integer('parent_id'),
		contentRecordId: integer('content_record_id').references(() => contentRecords.id, { onDelete: 'set null' }),
		pageSlug: text('page_slug'),

		mass: text('mass'),
		massKg: doublePrecision('mass_kg'),
		radius: text('radius'),
		radiusM: doublePrecision('radius_m'),
		density: text('density'),
		surfaceGravity: text('surface_gravity'),
		escapeVelocity: text('escape_velocity'),
		temperature: text('temperature'),
		age: text('age'),

		composition: text('composition'),
		atmosphere: text('atmosphere'),
		surfacePressure: text('surface_pressure'),

		orbitalPeriod: text('orbital_period'),
		orbitalPeriodDays: doublePrecision('orbital_period_days'),
		semiMajorAxis: text('semi_major_axis'),
		semiMajorAxisAu: doublePrecision('semi_major_axis_au'),
		eccentricity: doublePrecision('eccentricity'),
		inclination: doublePrecision('inclination'),

		rotationPeriod: text('rotation_period'),
		rotationPeriodS: doublePrecision('rotation_period_s'),
		axialTilt: doublePrecision('axial_tilt'),

		apparentMagnitude: text('apparent_magnitude'),
		angularDiameter: text('angular_diameter'),
		albedo: text('albedo'),

		satellites: integer('satellites'),
		hasRings: boolean('has_rings').default(false),
		epochPhase: doublePrecision('epoch_phase').default(0),

		extra: jsonb('extra').default({}),
		description: text('description').default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_planetary_bodies_slug').on(table.slug),
		index('idx_planetary_bodies_star').on(table.starId),
		index('idx_planetary_bodies_parent').on(table.parentId),
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
	],
)
