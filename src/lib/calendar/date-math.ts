import type {
	CalendarConfig,
	StaticCalendarData,
	CalendarDate,
	LeapDay,
	Moon,
	Era,
	Season,
	ResolvedDate,
	MoonPhase,
} from './types.js'

// ============================================================================
// Leap day logic
// ============================================================================

/** Check if a leap day applies in a given year */
export function leapDayApplies(ld: LeapDay, year: number): boolean {
	const checkYear = year + ld.offset
	if (checkYear % ld.interval !== 0) return false

	// Check ignore rules
	for (const ig of ld.ignore) {
		if (checkYear % ig === 0) {
			// Check exclusive overrides
			let overridden = false
			for (const ex of ld.exclusive) {
				if (checkYear % ex === 0) {
					overridden = true
					break
				}
			}
			if (!overridden) return false
		}
	}
	return true
}

// ============================================================================
// Days in month/year
// ============================================================================

/** Get total days in a month (including any leap days) */
export function daysInMonth(data: StaticCalendarData, year: number, monthIndex: number): number {
	const month = data.months[monthIndex]
	if (!month) return 0

	// Intercalary months only appear on certain years
	if (month.month_type === 'intercalary') {
		const interval = month.interval ?? 1
		const offset = month.offset ?? 0
		if ((year + offset) % interval !== 0) return 0
	}

	let days = month.length

	// Add leap days that belong to this month
	for (const ld of data.leap_days) {
		if (ld.month_index === monthIndex && leapDayApplies(ld, year)) {
			days += 1
		}
	}

	return days
}

/** Get total days in a year */
export function daysInYear(data: StaticCalendarData, year: number): number {
	let total = 0
	for (let index = 0; index < data.months.length; index++) {
		total += daysInMonth(data, year, index)
	}
	return total
}

// ============================================================================
// Absolute day conversion (epoch = year 1, month 1, day 1 = day 0)
// ============================================================================

/** Convert a date to an absolute day number */
export function absoluteDay(data: StaticCalendarData, date: CalendarDate): number {
	let abs = 0

	// Sum all prior years
	if (date.year > 0) {
		for (let y = 1; y < date.year; y++) {
			abs += daysInYear(data, y)
		}
	} else {
		// Years before year 1 (negative/zero years)
		for (let y = date.year; y < 1; y++) {
			abs -= daysInYear(data, y)
		}
	}

	// Sum all prior months in the current year (month is 1-indexed)
	for (let m = 0; m < date.month - 1; m++) {
		abs += daysInMonth(data, date.year, m)
	}

	// Add days (1-indexed, so subtract 1)
	abs += date.day - 1

	return abs
}

/** Convert an absolute day number back to a date */
export function dateFromAbsolute(data: StaticCalendarData, abs: number): CalendarDate {
	let remaining = abs
	let year: number

	if (remaining >= 0) {
		year = 1
		while (true) {
			const yearDays = daysInYear(data, year)
			if (remaining < yearDays) break
			remaining -= yearDays
			year++
		}
	} else {
		year = 0
		while (remaining < 0) {
			year--
			remaining += daysInYear(data, year)
		}
		// Now remaining >= 0, year is correct
	}

	// Find month
	let month = 1
	for (let m = 0; m < data.months.length; m++) {
		const mDays = daysInMonth(data, year, m)
		if (mDays === 0) {
			month++
			continue
		}
		if (remaining < mDays) break
		remaining -= mDays
		month++
	}

	return { year, month, day: remaining + 1 }
}

// ============================================================================
// Day of week
// ============================================================================

/** Get 0-based weekday index for a date */
export function dayOfWeek(data: StaticCalendarData, date: CalendarDate): number {
	const abs = absoluteDay(data, date)
	const weekLength = data.weekdays.length
	if (weekLength === 0) return 0

	// Count intercalary leap days that don't advance weekday
	let intercalarySkips = 0
	// For simplicity, we count all intercalary leap days from epoch to this date
	// This is the same approach as the Rust impl
	if (date.year > 0) {
		for (let y = 1; y <= date.year; y++) {
			for (const ld of data.leap_days) {
				if (ld.intercalary && leapDayApplies(ld, y)) {
					const ldAbs = absoluteDay(data, {
						year: y,
						month: ld.month_index + 1,
						day: ld.after_day + 1,
					})
					if (ldAbs <= abs) intercalarySkips++
				}
			}
		}
	}

	const effectiveAbs = abs - intercalarySkips
	return (((effectiveAbs + data.first_week_day) % weekLength) + weekLength) % weekLength
}

/** Get weekday name for a date */
export function dayOfWeekName(data: StaticCalendarData, date: CalendarDate): string {
	const index = dayOfWeek(data, date)
	return data.weekdays[index]?.name ?? ''
}

// ============================================================================
// Eras
// ============================================================================

/** Find the era for a given year */
export function eraForYear(data: StaticCalendarData, year: number): Era | null {
	for (const era of data.eras) {
		if (year >= era.start_year && (era.end_year == null || year <= era.end_year)) {
			return era
		}
	}
	return null
}

/** Format a year with its era */
export function formatYearWithEra(data: StaticCalendarData, year: number): string {
	const era = eraForYear(data, year)
	if (!era) return String(year + data.year_offset)

	let displayYear: number
	if (era.reverse_numbering && era.end_year != null) {
		displayYear = era.end_year - year + 1
	} else {
		displayYear = year - era.start_year + 1
	}

	displayYear += data.year_offset

	const fmt = era.format ?? '{{year}} {{era_name}}'
	return fmt.replace('{{year}}', String(displayYear)).replace('{{era_name}}', era.name)
}

