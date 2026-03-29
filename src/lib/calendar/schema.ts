import { z } from 'zod'

/** Zod schema for StaticCalendarData — validates calendar API inputs */
export const staticDataSchema = z.object({
	first_week_day: z.number().int().min(0),
	weekdays: z.array(z.object({
		name: z.string().min(1),
		abbreviation: z.string().optional(),
	})),
	months: z.array(z.object({
		name: z.string().min(1),
		length: z.number().int().min(1),
		month_type: z.enum(['regular', 'intercalary']),
		interval: z.number().int().optional(),
		offset: z.number().int().optional(),
		short_name: z.string().optional(),
	})),
	leap_days: z.array(z.object({
		name: z.string(),
		month_index: z.number().int().min(0),
		after_day: z.number().int().min(0),
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
		name: z.string().min(1),
		start_year: z.number().int(),
		end_year: z.number().int().nullable().optional(),
		format: z.string().optional(),
		reverse_numbering: z.boolean(),
	})),
	seasons: z.array(z.object({
		name: z.string().min(1),
		kind: z.string(),
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
}).passthrough()
