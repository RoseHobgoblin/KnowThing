import { describe, it, expect } from 'vitest'
import type { StaticCalendarData } from './types.js'
import { validateCalendar, isReckonable } from './validate.js'
import { calendarPresets } from './presets.js'

/** A minimal, internally-consistent calendar to mutate per-test. */
function baseData(): StaticCalendarData {
	return {
		first_week_day: 0,
		weekdays: [{ name: 'One' }, { name: 'Two' }],
		months: [
			{ name: 'First', length: 30, month_type: 'regular' },
			{ name: 'Second', length: 30, month_type: 'regular' },
		],
		leap_days: [],
		moons: [{ name: 'Moon', cycle: 30, offset: 0, face_color: '#fff', shadow_color: '#000' }],
		eras: [{ name: 'Age', start_year: 1, end_year: null, reverse_numbering: false }],
		seasons: [],
		display_moons: true,
		year_offset: 0,
		epoch_offset: 0,
	}
}

describe('validateCalendar', () => {
	it('passes a well-formed calendar with no issues', () => {
		expect(validateCalendar(baseData())).toEqual([])
		expect(isReckonable(baseData())).toBe(true)
	})

	it('accepts every shipped preset', () => {
		for (const preset of calendarPresets) {
			expect(validateCalendar(preset.staticData), preset.label).toEqual([])
		}
	})

	it('flags a first_week_day outside the week', () => {
		const data = baseData()
		data.first_week_day = 5
		const issues = validateCalendar(data)
		expect(issues).toHaveLength(1)
		expect(issues[0]).toMatchObject({ path: 'first_week_day', severity: 'error' })
		expect(isReckonable(data)).toBe(false)
	})

	it('flags an empty week and empty month list', () => {
		const data = baseData()
		data.weekdays = []
		data.months = []
		const paths = validateCalendar(data).map(index => index.path)
		expect(paths).toContain('weekdays')
		expect(paths).toContain('months')
	})

	it('flags a leap day inserted past the end of its month', () => {
		const data = baseData()
		data.leap_days = [{
			name: 'Extra', month_index: 0, after_day: 99,
			interval: 4, ignore: [], exclusive: [], intercalary: false, offset: 0,
		}]
		const issues = validateCalendar(data)
		expect(issues).toHaveLength(1)
		expect(issues[0]).toMatchObject({ path: 'leap_days.0.after_day', severity: 'error' })
	})

	it('flags a leap day whose target month does not exist', () => {
		const data = baseData()
		data.leap_days = [{
			name: 'Extra', month_index: 7, after_day: 1,
			interval: 4, ignore: [], exclusive: [], intercalary: false, offset: 0,
		}]
		expect(validateCalendar(data)[0]).toMatchObject({ path: 'leap_days.0.month_index', severity: 'error' })
	})

	it('flags a lunisolar leap month referencing a missing moon', () => {
		const data = baseData()
		data.months.push({
			name: 'Leap {{month}}', length: 30, month_type: 'lunisolar_leap',
			lunisolar: { solar_divisions: 24, moon_index: 9 },
		})
		expect(validateCalendar(data).some(index => index.path === 'months.2.lunisolar.moon_index')).toBe(true)
	})

	it('flags an era that ends before it starts', () => {
		const data = baseData()
		data.eras = [{ name: 'Backwards', start_year: 100, end_year: 50, reverse_numbering: false }]
		expect(validateCalendar(data)[0]).toMatchObject({ path: 'eras.0.end_year', severity: 'error' })
	})

	it('warns on reverse numbering with no end year', () => {
		const data = baseData()
		data.eras = [{ name: 'Countdown', start_year: 1, end_year: null, reverse_numbering: true }]
		const issues = validateCalendar(data)
		expect(issues).toHaveLength(1)
		expect(issues[0]).toMatchObject({ severity: 'warning' })
		expect(isReckonable(data)).toBe(true) // warnings don't block reckoning
	})

	it('flags a dated season on a day the month lacks', () => {
		const data = baseData()
		data.seasons = [{ name: 'Bloom', kind: 'spring', timing: { type: 'dated', month: 0, day: 40 } }]
		expect(validateCalendar(data)[0]).toMatchObject({ path: 'seasons.0.timing.day', severity: 'error' })
	})

	it('warns when a season low temperature exceeds its high', () => {
		const data = baseData()
		data.seasons = [{
			name: 'Odd', kind: 'custom', timing: { type: 'periodic', duration: 90 },
			weather: { temp_low: 30, temp_high: 10 },
		}]
		expect(validateCalendar(data)[0]).toMatchObject({ path: 'seasons.0.weather.temp_low', severity: 'warning' })
	})
})
