// ============================================================================
// Fantasy Calendar Type Definitions
// ============================================================================

/** Top-level calendar configuration — stored as JSONB in Postgres */
export interface CalendarConfig {
	name: string
	description: string
	primary: boolean
	static_data: StaticCalendarData
}

/** All calendar rules: months, weekdays, leap days, moons, eras, seasons */
export interface StaticCalendarData {
	/** 0-indexed weekday that year 1, month 1, day 1 falls on */
	first_week_day: number
	weekdays: Weekday[]
	months: Month[]
	leap_days: LeapDay[]
	moons: Moon[]
	eras: Era[]
	seasons: Season[]
	/** Whether to show moon phases in the calendar widget */
	display_moons: boolean
	/** Added to displayed year numbers (for year numbering offset) */
	year_offset: number
	/** Days between Unix epoch (1970-01-01) and this calendar's year 1 day 1.
	 *  Positive = calendar year 1 is before 1970. Negative = after 1970.
	 *  Example: if year 1 day 1 = 1970-01-01, offset = 0. */
	epoch_offset: number
}

export interface Weekday {
	name: string
	abbreviation?: string
}

export interface Month {
	name: string
	/** Days in a normal (non-leap) year */
	length: number
	/** "regular" or "intercalary" */
	month_type: MonthType
	/** For intercalary months: appears every N years */
	interval?: number
	/** For intercalary months: offset from interval cycle */
	offset?: number
	short_name?: string
}

export type MonthType = 'regular' | 'intercalary'

export interface LeapDay {
	name: string
	/** 0-based month index this day is added to */
	month_index: number
	/** 1-based: inserted after this day of the month */
	after_day: number
	/** Year must be divisible by this */
	interval: number
	/** Divisibility values that cancel the leap day (e.g. 100 for Gregorian) */
	ignore: number[]
	/** Overrides ignore: if divisible by this, leap day IS added (e.g. 400 for Gregorian) */
	exclusive: number[]
	/** Whether this day doesn't advance weekday progression */
	intercalary: boolean
	/** Offset applied to year before divisibility check */
	offset: number
}

export interface Moon {
	name: string
	/** Orbital period in days (fractional) */
	cycle: number
	/** Phase offset in days */
	offset: number
	/** Hex color for lit portion */
	face_color: string
	/** Hex color for shadow portion */
	shadow_color: string
}

export interface Era {
	name: string
	/** Format string with {{year}} and {{era_name}} placeholders */
	format?: string
	/** Inclusive start year */
	start_year: number
	/** Optional end year (null = open-ended/current) */
	end_year?: number | null
	/** Whether years count backward within this era */
	reverse_numbering: boolean
}

export interface Season {
	name: string
	timing: SeasonTiming
	kind: SeasonKind
	color?: string
	weather?: Weather
}

export type SeasonTiming =
	| { type: 'dated', month: number, day: number }
	| { type: 'periodic', duration: number }

export type SeasonKind = 'winter' | 'spring' | 'summer' | 'autumn' | 'custom'

export interface Weather {
	temp_low?: number
	temp_high?: number
	precipitation?: number
	cloudiness?: number
	wind_intensity?: number
}

/** A date in the calendar system (year/month/day) */
export interface CalendarDate {
	year: number
	/** 1-indexed month number */
	month: number
	/** 1-indexed day of month */
	day: number
}

/** @deprecated Use CalendarDate instead */
export type CurrentDate = CalendarDate

/** Fully resolved display info for a date */
export interface ResolvedDate {
	year: number
	/** 0-based month index */
	month_index: number
	/** 1-based day */
	day: number
	month_name: string
	day_of_week_name: string
	era_name: string
	season_name: string
	year_display: string
	moon_phases: MoonPhase[]
}

export interface MoonPhase {
	moon_name: string
	/** 0.0 = new, 0.5 = full */
	phase: number
	phase_name: string
	face_color: string
	shadow_color: string
}
