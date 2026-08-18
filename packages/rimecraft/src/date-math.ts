import type {
	CalendarConfig,
	StaticCalendarData,
	CalendarDate,
	LeapDay,
	Month,
	Moon,
	Era,
	Season,
	ResolvedDate,
	MoonPhase,
} from './types.js'

// ============================================================================
// Year layout — the ordered list of months for a given year
// ============================================================================

export interface MonthLayout {
	/** Original month definition */
	month: Month
	/** Original index in data.months (for leap day matching) */
	sourceIndex: number
	/** Whether this is an inserted lunisolar leap month */
	isLeapMonth: boolean
	/** Display name (may differ from month.name for leap months) */
	displayName: string
}

/** Cache for computed year layouts */
const layoutCache = new Map<string, Map<number, MonthLayout[]>>()

/**
 * Compute the ordered month sequence for a given year.
 * For non-lunisolar calendars, returns the static month list.
 * For lunisolar calendars, computes leap month insertion.
 */
export function computeYearLayout(data: StaticCalendarData, year: number): MonthLayout[] {
	// Check cache — key by data identity (use months length + first month name as cheap key)
	const cacheKey = `${data.months.length}:${data.months[0]?.name ?? ''}:${data.first_week_day}`
	let yearCache = layoutCache.get(cacheKey)
	if (!yearCache) {
		yearCache = new Map()
		layoutCache.set(cacheKey, yearCache)
	}
	const cached = yearCache.get(year)
	if (cached) return cached

	const hasLunisolar = data.months.some(m => m.month_type === 'lunisolar_leap')

	let layout: MonthLayout[]

	if (hasLunisolar) {
		// Lunisolar: compute leap month insertion (Step 4 will implement this)
		layout = computeLunisolarLayout(data, year)
	} else {
		// Non-lunisolar: static month list
		layout = data.months.map((month, index) => ({
			month,
			sourceIndex: index,
			isLeapMonth: false,
			displayName: month.name,
		}))
	}

	yearCache.set(year, layout)
	return layout
}

/**
 * Compute lunisolar year layout — determines if/where a leap month is inserted.
 *
 * Algorithm (models Chinese/Hindu lunisolar calendars):
 * 1. Compute the absolute day of this year's start
 * 2. Divide the solar year into N equal segments ("solar terms" / "solar months")
 * 3. Compute new moon dates within this year from the reference moon's cycle
 * 4. A lunar month "contains" a major solar term if a term boundary falls within it
 * 5. If there are more lunar months than regular calendar months in this year,
 *    the first lunar month that does NOT contain a major solar term is the leap month
 * 6. The leap month is inserted after the preceding regular month
 */
