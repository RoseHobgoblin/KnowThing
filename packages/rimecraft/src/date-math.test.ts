import { describe, it, expect } from 'vitest'
import type { CalendarConfig, StaticCalendarData, CalendarDate } from './types.js'
import {
	leapDayApplies,
	daysInMonth,
	daysInYear,
	absoluteDay,
	dateFromAbsolute,
	dayOfWeek,
	dayOfWeekName,
	eraForYear,
	formatYearWithEra,
	seasonForDate,
	moonPhase,
	phaseName,
	resolveDisplay,
	getMonthGrid,
	computeYearLayout,
} from './date-math.js'

// ── Test calendar: modeled after "Calendar of Amalur" ───────────────────

const TEST_DATA: StaticCalendarData = {
	first_week_day: 0,
	weekdays: [
		{ name: 'Starday', abbreviation: 'St' },
		{ name: 'Sunday', abbreviation: 'Su' },
		{ name: 'Moonday', abbreviation: 'Mo' },
		{ name: 'Towerday', abbreviation: 'To' },
		{ name: 'Heavensday', abbreviation: 'He' },
		{ name: 'Seaday', abbreviation: 'Se' },
		{ name: 'Valday', abbreviation: 'Va' },
	],
	months: [
		{ name: 'Afteryule', length: 30, month_type: 'regular' },
		{ name: 'Solmath', length: 30, month_type: 'regular' },
		{ name: 'Rethe', length: 30, month_type: 'regular' },
		{ name: 'Astron', length: 30, month_type: 'regular' },
		{ name: 'Thrimidge', length: 31, month_type: 'regular' },
		{ name: 'Forelithe', length: 30, month_type: 'regular' },
		{ name: 'Afterlithe', length: 31, month_type: 'regular' },
		{ name: 'Wedmath', length: 30, month_type: 'regular' },
		{ name: 'Halimath', length: 30, month_type: 'regular' },
		{ name: 'Winterfilth', length: 30, month_type: 'regular' },
		{ name: 'Blotmath', length: 30, month_type: 'regular' },
		{ name: 'Foreyule', length: 30, month_type: 'regular' },
	],
	leap_days: [
		{
			name: 'Mid-year\'s Day',
			month_index: 5, // Forelithe
			after_day: 30,
			interval: 4,
			ignore: [128],
			exclusive: [512],
			intercalary: false,
			offset: 0,
		},
	],
	moons: [
		{ name: 'Ithil', cycle: 29.53, offset: 3.5, face_color: '#FFFFF0', shadow_color: '#292b4a' },
		{ name: 'Tilion\'s Eye', cycle: 45, offset: 10, face_color: '#FFD700', shadow_color: '#292b4a' },
	],
	eras: [
		{ name: 'FA', format: '{{year}} FA', start_year: 1, end_year: 590, reverse_numbering: false },
		{ name: 'SA', format: '{{year}} SA', start_year: 591, end_year: 4091, reverse_numbering: false },
		{ name: 'TA', format: '{{year}} TA', start_year: 4092, end_year: null, reverse_numbering: false },
	],
	seasons: [
		{
			name: 'Deep Winter',
			timing: { type: 'dated', month: 0, day: 1 },
			kind: 'winter',
			color: '#a8c8e8',
		},
		{
			name: 'Stirring',
			timing: { type: 'dated', month: 2, day: 15 },
			kind: 'spring',
			color: '#90ee90',
		},
		{
			name: 'High Summer',
			timing: { type: 'dated', month: 5, day: 1 },
			kind: 'summer',
			color: '#ffdd57',
		},
		{
			name: 'Fading',
			timing: { type: 'dated', month: 8, day: 15 },
			kind: 'autumn',
			color: '#deb887',
		},
	],
	display_moons: true,
	year_offset: 0,
	epoch_offset: 0,
}

const TEST_CONFIG: CalendarConfig = {
	name: 'Calendar of Amalur',
	description: 'Test calendar',
	primary: true,
	static_data: TEST_DATA,
}

