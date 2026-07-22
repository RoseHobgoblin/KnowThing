import { z } from 'zod'

/**
 * Client-side form schema for site settings. Settings are persisted as strings
 * (the API guard lives in `$lib/server`); this form models the three toggles as
 * real booleans and the rest as text, converting back to strings on save.
 */
export const settingsFormSchema = z.object({
	siteName: z.string().default(''),
	siteTagline: z.string().default(''),
	institutionName: z.string().default(''),
	footerText: z.string().default(''),
	logoUrl: z.string().default(''),
	textDirection: z.enum(['ltr', 'rtl']).default('ltr'),
	navWikiLabel: z.string().default(''),
	navCreateLabel: z.string().default(''),
	navWordbookLabel: z.string().default(''),
	navCalendarLabel: z.string().default(''),
	wordbookName: z.string().default(''),
	wordbookEnabled: z.boolean().default(true),
	calendarEnabled: z.boolean().default(true),
	stripExifOnUpload: z.boolean().default(true),
})

export type SettingsFormData = z.infer<typeof settingsFormSchema>

/** Convert a validated draft into the string-keyed API payload. */
export function toSettingsPayload(data: SettingsFormData): Record<string, string> {
	return {
		site_name: data.siteName,
		site_tagline: data.siteTagline,
		institution_name: data.institutionName,
		footer_text: data.footerText,
		logo_url: data.logoUrl,
		text_direction: data.textDirection,
		nav_wiki_label: data.navWikiLabel,
		nav_create_label: data.navCreateLabel,
		nav_wordbook_label: data.navWordbookLabel,
		nav_calendar_label: data.navCalendarLabel,
		wordbook_name: data.wordbookName,
		wordbook_enabled: String(data.wordbookEnabled),
		calendar_enabled: String(data.calendarEnabled),
		strip_exif_on_upload: String(data.stripExifOnUpload),
	}
}
