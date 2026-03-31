import { z } from 'zod'

/** Zod schema for StaticCalendarData — validates calendar API inputs */
const monthTypeSchema = z.enum(['regular', 'intercalary', 'lunisolar_leap'])
const seasonKindSchema = z.enum(['winter', 'spring', 'summer', 'autumn', 'custom'])

const monthSchema = z.object({
	name: z.string().trim().min(1, 'Month name is required'),
	length: z.number().int().min(1, 'Month length must be at least one day'),
	month_type: monthTypeSchema,
	interval: z.number().int().optional(),
	offset: z.number().int().optional(),
	short_name: z.string().trim().optional(),
	lunisolar: z.object({
		solar_divisions: z.number().int().positive(),
		moon_index: z.number().int().min(0),
	}).optional(),
}).superRefine((month, ctx) => {
	if (month.month_type === 'intercalary' && month.interval !== undefined && month.interval < 1) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['interval'], message: 'Intercalary months need a positive interval' })
	}
	if (month.month_type === 'lunisolar_leap' && !month.lunisolar) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lunisolar'], message: 'Lunisolar leap months need lunisolar rules' })
	}
})

export const staticDataSchema = z.object({
	first_week_day: z.number().int().min(0),
	weekdays: z.array(z.object({
		name: z.string().trim().min(1, 'Weekday name is required'),
		abbreviation: z.string().optional(),
	})),
	months: z.array(monthSchema),
	leap_days: z.array(z.object({
		name: z.string().trim().min(1, 'Leap day name is required'),
		month_index: z.number().int().min(0),
		after_day: z.number().int().min(1, 'Leap days must be inserted after day 1 or later'),
		interval: z.number().int().min(1),
		ignore: z.array(z.number().int()),
		exclusive: z.array(z.number().int()),
		intercalary: z.boolean(),
		offset: z.number().int(),
	})),
	moons: z.array(z.object({
		name: z.string().min(1),
		cycle: z.number().positive(),
		offset: z.number(),
		face_color: z.string(),
		shadow_color: z.string(),
	})),
	eras: z.array(z.object({
		name: z.string().trim().min(1, 'Era name is required'),
		start_year: z.number().int(),
		end_year: z.number().int().nullable().optional(),
		format: z.string().optional(),
		reverse_numbering: z.boolean(),
	})),
	seasons: z.array(z.object({
		name: z.string().trim().min(1, 'Season name is required'),
		kind: seasonKindSchema,
		color: z.string().optional(),
		timing: z.discriminatedUnion('type', [
			z.object({ type: z.literal('dated'), month: z.number().int(), day: z.number().int() }),
			z.object({ type: z.literal('periodic'), duration: z.number().int().positive() }),
		]),
		weather: z.object({
			temp_low: z.number().optional(),
			temp_high: z.number().optional(),
			precipitation: z.number().optional(),
			cloudiness: z.number().optional(),
			wind_intensity: z.number().optional(),
		}).optional(),
	})),
	display_moons: z.boolean(),
	year_offset: z.number().int(),
	epoch_offset: z.number().int(),
	day_length_seconds: z.number().positive().optional(),
}).passthrough().superRefine((data, ctx) => {
	if (data.weekdays.length === 0) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weekdays'], message: 'Add at least one weekday' })
	}

	if (data.months.length === 0) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['months'], message: 'Add at least one month' })
	}

	if (data.weekdays.length > 0 && data.first_week_day >= data.weekdays.length) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['first_week_day'],
			message: 'First weekday must point to an existing weekday',
		})
	}

	for (const [index, month] of data.months.entries()) {
		if (month.month_type === 'lunisolar_leap' && month.lunisolar && month.lunisolar.moon_index >= data.moons.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['months', index, 'lunisolar', 'moon_index'],
				message: 'Referenced moon does not exist',
			})
		}
	}

	for (const [index, leapDay] of data.leap_days.entries()) {
		const targetMonth = data.months[leapDay.month_index]
		if (!targetMonth) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['leap_days', index, 'month_index'],
				message: 'Leap day month must refer to an existing month',
			})
			continue
		}

		if (leapDay.after_day > targetMonth.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['leap_days', index, 'after_day'],
				message: 'Leap day must be inserted within the target month',
			})
		}
	}

	for (const [index, era] of data.eras.entries()) {
		if (era.end_year != null && era.end_year < era.start_year) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['eras', index, 'end_year'],
				message: 'Era end year cannot be before its start year',
			})
		}
	}

	for (const [index, season] of data.seasons.entries()) {
		if (season.timing.type === 'dated') {
			const month = data.months[season.timing.month]
			if (!month) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['seasons', index, 'timing', 'month'],
					message: 'Season month must refer to an existing month',
				})
				continue
			}

			if (season.timing.day < 1 || season.timing.day > month.length) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['seasons', index, 'timing', 'day'],
					message: 'Season day must fall within the selected month',
				})
			}
		}

		if (season.weather?.temp_low != null && season.weather?.temp_high != null && season.weather.temp_low > season.weather.temp_high) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['seasons', index, 'weather', 'temp_low'],
				message: 'Season low temperature cannot exceed the high temperature',
			})
		}
	}
})

export function parseStaticCalendarDataJson(rawJson: string) {
	try {
		return staticDataSchema.safeParse(JSON.parse(rawJson))
	} catch {
		return {
			success: false as const,
			error: new z.ZodError([
				{ code: z.ZodIssueCode.custom, message: 'Calendar configuration must be valid JSON', path: [] },
			]),
		}
	}
}