describe('leapDayApplies', () => {
	const ld = TEST_DATA.leap_days[0]

	it('applies on year divisible by 4', () => {
		expect(leapDayApplies(ld, 4)).toBe(true)
		expect(leapDayApplies(ld, 8)).toBe(true)
		expect(leapDayApplies(ld, 100)).toBe(true)
	})

	it('does not apply on non-divisible years', () => {
		expect(leapDayApplies(ld, 1)).toBe(false)
		expect(leapDayApplies(ld, 3)).toBe(false)
		expect(leapDayApplies(ld, 5)).toBe(false)
	})

	it('does not apply on years divisible by 128 (ignore)', () => {
		expect(leapDayApplies(ld, 128)).toBe(false)
		expect(leapDayApplies(ld, 256)).toBe(false)
	})

	it('does apply on years divisible by 512 (exclusive override)', () => {
		expect(leapDayApplies(ld, 512)).toBe(true)
		expect(leapDayApplies(ld, 1024)).toBe(true)
	})
})

describe('daysInMonth', () => {
	it('returns normal month length', () => {
		expect(daysInMonth(TEST_DATA, 1, 0)).toBe(30) // Afteryule
		expect(daysInMonth(TEST_DATA, 1, 4)).toBe(31) // Thrimidge
	})

	it('adds leap day in leap year', () => {
		// Forelithe (index 5) is 30 days, +1 leap day in year 4
		expect(daysInMonth(TEST_DATA, 4, 5)).toBe(31)
		expect(daysInMonth(TEST_DATA, 3, 5)).toBe(30)
	})
})

describe('daysInYear', () => {
	it('returns 362 for a normal year (12 months)', () => {
		// 10 months * 30 + 2 months * 31 = 362
		expect(daysInYear(TEST_DATA, 1)).toBe(362)
	})

	it('returns 363 for a leap year', () => {
		expect(daysInYear(TEST_DATA, 4)).toBe(363)
	})
})

describe('absoluteDay and dateFromAbsolute', () => {
	it('day 0 = year 1, month 1, day 1', () => {
		expect(absoluteDay(TEST_DATA, { year: 1, month: 1, day: 1 })).toBe(0)
	})

	it('round-trips through absolute', () => {
		const dates: CalendarDate[] = [
			{ year: 1, month: 1, day: 1 },
			{ year: 1, month: 1, day: 30 },
			{ year: 1, month: 2, day: 1 },
			{ year: 2, month: 1, day: 1 },
			{ year: 4, month: 6, day: 31 }, // Leap day in Forelithe
			{ year: 100, month: 6, day: 15 },
			{ year: 4524, month: 3, day: 14 },
		]

		for (const date of dates) {
			const abs = absoluteDay(TEST_DATA, date)
			const restored = dateFromAbsolute(TEST_DATA, abs)
			expect(restored).toEqual(date)
		}
	})
})

describe('dayOfWeek', () => {
	it('year 1 day 1 falls on first_week_day', () => {
		expect(dayOfWeek(TEST_DATA, { year: 1, month: 1, day: 1 })).toBe(0)
	})

	it('cycles through weekdays', () => {
		const day1 = dayOfWeek(TEST_DATA, { year: 1, month: 1, day: 1 })
		const day2 = dayOfWeek(TEST_DATA, { year: 1, month: 1, day: 2 })
		expect(day2).toBe((day1 + 1) % 7)
	})

	it('returns correct weekday name', () => {
		const name = dayOfWeekName(TEST_DATA, { year: 1, month: 1, day: 1 })
		expect(name).toBe('Starday')
	})
})