// ============================================================================
// Seasons
// ============================================================================

/** Find the season for a given date */
export function seasonForDate(data: StaticCalendarData, date: CalendarDate): Season | null {
	const dated = data.seasons.filter(s => s.timing.type === 'dated')
	const periodic = data.seasons.filter(s => s.timing.type === 'periodic')

	if (dated.length > 0) {
		// Sort dated seasons by (month, day)
		const sorted = [...dated].sort((a, b) => {
			const at = a.timing as { type: 'dated', month: number, day: number }
			const bt = b.timing as { type: 'dated', month: number, day: number }
			return at.month === bt.month ? at.day - bt.day : at.month - bt.month
		})

		// Find the latest season that starts on or before the current date
		let result: Season | null = sorted.at(-1) ?? null
		for (const season of sorted) {
			const t = season.timing as { type: 'dated', month: number, day: number }
			// t.month is 0-indexed, date.month is 1-indexed
			if (t.month < date.month - 1 || (t.month === date.month - 1 && t.day <= date.day)) {
				result = season
			}
		}
		return result
	}

	if (periodic.length > 0) {
		// Compute day-of-year (0-indexed)
		let dayOfYear = 0
		for (let m = 0; m < date.month - 1; m++) {
			dayOfYear += daysInMonth(data, date.year, m)
		}
		dayOfYear += date.day - 1

		// Total period
		let totalPeriod = 0
		for (const s of periodic) {
			totalPeriod += (s.timing as { type: 'periodic', duration: number }).duration
		}
		if (totalPeriod === 0) return null

		const pos = ((dayOfYear % totalPeriod) + totalPeriod) % totalPeriod
		let accumulator = 0
		for (const s of periodic) {
			accumulator += (s.timing as { type: 'periodic', duration: number }).duration
			if (pos < accumulator) return s
		}
	}

	return null
}

// ============================================================================
// Moon phases
// ============================================================================

/** Get moon phase (0.0 = new, 0.5 = full) */
export function moonPhase(moon: Moon, data: StaticCalendarData, date: CalendarDate): number {
	const abs = absoluteDay(data, date)
	if (moon.cycle <= 0) return 0
	const raw = ((abs - moon.offset) / moon.cycle) % 1
	return ((raw % 1) + 1) % 1
}

/** Get human-readable phase name */
export function phaseName(phase: number): string {
	// Normalize to 0..1
	const p = ((phase % 1) + 1) % 1

	if (p < 0.0625) return 'New Moon'
	if (p < 0.1875) return 'Waxing Crescent'
	if (p < 0.3125) return 'First Quarter'
	if (p < 0.4375) return 'Waxing Gibbous'
	if (p < 0.5625) return 'Full Moon'
	if (p < 0.6875) return 'Waning Gibbous'
	if (p < 0.8125) return 'Last Quarter'
	if (p < 0.9375) return 'Waning Crescent'
	return 'New Moon'
}

// ============================================================================
// Current date resolution
// ============================================================================

/** Resolve the current in-world date from Date.now() + epoch_offset */
export function resolveCalendarDate(config: CalendarConfig): CalendarDate {
	const epochOffset = config.static_data.epoch_offset ?? 0
	const dayLengthMs = (config.static_data.day_length_seconds ?? 86_400) * 1000
	const absDay = Math.floor(Date.now() / dayLengthMs) + epochOffset
	return dateFromAbsolute(config.static_data, absDay)
}

// ============================================================================
// Full resolution
// ============================================================================

/** Resolve a date to its full display representation */
export function resolveDisplay(config: CalendarConfig, date?: CalendarDate): ResolvedDate {
	const d = date ?? resolveCalendarDate(config)
	const data = config.static_data

	const monthIndex = d.month - 1
	const monthName = data.months[monthIndex]?.name ?? `Month ${d.month}`
	const weekdayName = dayOfWeekName(data, d)
	const era = eraForYear(data, d.year)
	const season = seasonForDate(data, d)
	const yearDisplay = formatYearWithEra(data, d.year)

	const moonPhases: MoonPhase[] = data.display_moons
		? data.moons.map((moon) => {
			const phase = moonPhase(moon, data, d)
			return {
				moon_name: moon.name,
				phase,
				phase_name: phaseName(phase),
				face_color: moon.face_color,
				shadow_color: moon.shadow_color,
			}
		})
		: []

	return {
		year: d.year,
		month_index: monthIndex,
		day: d.day,
		month_name: monthName,
		day_of_week_name: weekdayName,
		era_name: era?.name ?? '',
		season_name: season?.name ?? '',
		year_display: yearDisplay,
		moon_phases: moonPhases,
	}
}

/** Get a month grid for rendering the calendar widget */
export function getMonthGrid(
	config: CalendarConfig,
	year: number,
	monthIndex: number,
): {
	days: (number | null)[]
	weekdays: string[]
	monthName: string
	totalDays: number
	startWeekday: number
} {
	const data = config.static_data
	const totalDays = daysInMonth(data, year, monthIndex)
	const weekdays = data.weekdays.map(w => w.abbreviation ?? w.name.slice(0, 2))
	const monthName = data.months[monthIndex]?.name ?? ''

	// What weekday does day 1 fall on?
	const startWeekday = dayOfWeek(data, { year, month: monthIndex + 1, day: 1 })

	// Build grid: null for empty cells before day 1
	const days: (number | null)[] = []
	for (let index = 0; index < startWeekday; index++) {
		days.push(null)
	}
	for (let d = 1; d <= totalDays; d++) {
		days.push(d)
	}

	return { days, weekdays, monthName, totalDays, startWeekday }
}
