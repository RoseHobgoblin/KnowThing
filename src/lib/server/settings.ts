import { db } from './db/index.js'
import { siteSettings } from './db/schema.js'

export interface SiteConfig {
	siteName: string
	siteTagline: string
	institutionName: string
	footerText: string
	navWikiLabel: string
	navCreateLabel: string
	navWordbookLabel: string
	navCalendarLabel: string
	navSearchLabel: string
	wordbookName: string
	wordbookEnabled: boolean
	calendarEnabled: boolean
	textDirection: 'ltr' | 'rtl'
	logoUrl: string
	stripExifOnUpload: boolean
}

const DEFAULTS: SiteConfig = {
	siteName: 'KnowThing',
	siteTagline: 'A collaborative encyclopedia',
	institutionName: '',
	footerText: '',
	navWikiLabel: 'Main Page',
	navCreateLabel: 'Create',
	navWordbookLabel: 'Wordbook',
	navCalendarLabel: 'Calendar',
	navSearchLabel: 'Search',
	wordbookName: 'Wordbook',
	wordbookEnabled: true,
	calendarEnabled: true,
	textDirection: 'ltr',
	logoUrl: '',
	stripExifOnUpload: true,
}

const KEY_MAP: Record<string, keyof SiteConfig> = {
	'site_name': 'siteName',
	'site_tagline': 'siteTagline',
	'institution_name': 'institutionName',
	'footer_text': 'footerText',
	'nav_wiki_label': 'navWikiLabel',
	'nav_create_label': 'navCreateLabel',
	'nav_wordbook_label': 'navWordbookLabel',
	'nav_calendar_label': 'navCalendarLabel',
	'nav_search_label': 'navSearchLabel',
	'wordbook_name': 'wordbookName',
	'wordbook_enabled': 'wordbookEnabled',
	'calendar_enabled': 'calendarEnabled',
	'text_direction': 'textDirection',
	'logo_url': 'logoUrl',
	'strip_exif_on_upload': 'stripExifOnUpload',
}

const BOOLEAN_KEYS = new Set<keyof SiteConfig>(['wordbookEnabled', 'calendarEnabled', 'stripExifOnUpload'])

let cache: SiteConfig | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute
let hasLoggedMissingTableWarning = false

type PostgresErrorLike = {
	code?: string
	message?: string
	severity?: string
}

export function isMissingSiteSettingsTableError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	const pgError = error as PostgresErrorLike
	if (pgError.code !== '42P01') return false
	return typeof pgError.message === 'string' && pgError.message.includes('site_settings')
}

export async function getSiteConfig(): Promise<SiteConfig> {
	const now = Date.now()
	if (cache && now - cacheTime < CACHE_TTL) return cache

	let rows: Array<{ key: string, value: string }> = []
	try {
		rows = await db.select().from(siteSettings)
	} catch (error) {
		if (!isMissingSiteSettingsTableError(error)) {
			throw error
		}

		if (!hasLoggedMissingTableWarning) {
			hasLoggedMissingTableWarning = true
			console.warn('site_settings table is missing; using default site config until migrations are applied.')
		}

		cache = { ...DEFAULTS }
		cacheTime = now
		return cache
	}

	const config = { ...DEFAULTS }

	for (const row of rows) {
		const field = KEY_MAP[row.key]
		if (!field) continue

		if (BOOLEAN_KEYS.has(field)) {
			(config as any)[field] = row.value === 'true'
		} else {
			(config as any)[field] = row.value
		}
	}

	cache = config
	cacheTime = now
	return config
}

export function invalidateSettingsCache(): void {
	cache = null
}