describe('eras', () => {
	it('finds correct era', () => {
		expect(eraForYear(TEST_DATA, 1)?.name).toBe('FA')
		expect(eraForYear(TEST_DATA, 590)?.name).toBe('FA')
		expect(eraForYear(TEST_DATA, 591)?.name).toBe('SA')
		expect(eraForYear(TEST_DATA, 4091)?.name).toBe('SA')
		expect(eraForYear(TEST_DATA, 4092)?.name).toBe('TA')
		expect(eraForYear(TEST_DATA, 9999)?.name).toBe('TA')
	})

	it('formats year with era', () => {
		expect(formatYearWithEra(TEST_DATA, 1)).toBe('1 FA')
		expect(formatYearWithEra(TEST_DATA, 591)).toBe('1 SA')
		expect(formatYearWithEra(TEST_DATA, 4092)).toBe('1 TA')
		expect(formatYearWithEra(TEST_DATA, 4524)).toBe('433 TA')
	})
})

describe('seasons', () => {
	it('detects Deep Winter', () => {
		expect(seasonForDate(TEST_DATA, { year: 1, month: 1, day: 1 })?.name).toBe('Deep Winter')
	})

	it('detects Stirring', () => {
		// Rethe (month 3, 1-indexed), day 15
		expect(seasonForDate(TEST_DATA, { year: 1, month: 3, day: 16 })?.name).toBe('Stirring')
	})

	it('detects High Summer', () => {
		// Forelithe (month 6, 1-indexed), day 1
		expect(seasonForDate(TEST_DATA, { year: 1, month: 6, day: 5 })?.name).toBe('High Summer')
	})

	it('detects Fading', () => {
		// Halimath (month 9, 1-indexed), day 15
		expect(seasonForDate(TEST_DATA, { year: 1, month: 9, day: 20 })?.name).toBe('Fading')
	})

	it('wraps to Fading at end of year', () => {
		// Foreyule (month 12) — should still be Fading
		expect(seasonForDate(TEST_DATA, { year: 1, month: 12, day: 30 })?.name).toBe('Fading')
	})
})

describe('moon phases', () => {
	it('returns phase between 0 and 1', () => {
		const phase = moonPhase(TEST_DATA.moons[0], TEST_DATA, { year: 1, month: 1, day: 1 })
		expect(phase).toBeGreaterThanOrEqual(0)
		expect(phase).toBeLessThan(1)
	})

	it('completes a full cycle', () => {
		const ithil = TEST_DATA.moons[0]
		// ~30 days should be roughly one cycle
		const phase1 = moonPhase(ithil, TEST_DATA, { year: 1, month: 1, day: 1 })
		const phase30 = moonPhase(ithil, TEST_DATA, { year: 1, month: 1, day: 30 })
		// They should be close (29.53 day cycle vs 29 day diff)
		expect(Math.abs(phase1 - phase30)).toBeLessThan(0.05)
	})

	it('phaseName returns correct names', () => {
		expect(phaseName(0)).toBe('New Moon')
		expect(phaseName(0.125)).toBe('Waxing Crescent')
		expect(phaseName(0.25)).toBe('First Quarter')
		expect(phaseName(0.375)).toBe('Waxing Gibbous')
		expect(phaseName(0.5)).toBe('Full Moon')
		expect(phaseName(0.625)).toBe('Waning Gibbous')
		expect(phaseName(0.75)).toBe('Last Quarter')
		expect(phaseName(0.875)).toBe('Waning Crescent')
	})
})

describe('resolveDisplay', () => {
	it('resolves a given date', () => {
		const resolved = resolveDisplay(TEST_CONFIG, { year: 4524, month: 3, day: 14 })
		expect(resolved.year).toBe(4524)
		expect(resolved.month_name).toBe('Rethe')
		expect(resolved.day).toBe(14)
		expect(resolved.era_name).toBe('TA')
		expect(resolved.year_display).toBe('433 TA')
		expect(resolved.season_name).toBe('Deep Winter') // Before Stirring starts on Rethe 15
		expect(resolved.moon_phases).toHaveLength(2)
		expect(resolved.moon_phases[0].moon_name).toBe('Ithil')
		expect(resolved.moon_phases[1].moon_name).toBe('Tilion\'s Eye')
	})

	it('resolves a specific date', () => {
		const resolved = resolveDisplay(TEST_CONFIG, { year: 1, month: 1, day: 1 })
		expect(resolved.year_display).toBe('1 FA')
		expect(resolved.day_of_week_name).toBe('Starday')
	})
})

