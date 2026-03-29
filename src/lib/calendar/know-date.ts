import type { CalendarConfig, CalendarDate, ResolvedDate } from './types.js'
import { absoluteDay, dateFromAbsolute, resolveDisplay } from './date-math.js'

const DEFAULT_DAY_SECONDS = 86_400

/** Convert Unix timestamp (ms) to absolute day number in this calendar */
export function unixToAbsoluteDay(timestamp: number, epochOffset: number, dayLengthSeconds = DEFAULT_DAY_SECONDS): number {
	return Math.floor(timestamp / (dayLengthSeconds * 1000)) + epochOffset
}

/** Convert absolute day number back to Unix timestamp (ms, midnight UTC) */
export function absoluteDayToUnix(absDay: number, epochOffset: number, dayLengthSeconds = DEFAULT_DAY_SECONDS): number {
	return (absDay - epochOffset) * (dayLengthSeconds * 1000)
}

/** Get current in-world date from Date.now() */
export function now(config: CalendarConfig): CalendarDate {
	const epochOffset = config.static_data.epoch_offset ?? 0
	const dayLengthSeconds = config.static_data.day_length_seconds ?? DEFAULT_DAY_SECONDS
	const absDay = unixToAbsoluteDay(Date.now(), epochOffset, dayLengthSeconds)
	return dateFromAbsolute(config.static_data, absDay)
}

/** Unix timestamp (ms) → fully resolved calendar date */
export function fromTimestamp(timestamp: number, config: CalendarConfig): ResolvedDate {
	const epochOffset = config.static_data.epoch_offset ?? 0
	const dayLengthSeconds = config.static_data.day_length_seconds ?? DEFAULT_DAY_SECONDS
	const absDay = unixToAbsoluteDay(timestamp, epochOffset, dayLengthSeconds)
	const date = dateFromAbsolute(config.static_data, absDay)
	return resolveDisplay(config, date)
}

/** CalendarDate → Unix timestamp (ms) */
export function toTimestamp(date: CalendarDate, config: CalendarConfig): number {
	const epochOffset = config.static_data.epoch_offset ?? 0
	const dayLengthSeconds = config.static_data.day_length_seconds ?? DEFAULT_DAY_SECONDS
	const absDay = absoluteDay(config.static_data, date)
	return absoluteDayToUnix(absDay, epochOffset, dayLengthSeconds)
}

/** Get current fully resolved date (for magic words, display) */
export function currentResolved(config: CalendarConfig): ResolvedDate {
	return fromTimestamp(Date.now(), config)
}
