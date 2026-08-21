import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { rodderBodies } from '../../server/schema.server.js'

/** Explicit cross-domain FK target used only while declaring Calendar's schema. */
export function rodderBodyIdReference(): AnyPgColumn {
	return rodderBodies.id
}
