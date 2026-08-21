import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as manifest from '$lib/server/db/schema.js'
import { calendars } from '$lib/feature/calendar/server/schema.server.js'
import { media, mediaAssetBindings } from '$lib/feature/media/server/schema.server.js'
import { rodderBodies } from '$lib/feature/rodder/server/schema.server.js'
import { languages, lexicon } from '$lib/feature/wordbook/server/schema.server.js'
import { worldMaps } from '$lib/feature/worldmap/server/schema.server.js'

describe('feature-owned database schemas', () => {
	it('preserves the manifest table identities and names', () => {
		for (const [name, table] of Object.entries({ calendars, media, mediaAssetBindings, rodderBodies, languages, lexicon, worldMaps })) {
			expect(manifest[name as keyof typeof manifest]).toBe(table)
			expect(getTableName(table)).toMatch(/^[_a-z]+$/)
		}
	})

	it('retains meaningful cross-domain foreign keys', () => {
		const calendarForeignKeys = getTableConfig(calendars).foreignKeys.flatMap(key => key.reference().foreignTable)
		const bindingForeignKeys = getTableConfig(mediaAssetBindings).foreignKeys.flatMap(key => key.reference().foreignTable)
		expect(calendarForeignKeys).toContain(rodderBodies)
		expect(bindingForeignKeys).toContain(media)
	})
})
