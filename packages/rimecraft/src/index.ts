/**
 * Rimecraft — a calendar engine for worldbuilding.
 *
 * Where a date library models the one calendar the world happens to use,
 * Rimecraft models calendars that were never used: arbitrary months (including
 * intercalary and lunisolar leap months), weeks of any length, multiple moons,
 * Gregorian-style leap-day rules, eras with forward/reverse numbering, and
 * dated or periodic seasons. Define the rules, then reckon: convert between
 * dates and an absolute day count, find the weekday, resolve the era and
 * season, and read every moon's phase.
 *
 * Public surface:
 *   types       — the calendar-definition and resolved-date shapes
 *   date-math   — the reckoning core: layouts, leap logic, absolute-day
 *                 conversion, weekdays, eras, seasons, moon phases, display
 *   know-date   — Unix-timestamp bridges (now / fromTimestamp / toTimestamp)
 *   presets     — ready-made calendars (Gregorian, Julian, Simple Fantasy)
 *   magic-words — {{CURRENTDATE}}-style token resolution over a resolved date
 *   validate    — zero-dependency consistency checks over a calendar definition
 */

export * from './types.js'
export * from './date-math.js'
export * from './know-date.js'
export * from './presets.js'
export * from './magic-words.js'
export * from './validate.js'