describe('getMonthGrid', () => {
	it('returns correct grid for first month of year 1', () => {
		const grid = getMonthGrid(TEST_CONFIG, 1, 0)
		expect(grid.monthName).toBe('Afteryule')
		expect(grid.totalDays).toBe(30)
		expect(grid.weekdays).toEqual(['St', 'Su', 'Mo', 'To', 'He', 'Se', 'Va'])
		// Day 1 should be on Starday (index 0), so no leading nulls
		expect(grid.days[0]).toBe(1)
		expect(grid.days[29]).toBe(30)
	})

	it('has correct leap day month', () => {
		const grid = getMonthGrid(TEST_CONFIG, 4, 5) // Forelithe in leap year
		expect(grid.totalDays).toBe(31)
	})
})

// ── Variable day length ───────────────────────────────────────────────────

describe('variable day length', () => {
	// A calendar with 20-hour days (72000 seconds)
	const SHORT_DAY_DATA: StaticCalendarData = {
		...TEST_DATA,
		day_length_seconds: 72_000,
	}


	it('date math is unaffected by day_length_seconds', () => {
		// absoluteDay and dateFromAbsolute work in calendar days, not real time
		// So they should be identical regardless of day_length_seconds
		const date: CalendarDate = { year: 1, month: 1, day: 15 }
		const abs = absoluteDay(SHORT_DAY_DATA, date)
		expect(abs).toBe(absoluteDay(TEST_DATA, date))

		const roundTrip = dateFromAbsolute(SHORT_DAY_DATA, abs)
		expect(roundTrip).toEqual(date)
	})

	it('know-date converts timestamps using day length', async () => {
		const { unixToAbsoluteDay, absoluteDayToUnix } = await import('./know-date.js')

		// With 86400s day: 86400000ms = 1 day
		expect(unixToAbsoluteDay(86_400_000, 0, 86_400)).toBe(1)

		// With 72000s day: 72000000ms = 1 day
		expect(unixToAbsoluteDay(72_000_000, 0, 72_000)).toBe(1)

		// 86400000ms at 72000s/day = 1.2 days = day 1 (floor)
		expect(unixToAbsoluteDay(86_400_000, 0, 72_000)).toBe(1)

		// Round-trip
		const ts = absoluteDayToUnix(10, 0, 72_000)
		expect(ts).toBe(10 * 72_000_000)
		expect(unixToAbsoluteDay(ts, 0, 72_000)).toBe(10)
	})
})

// ── Lunisolar calendar ──────────────────────────────────────────────────

