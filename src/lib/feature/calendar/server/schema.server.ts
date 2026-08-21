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

import { rodderBodyIdReference } from '$lib/feature/rodder/public/server/schema-reference.server.js'

export const calendars = pgTable('calendars', {
	id: serial('id').primaryKey(),
	name: text('name').unique().notNull(),
	slug: text('slug').unique().notNull(),
	description: text('description').default(''),
	isPrimary: boolean('is_primary').default(false).notNull(),
	staticData: jsonb('static_data').notNull(),
	planetId: integer('planet_id').references(rodderBodyIdReference, { onDelete: 'set null' }),
	body: text('body').notNull().default(''),
	bodyParsedAst: jsonb('body_parsed_ast'),
	bodyPlainText: text('body_plain_text').notNull().default(''),
	bodySizeBytes: integer('body_size_bytes').notNull().default(0),
	bodyUpdatedAt: timestamp('body_updated_at', { withTimezone: true }),
})

// ============================================================================
// Site Settings
// ============================================================================

