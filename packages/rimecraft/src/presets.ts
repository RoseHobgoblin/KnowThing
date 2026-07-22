import type { StaticCalendarData } from './types.js'

export interface CalendarPreset {
	label: string
	description: string
	name: string
	staticData: StaticCalendarData
}

export const calendarPresets: CalendarPreset[] = [
	{
		label: 'Gregorian',
		description: 'Standard civil calendar with 12 months, 7-day weeks, and Gregorian leap year rules.',
		name: 'Gregorian Calendar',
		staticData: {
			first_week_day: 0,
			weekdays: [
				{ name: 'Monday', abbreviation: 'Mon' },
				{ name: 'Tuesday', abbreviation: 'Tue' },
				{ name: 'Wednesday', abbreviation: 'Wed' },
				{ name: 'Thursday', abbreviation: 'Thu' },
				{ name: 'Friday', abbreviation: 'Fri' },
				{ name: 'Saturday', abbreviation: 'Sat' },
				{ name: 'Sunday', abbreviation: 'Sun' },
			],
			months: [
				{ name: 'January', length: 31, month_type: 'regular' },
				{ name: 'February', length: 28, month_type: 'regular' },
				{ name: 'March', length: 31, month_type: 'regular' },
				{ name: 'April', length: 30, month_type: 'regular' },
				{ name: 'May', length: 31, month_type: 'regular' },
				{ name: 'June', length: 30, month_type: 'regular' },
				{ name: 'July', length: 31, month_type: 'regular' },
				{ name: 'August', length: 31, month_type: 'regular' },
				{ name: 'September', length: 30, month_type: 'regular' },
				{ name: 'October', length: 31, month_type: 'regular' },
				{ name: 'November', length: 30, month_type: 'regular' },
				{ name: 'December', length: 31, month_type: 'regular' },
			],
			leap_days: [
				{
					name: 'Leap Day',
					month_index: 1,
					after_day: 28,
					interval: 4,
					ignore: [100],
					exclusive: [400],
					intercalary: false,
					offset: 0,
				},
			],
			moons: [
				{ name: 'Luna', cycle: 29.5306, offset: 0, face_color: '#F5F5DC', shadow_color: '#2B2B2B' },
			],
			eras: [
				{ name: 'BCE', format: '{{year}} {{era_name}}', start_year: -9999, end_year: 0, reverse_numbering: true },
				{ name: 'CE', format: '{{year}} {{era_name}}', start_year: 1, end_year: null, reverse_numbering: false },
			],
			seasons: [
				{ name: 'Winter', timing: { type: 'dated', month: 11, day: 21 }, kind: 'winter', color: '#87CEEB' },
				{ name: 'Spring', timing: { type: 'dated', month: 2, day: 20 }, kind: 'spring', color: '#90EE90' },
				{ name: 'Summer', timing: { type: 'dated', month: 5, day: 21 }, kind: 'summer', color: '#FFD700' },
				{ name: 'Autumn', timing: { type: 'dated', month: 8, day: 22 }, kind: 'autumn', color: '#FF8C00' },
			],
			display_moons: true,
			year_offset: 0,
			epoch_offset: 0,
			day_length_seconds: 86_400,
		},
	},
	{
		label: 'Julian',
		description: 'Pre-Gregorian calendar — leap year every 4 years with no century exception.',
		name: 'Julian Calendar',
		staticData: {
			first_week_day: 0,
			weekdays: [
				{ name: 'Monday', abbreviation: 'Mon' },
				{ name: 'Tuesday', abbreviation: 'Tue' },
				{ name: 'Wednesday', abbreviation: 'Wed' },
				{ name: 'Thursday', abbreviation: 'Thu' },
				{ name: 'Friday', abbreviation: 'Fri' },
				{ name: 'Saturday', abbreviation: 'Sat' },
				{ name: 'Sunday', abbreviation: 'Sun' },
			],
			months: [
				{ name: 'January', length: 31, month_type: 'regular' },
				{ name: 'February', length: 28, month_type: 'regular' },
				{ name: 'March', length: 31, month_type: 'regular' },
				{ name: 'April', length: 30, month_type: 'regular' },
				{ name: 'May', length: 31, month_type: 'regular' },
				{ name: 'June', length: 30, month_type: 'regular' },
				{ name: 'July', length: 31, month_type: 'regular' },
				{ name: 'August', length: 31, month_type: 'regular' },
				{ name: 'September', length: 30, month_type: 'regular' },
				{ name: 'October', length: 31, month_type: 'regular' },
				{ name: 'November', length: 30, month_type: 'regular' },
				{ name: 'December', length: 31, month_type: 'regular' },
			],
			leap_days: [
				{
					name: 'Leap Day',
					month_index: 1,
					after_day: 28,
					interval: 4,
					ignore: [],
					exclusive: [],
					intercalary: false,
					offset: 0,
				},
			],
			moons: [
				{ name: 'Luna', cycle: 29.5306, offset: 0, face_color: '#F5F5DC', shadow_color: '#2B2B2B' },
			],
			eras: [
				{ name: 'BC', format: '{{year}} {{era_name}}', start_year: -9999, end_year: 0, reverse_numbering: true },
				{ name: 'AD', format: '{{year}} {{era_name}}', start_year: 1, end_year: null, reverse_numbering: false },
			],
			seasons: [
				{ name: 'Winter', timing: { type: 'dated', month: 11, day: 21 }, kind: 'winter', color: '#87CEEB' },
				{ name: 'Spring', timing: { type: 'dated', month: 2, day: 20 }, kind: 'spring', color: '#90EE90' },
				{ name: 'Summer', timing: { type: 'dated', month: 5, day: 21 }, kind: 'summer', color: '#FFD700' },
				{ name: 'Autumn', timing: { type: 'dated', month: 8, day: 22 }, kind: 'autumn', color: '#FF8C00' },
			],
			display_moons: true,
			year_offset: 0,
			epoch_offset: 0,
			day_length_seconds: 86_400,
		},
	},
	{
		label: 'Simple Fantasy',
		description: '12 months of 30 days, 5-day weeks, 2 moons, 360-day year.',
		name: 'Fantasy Calendar',
		staticData: {
			first_week_day: 0,
			weekdays: [
				{ name: 'Moonday' },
				{ name: 'Stoneday' },
				{ name: 'Windday' },
				{ name: 'Fireday' },
				{ name: 'Starday' },
			],
			months: [
				{ name: 'Frostmere', length: 30, month_type: 'regular' },
				{ name: 'Snowholt', length: 30, month_type: 'regular' },
				{ name: 'Rainmoot', length: 30, month_type: 'regular' },
				{ name: 'Greenrise', length: 30, month_type: 'regular' },
				{ name: 'Bloomtide', length: 30, month_type: 'regular' },
				{ name: 'Sunpeak', length: 30, month_type: 'regular' },
				{ name: 'Highsun', length: 30, month_type: 'regular' },
				{ name: 'Goldfall', length: 30, month_type: 'regular' },
				{ name: 'Harvestwane', length: 30, month_type: 'regular' },
				{ name: 'Duskmere', length: 30, month_type: 'regular' },
				{ name: 'Darkhold', length: 30, month_type: 'regular' },
				{ name: 'Deepwinter', length: 30, month_type: 'regular' },
			],
			leap_days: [],
			moons: [
				{ name: 'Selûne', cycle: 30, offset: 0, face_color: '#E8E8FF', shadow_color: '#1A1A2E' },
				{ name: 'Thar', cycle: 45, offset: 10, face_color: '#FFD4B8', shadow_color: '#2E1A1A' },
			],
			eras: [
				{ name: 'Before Dawn', format: '{{year}} BD', start_year: -9999, end_year: 0, reverse_numbering: true },
				{ name: 'Age of Light', format: '{{year}} AL', start_year: 1, end_year: null, reverse_numbering: false },
			],
			seasons: [
				{ name: 'Winter', timing: { type: 'dated', month: 0, day: 1 }, kind: 'winter', color: '#87CEEB' },
				{ name: 'Spring', timing: { type: 'dated', month: 3, day: 1 }, kind: 'spring', color: '#90EE90' },
				{ name: 'Summer', timing: { type: 'dated', month: 6, day: 1 }, kind: 'summer', color: '#FFD700' },
				{ name: 'Autumn', timing: { type: 'dated', month: 9, day: 1 }, kind: 'autumn', color: '#FF8C00' },
			],
			display_moons: true,
			year_offset: 0,
			epoch_offset: 0,
			day_length_seconds: 86_400,
		},
	},
]
