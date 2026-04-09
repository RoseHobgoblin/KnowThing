import { json, type RequestHandler } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { siteSettings } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { invalidateSettingsCache, isMissingSiteSettingsTableError } from '$lib/server/settings.js'
import { parseBody } from '$lib/server/utils.js'
import { z } from 'zod'

const VALID_KEYS = new Set([
	'site_name', 'site_tagline', 'institution_name', 'footer_text',
	'nav_wiki_label', 'nav_create_label', 'nav_wordbook_label',
	'nav_calendar_label', 'nav_search_label',
	'wordbook_name', 'wordbook_enabled', 'calendar_enabled',
	'text_direction', 'logo_url',
])

const updateSchema = z.record(z.string(), z.string())

/** GET /api/settings — get all settings */
export const GET: RequestHandler = async () => {
	try {
		const rows = await db.select().from(siteSettings)
		const result: Record<string, string> = {}
		for (const row of rows) result[row.key] = row.value
		return json(result)
	} catch (error) {
		if (isMissingSiteSettingsTableError(error)) {
			return json({})
		}
		return json({ error: 'Failed to load settings' }, { status: 500 })
	}
}

/** PUT /api/settings — update settings (admin only) */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')
	const data = await parseBody(event.request, updateSchema)
	if (data instanceof Response) return data

	for (const [key, value] of Object.entries(data)) {
		if (!VALID_KEYS.has(key)) continue
		try {
			await db
				.insert(siteSettings)
				.values({ key, value })
				.onConflictDoUpdate({ target: siteSettings.key, set: { value } })
		} catch (error) {
			if (isMissingSiteSettingsTableError(error)) {
				return json({ error: 'Site settings are unavailable until database migrations are applied.' }, { status: 503 })
			}
			return json({ error: 'Failed to update settings' }, { status: 500 })
		}
	}

	invalidateSettingsCache()
	return json({ ok: true })
}
