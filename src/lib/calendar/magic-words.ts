import type { ResolvedDate } from './types.js';

/**
 * Resolve calendar-specific magic words from a ResolvedDate.
 * Returns the resolved string, or null if not a calendar magic word.
 */
export function resolveCalendarMagicWord(
	name: string,
	resolved: ResolvedDate | null
): string | null {
	if (!resolved) return null;

	const upper = name.toUpperCase().trim();

	switch (upper) {
		case 'CURRENTYEAR':
			return String(resolved.year);

		case 'CURRENTMONTH':
			return String(resolved.month_index + 1);

		case 'CURRENTMONTHNAME':
			return resolved.month_name;

		case 'CURRENTDAY':
			return String(resolved.day);

		case 'CURRENTDAYNAME':
			return resolved.day_of_week_name;

		case 'CURRENTERA':
			return resolved.era_name;

		case 'CURRENTSEASON':
			return resolved.season_name;

		case 'CURRENTYEARDISPLAY':
		case 'CURRENTDATE':
			return resolved.year_display;

		case 'CURRENTFULLDISPLAY':
			return `${resolved.day_of_week_name}, ${resolved.day} ${resolved.month_name}, ${resolved.year_display}`;

		default:
			return null;
	}
}
