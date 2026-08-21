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