describe('lunisolar intercalation', () => {
	// A Chinese-like lunisolar calendar on an Earth-like planet
	const LUNISOLAR_DATA: StaticCalendarData = {
		first_week_day: 0,
		weekdays: [
			{ name: 'Day1' }, { name: 'Day2' }, { name: 'Day3' },
			{ name: 'Day4' }, { name: 'Day5' }, { name: 'Day6' }, { name: 'Day7' },
		],
		months: [
			{ name: 'Month 1', length: 30, month_type: 'regular' },
			{ name: 'Month 2', length: 29, month_type: 'regular' },
			{ name: 'Month 3', length: 30, month_type: 'regular' },
			{ name: 'Month 4', length: 29, month_type: 'regular' },
			{ name: 'Month 5', length: 30, month_type: 'regular' },
			{ name: 'Month 6', length: 29, month_type: 'regular' },
			{ name: 'Month 7', length: 30, month_type: 'regular' },
			{ name: 'Month 8', length: 29, month_type: 'regular' },
			{ name: 'Month 9', length: 30, month_type: 'regular' },
			{ name: 'Month 10', length: 29, month_type: 'regular' },
			{ name: 'Month 11', length: 30, month_type: 'regular' },
			{ name: 'Month 12', length: 29, month_type: 'regular' },
			// The lunisolar leap month template
			{
				name: 'Leap {{month}}',
				length: 29,
				month_type: 'lunisolar_leap',
				lunisolar: { solar_divisions: 24, moon_index: 0 },
			},
		],
		leap_days: [],
		moons: [
			{ name: 'Moon', cycle: 29.5306, offset: 0, face_color: '#fff', shadow_color: '#000' },
		],
		eras: [],
		seasons: [],
		display_moons: true,
		year_offset: 0,
		epoch_offset: 0,
		// Planet data: Earth-like orbital period
		planet: {
			orbital_period_days: 365.2422,
			rotation_period_s: 86400,
			moons: [{ id: 1, orbital_period_days: 29.5306, epoch_phase: 0 }],
		},
	}

	it('regular year has 12 months', () => {
		// Year 1 may or may not be a leap year, but check that non-leap years have 12
		const nonLeapLayouts: number[] = []
		for (let y = 1; y <= 19; y++) {
			const l = computeYearLayout(LUNISOLAR_DATA, y)
			nonLeapLayouts.push(l.length)
		}
		// Over 19 years, ~7 should have 13 months and ~12 should have 12
		const leapYears = nonLeapLayouts.filter(n => n === 13).length
		const normalYears = nonLeapLayouts.filter(n => n === 12).length
		expect(leapYears).toBeGreaterThanOrEqual(6)
		expect(leapYears).toBeLessThanOrEqual(8)
		expect(normalYears + leapYears).toBe(19)
	})

	it('leap year has 13 months', () => {
		// Find a leap year in the first 19
		let leapYear = -1
		for (let y = 1; y <= 19; y++) {
			if (computeYearLayout(LUNISOLAR_DATA, y).length === 13) {
				leapYear = y
				break
			}
		}
		expect(leapYear).toBeGreaterThan(0)

		const layout = computeYearLayout(LUNISOLAR_DATA, leapYear)
		expect(layout.length).toBe(13)

		// Exactly one month should be a leap month
		const leapMonths = layout.filter(m => m.isLeapMonth)
		expect(leapMonths.length).toBe(1)
		expect(leapMonths[0].displayName).toContain('Leap')
	})

	it('leap month has approximately one lunar cycle of days', () => {
		for (let y = 1; y <= 19; y++) {
			const layout = computeYearLayout(LUNISOLAR_DATA, y)
			const leap = layout.find(m => m.isLeapMonth)
			if (leap) {
				// Leap month should be ~29-30 days (one lunar cycle)
				expect(leap.month.length).toBeGreaterThanOrEqual(29)
				expect(leap.month.length).toBeLessThanOrEqual(30)
			}
		}
	})

	it('absoluteDay and dateFromAbsolute round-trip in lunisolar calendar', () => {
		const dates: CalendarDate[] = [
			{ year: 1, month: 1, day: 1 },
			{ year: 1, month: 6, day: 15 },
			{ year: 3, month: 1, day: 1 },
			{ year: 10, month: 12, day: 29 },
		]
		for (const date of dates) {
			const abs = absoluteDay(LUNISOLAR_DATA, date)
			const restored = dateFromAbsolute(LUNISOLAR_DATA, abs)
			expect(restored).toEqual(date)
		}
	})

	it('daysInYear is consistent with month layout', () => {
		for (let y = 1; y <= 19; y++) {
			const layout = computeYearLayout(LUNISOLAR_DATA, y)
			let sum = 0
			for (let m = 0; m < layout.length; m++) {
				sum += daysInMonth(LUNISOLAR_DATA, y, m)
			}
			expect(sum).toBe(daysInYear(LUNISOLAR_DATA, y))
		}
	})
})
