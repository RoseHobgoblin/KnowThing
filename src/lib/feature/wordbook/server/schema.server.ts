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
// Rodder Bodies
// ============================================================================

/**
 * Unified rodder entity table (migration 0043). One row per system, star,
 * or body; `kind` discriminates, `parentId` is the single hierarchy edge
 * (star→system|star, body→star|body, system→none). Dynamical role (planet vs
 * moon vs companion) is NOT stored — it derives from the parent's kind.
 * Kind-specific column rules are enforced in Zod/services; the DB carries only
 * structural CHECKs (see 0043). `legacyKind`/`legacyId` are migration audit
 * columns, dropped in the follow-up cleanup migration.
 */

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
// phases. See docs/audits/MIGRATION-PHASE-0-AUDIT.md and the migration plan.
// ============================================================================

