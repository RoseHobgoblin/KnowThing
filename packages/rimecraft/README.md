# rimecraft

A calendar engine for **worldbuilding** — not a date library.

Where [date-fns](https://date-fns.org/) or [Luxon](https://moment.github.io/luxon/)
model the one calendar the real world happens to use, Rimecraft models calendars
that were never used: *"I invented these months, this eight-day week, three
moons and a leap-day rule of my own — now what day of the week is it, which
moon is full, and what era are we in?"*

The fantasy-calendar generators out there are toy-grade — fixed month counts,
no lunisolar months, no real weekday reckoning across leap days. Rimecraft does
the actual computus.

Zero runtime dependencies. Pure functions. A calendar is plain data in, a
reckoned date out.

## What's inside

| Module | Purpose |
| --- | --- |
| `types` | The calendar-definition shapes (`StaticCalendarData`, `CalendarDate`, `ResolvedDate`) and their parts — months, weekdays, leap days, moons, eras, seasons. |
| `date-math` | The reckoning core: year layouts (incl. intercalary & lunisolar leap months), Gregorian-style leap-day rules, date ↔ absolute-day conversion, weekday, era, season, moon phase, and full display resolution. |
| `know-date` | Bridges to real time: `now()`, `fromTimestamp()`, `toTimestamp()` — map a Unix timestamp onto the invented calendar (with configurable day length and epoch). |
| `presets` | Ready-made calendars: Gregorian, Julian, and a Simple Fantasy 360-day world. |
| `magic-words` | Resolve `{{CURRENTDATE}}`-style tokens against a resolved date. |
| `validate` | Zero-dependency consistency checks: leap day past a month's end, a season dated to a day that doesn't exist, an era ending before it starts. |

## Example

```ts
import { calendarPresets, resolveDisplay, moonPhase, phaseName } from 'rimecraft'

const gregorian = { name: 'Earth', description: '', primary: true, static_data: calendarPresets[0].staticData }

// Reckon a full date: weekday, era, season, every moon's phase
const today = resolveDisplay(gregorian, { year: 2026, month: 7, day: 23 })
// → { day_of_week_name: 'Thursday', year_display: '2026 CE', season_name: 'Summer', … }

// A 360-day fantasy world with two moons of different periods
const { staticData } = calendarPresets[2]
const thar = staticData.moons[1]
phaseName(moonPhase(thar, staticData, { year: 812, month: 4, day: 15 }))
// → 'Waxing Gibbous'
```

## Defining your own

A calendar is a `StaticCalendarData` object. Give it a week of any length, months
of any length (`regular`, `intercalary` for months that appear every N years, or
`lunisolar_leap` for Chinese/Hindu-style inserted months driven by a moon's
cycle), leap-day rules (interval + `ignore`/`exclusive` divisors, so Gregorian's
`4 / not 100 / but 400` falls out), eras with forward or reverse numbering, and
seasons placed on a fixed date or cycled by duration. Run it through
`validateCalendar()` to catch contradictions before you reckon.

## License

MIT
