/**
 * Calendar consistency checks — the counterpart to tungolcraft's physics
 * validator. Given a calendar definition, return human-readable issues for
 * configurations that are internally contradictory (a leap day inserted past
 * the end of its month, a season dated to a day the month doesn't have, an era
 * that ends before it starts) or merely suspicious.
 *
 * This is a semantic pass over already-shaped data — it assumes the object is
 * structurally a `StaticCalendarData` and checks that its parts agree with each
 * other. It has no runtime dependencies; wire it up behind whatever schema
 * layer (Zod, etc.) guards the shape at your API boundary.
 *
 * Issues are advisory: `error` marks a definition that cannot be reckoned
 * coherently, `warning` marks something probably-unintended but reckonable.
 */

import type { StaticCalendarData } from './types.js'

export interface CalendarIssue {
	/** Dotted path to the offending field, e.g. `months.2.length` or `seasons.0.timing.day`. */
	path: string
	message: string
	severity: 'error' | 'warning'
}

/**
 * Check a calendar definition for internal contradictions.
 * Returns an empty array when nothing is wrong.
 */
export function validateCalendar(data: StaticCalendarData): CalendarIssue[] {
	const issues: CalendarIssue[] = []

	// ── Weeks ────────────────────────────────────────────────────────────────
	if (data.weekdays.length === 0) {
		issues.push({ path: 'weekdays', message: 'A calendar needs at least one weekday', severity: 'error' })
	} else if (data.first_week_day < 0 || data.first_week_day >= data.weekdays.length) {
		issues.push({
			path: 'first_week_day',
			message: `first_week_day (${data.first_week_day}) must point at an existing weekday (0–${data.weekdays.length - 1})`,
			severity: 'error',
		})
	}

	// ── Months ───────────────────────────────────────────────────────────────
	if (data.months.length === 0) {
		issues.push({ path: 'months', message: 'A calendar needs at least one month', severity: 'error' })
	}

	data.months.forEach((month, i) => {
		if (month.length === 0) {
			issues.push({ path: `months.${i}.length`, message: `Month "${month.name}" must be at least one day long`, severity: 'error' })
		}

		if (month.month_type === 'intercalary' && month.interval != null && month.interval < 1) {
			issues.push({ path: `months.${i}.interval`, message: `Intercalary month "${month.name}" needs a positive interval`, severity: 'error' })
		}

		if (month.month_type === 'lunisolar_leap') {
			if (month.lunisolar) {
				if (month.lunisolar.solar_divisions < 1) {
					issues.push({ path: `months.${i}.lunisolar.solar_divisions`, message: 'Solar divisions must be positive', severity: 'error' })
				}
				if (month.lunisolar.moon_index < 0 || month.lunisolar.moon_index >= data.moons.length) {
					issues.push({ path: `months.${i}.lunisolar.moon_index`, message: 'Referenced moon does not exist', severity: 'error' })
				}
			} else {
				issues.push({ path: `months.${i}.lunisolar`, message: `Lunisolar leap month "${month.name}" needs lunisolar rules`, severity: 'error' })
			}
		}
	})

	// ── Leap days ────────────────────────────────────────────────────────────
	data.leap_days.forEach((leapDay, i) => {
		if (leapDay.interval < 1) {
			issues.push({ path: `leap_days.${i}.interval`, message: `Leap day "${leapDay.name}" needs a positive interval`, severity: 'error' })
		}

		const targetMonth = data.months[leapDay.month_index]
		if (!targetMonth) {
			issues.push({ path: `leap_days.${i}.month_index`, message: `Leap day "${leapDay.name}" targets a month that does not exist`, severity: 'error' })
			return
		}
		if (leapDay.after_day < 1 || leapDay.after_day > targetMonth.length) {
			issues.push({
				path: `leap_days.${i}.after_day`,
				message: `Leap day "${leapDay.name}" is inserted after day ${leapDay.after_day}, outside "${targetMonth.name}" (1–${targetMonth.length})`,
				severity: 'error',
			})
		}
	})

	// ── Moons ────────────────────────────────────────────────────────────────
	data.moons.forEach((moon, i) => {
		if (moon.cycle <= 0) {
			issues.push({ path: `moons.${i}.cycle`, message: `Moon "${moon.name}" needs a positive orbital cycle`, severity: 'error' })
		}
	})

	// ── Eras ─────────────────────────────────────────────────────────────────
	data.eras.forEach((era, i) => {
		if (era.end_year != null && era.end_year < era.start_year) {
			issues.push({ path: `eras.${i}.end_year`, message: `Era "${era.name}" ends (${era.end_year}) before it starts (${era.start_year})`, severity: 'error' })
		}
		if (era.reverse_numbering && era.end_year == null) {
			issues.push({ path: `eras.${i}.end_year`, message: `Era "${era.name}" counts backward but is open-ended — there is no end year to count down from`, severity: 'warning' })
		}
	})

	// ── Seasons ──────────────────────────────────────────────────────────────
	data.seasons.forEach((season, i) => {
		if (season.timing.type === 'dated') {
			const month = data.months[season.timing.month]
			if (!month) {
				issues.push({ path: `seasons.${i}.timing.month`, message: `Season "${season.name}" starts in a month that does not exist`, severity: 'error' })
			} else if (season.timing.day < 1 || season.timing.day > month.length) {
				issues.push({
					path: `seasons.${i}.timing.day`,
					message: `Season "${season.name}" starts on day ${season.timing.day}, outside "${month.name}" (1–${month.length})`,
					severity: 'error',
				})
			}
		} else if (season.timing.duration < 1) {
			issues.push({ path: `seasons.${i}.timing.duration`, message: `Season "${season.name}" needs a positive duration`, severity: 'error' })
		}

		const w = season.weather
		if (w?.temp_low != null && w?.temp_high != null && w.temp_low > w.temp_high) {
			issues.push({ path: `seasons.${i}.weather.temp_low`, message: `Season "${season.name}" has a low temperature above its high`, severity: 'warning' })
		}
	})

	return issues
}

/** True when a calendar definition has no `error`-severity issues (warnings are allowed). */
export function isReckonable(data: StaticCalendarData): boolean {
	return !validateCalendar(data).some(issue => issue.severity === 'error')
}
