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


export const rodderBodies = pgTable(
	'rodder_bodies',
	{
		id: serial('id').primaryKey(),
		kind: text('kind').notNull(),
		name: text('name').notNull(),
		slug: text('slug').unique().notNull(),
		// RETIRED 2026-07-17: nothing reads or writes this anymore — title links
		// resolve via the underscored display name instead. Column dropped in the
		// 0044 legacy-cleanup migration.
		pageSlug: text('page_slug'),
		parentId: integer('parent_id').references((): AnyPgColumn => rodderBodies.id, { onDelete: 'set null' }),

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

		// Shared effective/representative temperature; luminosity fields remain star-only.
		spectralType: text('spectral_type'),
		luminosityW: doublePrecision('luminosity_w'),
		luminosityVisual: text('luminosity_visual'),
		temperatureK: doublePrecision('temperature_k'),
		color: text('color'),
		metallicity: text('metallicity'),
		absoluteMagnitude: text('absolute_magnitude'),

		// Body-only. bodyType is required for kind='body' (CHECK in 0043).
		bodyType: text('body_type'),
		composition: text('composition'),
		atmosphere: text('atmosphere'),
		surfacePressure: text('surface_pressure'),
		satellites: integer('satellites'),

		// System-only. Sector-frame XYZ lives in rodder_sector_roots (0054);
		// distance stays here as an independent approximate authored fact.
		distanceLy: doublePrecision('distance_ly'),
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
		index('idx_rodder_bodies_slug').on(table.slug),
		index('idx_rodder_bodies_parent').on(table.parentId),
		index('idx_rodder_bodies_kind_parent').on(table.kind, table.parentId),
	],
)

/**
 * A rodder sector (migration 0054): a bounded 3D authoring space with an
 * explicit reference-frame contract — units, shape/extent, origin semantics,
 * axes, handedness, provenance. Sector-map positions are meaningless without
 * this record; bare XYZ values must never be stored outside a declared frame.
 * Enum-ish columns carry DB CHECKs (see 0054); extent columns are nullable so
 * an undeclared extent stays visibly unavailable.
 */

export const rodderSectors = pgTable('rodder_sectors', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').unique().notNull(),
	description: text('description').notNull().default(''),

	// Frame contract.
	units: text('units').notNull().default('ly'), // 'ly' | 'pc'
	shape: text('shape'), // 'sphere' | 'cuboid' | null (undeclared)
	radius: doublePrecision('radius'),
	extentX: doublePrecision('extent_x'),
	extentY: doublePrecision('extent_y'),
	extentZ: doublePrecision('extent_z'),
	originKind: text('origin_kind').notNull().default('frame-centred'), // 'object-centred' | 'frame-centred' | 'imported'
	originBodyId: integer('origin_body_id').references(() => rodderBodies.id, { onDelete: 'set null' }),
	axesNote: text('axes_note'),
	handedness: text('handedness').notNull().default('right-handed'), // 'right-handed' | 'left-handed'
	referenceEpoch: text('reference_epoch'),
	provenance: text('provenance').notNull().default('authored'), // 'authored' | 'imported' | 'transformed' | 'approximate' | 'legacy'

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * An independently positioned root object on a sector map. One row per root;
 * `bodyId` is unique — an object is a root of at most one sector and loses the
 * root record when attached beneath an orbital parent. XYZ is in the sector's
 * units and nullable (a root may exist before its position is known); the app
 * layer requires complete triples on write, while legacy-migrated rows keep
 * whatever the old galactic_x/y/z columns held, verbatim.
 */

export const rodderSectorRoots = pgTable(
	'rodder_sector_roots',
	{
		id: serial('id').primaryKey(),
		sectorId: integer('sector_id').references(() => rodderSectors.id, { onDelete: 'cascade' }).notNull(),
		bodyId: integer('body_id').references(() => rodderBodies.id, { onDelete: 'cascade' }).unique().notNull(),

		x: doublePrecision('x'),
		y: doublePrecision('y'),
		z: doublePrecision('z'),
		positionProvenance: text('position_provenance').notNull().default('authored'), // 'authored' | 'imported' | 'derived' | 'approximate' | 'legacy'
		positionUncertainty: doublePrecision('position_uncertainty'),
		notes: text('notes'),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	table => [
		index('idx_sector_roots_sector').on(table.sectorId),
	],
)

/** Stable, revision-pinned Media usage by structured domain records. */
