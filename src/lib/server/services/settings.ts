import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db/index.js'
import { siteSettings } from '$lib/server/db/schema.js'
import { invalidateSettingsCache, isMissingSiteSettingsTableError } from '$lib/server/settings.js'

const VALID_KEYS = new Set([
	'site_name', 'site_tagline', 'institution_name', 'footer_text',
	'nav_wiki_label', 'nav_create_label', 'nav_wordbook_label',
	'nav_calendar_label', 'nav_search_label',
	'wordbook_name', 'wordbook_enabled', 'calendar_enabled',
	'text_direction', 'logo_url',
	'strip_exif_on_upload',
])

export async function getSiteSettings() {
	try {
		const rows = await db.select().from(siteSettings)
		const result: Record<string, string> = {}
		for (const row of rows) result[row.key] = row.value
		return result
	} catch (err) {
		if (isMissingSiteSettingsTableError(err)) return {}
		throw error(500, 'Failed to load settings')
	}
}

export async function updateSiteSettings(updates: Record<string, string>) {
	for (const [key, value] of Object.entries(updates)) {
		if (!VALID_KEYS.has(key)) continue
		try {
			await db
				.insert(siteSettings)
				.values({ key, value })
				.onConflictDoUpdate({ target: siteSettings.key, set: { value } })
		} catch (err) {
			if (isMissingSiteSettingsTableError(err)) {
				throw error(503, 'Site settings are unavailable until database migrations are applied.')
			}
			throw error(500, 'Failed to update settings')
		}
	}

	invalidateSettingsCache()
	return { ok: true }
}