function computeLunisolarLayout(data: StaticCalendarData, year: number): MonthLayout[] {
	// Find the lunisolar_leap month template
	const leapTemplate = data.months.find(m => m.month_type === 'lunisolar_leap')
	if (!leapTemplate?.lunisolar) {
		// No lunisolar config — return regular months without the template
		return data.months
			.filter(m => m.month_type !== 'lunisolar_leap')
			.map((month, index) => ({ month, sourceIndex: index, isLeapMonth: false, displayName: month.name }))
	}

	const { solar_divisions, moon_index } = leapTemplate.lunisolar
	const regularMonths = data.months.filter(m => m.month_type !== 'lunisolar_leap')

	// Get orbital data — either from planet link or from moon config
	const moon = data.moons[moon_index]
	if (!moon) {
		return regularMonths.map((month, index) => ({ month, sourceIndex: index, isLeapMonth: false, displayName: month.name }))
	}

	const lunarCycle = data.planet?.moons.find(m => m.id === moon.rodder_id)?.orbital_period_days ?? moon.cycle
	const solarYear = data.planet?.orbital_period_days ?? regularMonths.reduce((sum, m) => sum + m.length, 0)

	if (lunarCycle <= 0 || solarYear <= 0 || solar_divisions <= 0) {
		return regularMonths.map((month, index) => ({ month, sourceIndex: index, isLeapMonth: false, displayName: month.name }))
	}

	// Solar term length in days
	const solarTermLength = solarYear / solar_divisions

	// A leap year has more lunar months than regular months. This uses a
	// Metonic-like cycle: a leap month occurs when the accumulated excess lunar
	// months crosses a threshold, giving ~7 leap months per 19-year cycle for Earth.
	const excessPerYear = solarYear / lunarCycle - regularMonths.length
	const accumulatedExcess = excessPerYear * year
	const isLeapYear = Math.floor(accumulatedExcess) !== Math.floor(accumulatedExcess - excessPerYear)

	if (!isLeapYear) {
		return regularMonths.map((month, index) => ({ month, sourceIndex: index, isLeapMonth: false, displayName: month.name }))
	}

	// Determine WHERE the leap month goes.
	// Compute the solar term boundaries as fractions of the year (0 to 1).
	// For "major" solar terms (every other one in Chinese system, or every one in Hindu):
	// Use solar_divisions directly — each division is a major boundary.
	// The leap month is the first lunar month that doesn't span a major boundary.

	// Compute start day of each lunar month in the year (relative to year start, in days)
	// Use moon phase at year start to find the first new moon
	const yearStartAbs = absoluteDayForYearStart(year, regularMonths)
	const moonPhaseAtYearStart = ((yearStartAbs - moon.offset) / lunarCycle) % 1
	const daysToFirstNewMoon = ((1 - moonPhaseAtYearStart) % 1) * lunarCycle

	// Generate new moon positions for this year (enough to cover all months + potential leap)
	const newMoons: number[] = []
	let nm = daysToFirstNewMoon
	while (nm < solarYear + lunarCycle) {
		newMoons.push(nm)
		nm += lunarCycle
	}

	// Solar term boundaries (major terms only)
	const solarTerms: number[] = []
	for (let index = 1; index <= solar_divisions; index++) {
		solarTerms.push(index * solarTermLength)
	}

	// For each lunar month interval [newMoons[i], newMoons[i+1]),
	// check if it contains a major solar term boundary
	let leapAfterMonth = -1
	let lunarIndex = 0
	for (let index = 0; index < newMoons.length - 1 && lunarIndex < regularMonths.length + 1; index++) {
		const monthStart = newMoons[index]
		const monthEnd = newMoons[index + 1]

		// Does this lunar month contain a major solar term?
		const containsTerm = solarTerms.some(t => t > monthStart && t <= monthEnd)

		if (!containsTerm && leapAfterMonth === -1) {
			// This is the leap month — it comes after the previous regular month
			leapAfterMonth = Math.max(0, lunarIndex - 1)
			// Don't increment lunarIdx — this month is the inserted leap
		} else {
			lunarIndex++
		}
	}

	// Fallback: if no gap found, insert after the last month
	if (leapAfterMonth === -1) leapAfterMonth = regularMonths.length - 1

	// Build the layout with the leap month inserted
	const layout: MonthLayout[] = []
	for (let index = 0; index < regularMonths.length; index++) {
		layout.push({
			month: regularMonths[index],
			sourceIndex: data.months.indexOf(regularMonths[index]),
			isLeapMonth: false,
			displayName: regularMonths[index].name,
		})

		if (index === leapAfterMonth) {
			layout.push({
				month: { ...leapTemplate, length: Math.round(lunarCycle) },
				sourceIndex: data.months.indexOf(leapTemplate),
				isLeapMonth: true,
				displayName: leapTemplate.name.replace('{{month}}', regularMonths[index].name),
			})
		}
	}

	return layout
}

/** Helper: compute absolute day of year start without full absoluteDay (avoids circular dependency) */
function absoluteDayForYearStart(year: number, regularMonths: Month[]): number {
	const avgYearDays = regularMonths.reduce((sum, m) => sum + m.length, 0)
	// Rough approximation for epoch-relative positioning — sufficient for phase calculation
	return (year - 1) * avgYearDays
}

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

/** Get total days in a layout month (including any leap days) */
export function daysInMonth(data: StaticCalendarData, year: number, monthIndex: number): number {
	const layout = computeYearLayout(data, year)
	return daysInLayoutMonth(data, year, layout, monthIndex)
}

/** Internal: compute days for a month in the computed layout */
function daysInLayoutMonth(data: StaticCalendarData, year: number, layout: MonthLayout[], layoutIndex: number): number {
	const entry = layout[layoutIndex]
	if (!entry) return 0

	const month = entry.month

	// Intercalary months only appear on certain years (non-lunisolar)
	if (month.month_type === 'intercalary') {
		const interval = month.interval ?? 1
		const offset = month.offset ?? 0
		if ((year + offset) % interval !== 0) return 0
	}

	let days = month.length

	// Add leap days that belong to this month's source index
	for (const ld of data.leap_days) {
		if (ld.month_index === entry.sourceIndex && leapDayApplies(ld, year)) {
			days += 1
		}
	}

	return days
}

/** Get total days in a year */
export function daysInYear(data: StaticCalendarData, year: number): number {
	const layout = computeYearLayout(data, year)
	let total = 0
	for (let index = 0; index < layout.length; index++) {
		total += daysInLayoutMonth(data, year, layout, index)
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
		for (let y = date.year; y < 1; y++) {
			abs -= daysInYear(data, y)
		}
	}

	// Sum all prior months in the current year (month is 1-indexed)
	const layout = computeYearLayout(data, date.year)
	for (let m = 0; m < date.month - 1; m++) {
		abs += daysInLayoutMonth(data, date.year, layout, m)
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
	}

	// Find month using layout
	const layout = computeYearLayout(data, year)
	let month = 1
	for (let m = 0; m < layout.length; m++) {
		const mDays = daysInLayoutMonth(data, year, layout, m)
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
		const sorted = dated.toSorted((a, b) => {
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
	const layout = computeYearLayout(data, d.year)
	const monthName = layout[monthIndex]?.displayName ?? data.months[monthIndex]?.name ?? `Month ${d.month}`
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
	const layout = computeYearLayout(data, year)
	const monthName = layout[monthIndex]?.displayName ?? data.months[monthIndex]?.name ?? ''

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
