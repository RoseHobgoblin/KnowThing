# Celestial ↔ Calendar Integration

Status: **design draft, pre-implementation**. Captures a design discussion for how calendars bind to celestial bodies in KnowThing. Intended to be pressure-tested before any code changes.

## Purpose

KnowThing currently has two largely disconnected subsystems:

- **Celestial**: `star_systems`, `stars`, `planetary_bodies` tables. Full orbital mechanics, derived physics, validation. The principle established in commit 79ee5c9 is that these tables are the single source of truth for physical quantities.
- **Calendar**: `calendars` table with a JSONB `static_data` config. Lunisolar math, eras, seasons, moon phases. A nullable `planet_id` FK exists but is essentially unused — the calendar editor has no UI to set it, and the runtime injection that feeds planet data into lunisolar calculations runs only on celestial route loads, not calendar route loads.

The result today: moon cycles and day length must be hand-entered into every calendar, even for calendars whose planet already has that data modelled. This violates the SSOT principle and blocks entire use cases (multi-culture calendars on one world, planet-rotation-driven day length, drift-aware historical calendars).

This document proposes an integration that:

1. Lets planet-bound calendars inherit rotation, moons, and orbit comparison automatically.
2. Does not prevent calendars from being unbound (galactic / imperial / abstract).
3. Handles the temporal reality that calendars fossilize across astronomical change, and represents this explicitly rather than as silent drift or data loss.

## Use cases

The design must serve all of these. Pressure-testing should confirm each remains representable.

1. **Single planet, single calendar.** Therne has one standard calendar. Day length and moons inherit from Therne.
2. **Single planet, multiple cultures.** Therne has a Common, Elvish, and Dwarven calendar. Same moons, same day length, different months/weeks/eras. All three bind to Therne.
3. **Galactic / Imperial calendar.** Not bound to any world. Uses a standard-day convention (e.g. 86 400 s). Typically no moons, or symbolic ones.
4. **Treaty / accord calendar.** Used everywhere but historically descends from one world's astronomy (Old Terra standard year). Mechanically abstract but may ceremonially reference that world's moon.
5. **Moon colony calendar.** The "planet" the calendar is bound to is itself a moon (e.g. Titan). Its day length equals its rotation period; its primary may appear as a "moon" in its sky.
6. **Mythological / symbolic moon.** A moon that is not astronomically real but is tracked by a religious or cultural calendar. Never existed in the sky; exists in the lore.
7. **Calendar authored before its planet.** Author writes a calendar early, creates the celestial data later. The calendar must be bindable after the fact.
8. **Partial override of derived values.** "I want Therne's moons but my religious year is exactly 400 days regardless of orbit."
9. **Upstream edits cascade.** Author tweaks Therne's rotation period; all bound calendars update immediately (except where explicitly fossilized — see below).
10. **Planet or moon deletion while referenced.** A referenced body is removed. Calendars must either survive or be explicitly reformed; no silent loss.
11. **Shattered moon.** A moon existed, was destroyed in-narrative. Calendar survives as a fossil of a lost sky. System maps sunset the moon at the destruction date.
12. **Drifted / captured moon.** The moon still exists but its orbital period changed. Calendar was correct when codified; it's drifting now and everyone knows.
13. **Reform pending.** Calendar is known to be wrong, authors haven't fixed it yet (Julian-before-Gregorian analogue).
14. **Reform complete.** Calendar had a formal reform event; pre- and post-reform dates must both be interpretable.
15. **Retconned body.** Author decides "actually there were only two moons." Prior narrative referenced three. The third must persist in historical calendars without polluting current celestial data.
16. **Mythological-that-used-to-be-real.** A destroyed moon becomes an object of worship; later calendars treat it as mythological while historical calendars treat it as (formerly) real.

## Design principles

Two principles anchor the design, and they are complementary rather than in tension once temporal semantics are named clearly.

**Principle 1 — Single source of truth for current physical reality.** At any given in-world moment, each physical quantity (a moon's current orbital period, a planet's current rotation period) has exactly one authoritative value, stored on the celestial row. Calendars do not store parallel copies of these values except as explicit historical fossils (see principle 2).

**Principle 2 — Temporal separation of physical and canonical.** A calendar's "canonical" values — what its in-world authorities codified and enforce by tradition or law — are a legitimately separate fact from current physical reality. They are allowed to diverge. When they do, the divergence is explicit, visible, and represents a narrative event rather than a data inconsistency.

These principles together justify the central structural decision: moon data lives as celestial rows (SSOT for current reality), and calendars reference those rows with optional fossilized overrides (temporal layer for what the calendar enforces).

## Options considered

Four options were weighed in depth. Summary of the trade-offs for context; full analysis preserved in the discussion that produced this doc.

- **Option A — Hybrid per-entry.** Each calendar moon entry is independently either a reference to a celestial row or a manual literal. Small migration, flexible, but creates two code paths everywhere and leaves manual entries as a parallel source of truth for physical quantities. SSOT-inconsistent.

- **Option B — Mode flag.** Calendar is either fully bound (everything derived) or fully abstract (everything manual). Cleanest invariants but refuses to serve use cases 4, 6, 8.

- **Option C — Celestial-first.** Moons are always rows in `planetary_bodies` (`parentId` set, `bodyType='moon'`). Calendar moon lists become pure junctions: `{ body_id, colors, ... }[]`. Planet binding is a separate concern controlling only day length and year-drift comparison. Moon tracking and planet binding become orthogonal, so use case 4 (imperial calendar ceremonially tracking Old Terra's moon) falls out for free. Highest conceptual cleanliness and best narrative affordances; largest migration cost.

- **Option D — Snapshot on link.** Values copy from planet into staticData at link time. Rejected: directly contradicts principle 1 and creates silent drift.

**Chosen: Option C**, extended with cosmetic overrides and a temporal layer (canonical values + existence status) to handle use cases 11–16. The rest of this document specifies that extended design.

## The design

### 1. Cardinality

- `calendars.planet_id` remains a nullable FK to `planetary_bodies`. One calendar has zero or one planet binding.
- Many calendars may bind to the same planet (use case 2). No junction table.
- A calendar bound to a moon is fine — `planetary_bodies` is recursive, and "moon colony" (use case 5) is just a planet binding whose target happens to be a moon.
- Unbound calendars (use case 3) have `planet_id = NULL` and supply their own day length.

### 2. Moons are celestial rows

Moons cease to be configuration entries. A moon is a row in `planetary_bodies` with `parentId` set to its primary and `bodyType = 'moon'`. This is already supported by the schema; the missing pieces are editor UI (see §7) and the dropping of the degenerate `satellites` integer count.

Consequences:
- Moons can have their own wiki pages via `contentRecordId` (already on the table).
- A moon's orbital period, epoch phase, inclination, etc., live on exactly one row and update in exactly one place.
- Multiple calendars on the same planet all reference the same moon rows (use case 2).
- A calendar can reference a moon of a *different* planet (use case 4, imperial calendar tracking Old Terra's moon) — tracking and binding are orthogonal.

### 3. Calendar moon entries

The `staticData.moons[]` entry shape becomes:

```ts
{
  body_id?: number                    // reference to planetary_bodies.id
  canonical_cycle_days?: number       // fossilized value, authoritative when set
  canonical_recorded_at?: number      // absolute day of fossilization (provenance)
  face_color?: string                 // per-calendar cosmetic override
  shadow_color?: string
  name_override?: string              // per-calendar narrative name
}
```

- `body_id` is the link. Normally set.
- `canonical_cycle_days` is the fossilization override. When present, the calendar renders using this value regardless of the live celestial cycle. When absent, the calendar renders live from the celestial row.
- `canonical_recorded_at` is narrative provenance: "this value was codified in year X." Used for drift display and history. See §9 for the narrative-vs-mechanical discussion.
- Cosmetic overrides (`face_color`, `shadow_color`, `name_override`) are per-calendar display choices. **No physical-quantity overrides other than `canonical_cycle_days`**, and that one has specific temporal meaning — not "I disagree about the cycle," but "I codified this cycle at a known moment and am bound to it."
- Legacy entries (pre-migration) without `body_id` are tolerated during migration but not creatable post-migration. See §11.

### 4. Rendering decision tree

For each calendar moon entry, the cycle used by the renderer is:

```
if canonical_cycle_days is set:
    cycle = canonical_cycle_days        // fossilized
elif body_id is set and body is queryable:
    cycle = body.orbital_period_days    // live reference
else:
    cycle = <orphaned — editor should have prevented this>
```

Same logic applies to epoch phase / offset: canonical field wins if set, else live.

### 5. Day length inheritance

`staticData.day_length_seconds` becomes optional. Resolution:

```
if planet_id is set and day_length_seconds is null:
    day_length = planet.rotation_period_s      // inherit
elif day_length_seconds is set:
    day_length = day_length_seconds            // explicit (override or unbound)
else:
    day_length = 86400                          // fallback default
```

- Bound calendar with null field → inherits live. Good default for use case 1.
- Bound calendar with explicit field → explicit override. Rare, but preserves an escape hatch and supports the fossilization pattern.
- Unbound calendar → must set explicitly (use case 3).

### 6. Year length is not auto-derived

Year length = sum of month lengths. Months are an authoring decision, not a measurement. The design deliberately does not auto-sync year length to `orbital_period_days`.

Instead, the calendar editor shows a **drift readout** when the calendar is planet-bound:

> Your year is 365 days. Therne's orbital period is 384.2 days. Drift: +19.2 days/year. Seasons shift by ~1 month every 1.5 years.

This is strictly more useful than either auto-sync or silence. It is also a narrative feature: the numbers are concrete hooks for storytelling ("the Long Night festival has moved a full season since the Empire's founding").

### 7. Existence status on celestial bodies

To represent destroyed, hypothetical, and retconned bodies (use cases 6, 11, 15, 16), add to `planetary_bodies`:

```ts
existence_status: 'extant' | 'destroyed' | 'hypothetical' | 'retconned'
existence_ended_day?: bigint      // absolute day, optional, only for destroyed
existence_note?: text              // e.g. "Shattered in the War of Falling Stars"
```

Semantics:

- **extant** — default. Renders on system maps, full orbital math, visible everywhere.
- **destroyed** — existed once, no longer does. `SystemMap` renders it while `current_absolute_day < existence_ended_day`, and hides it after. Calendars keep referencing it. Tides/eclipses cease after the end date. Wiki pages remain accessible with a "destroyed in year X" marker.
- **hypothetical** — never astronomically real. Invisible to `SystemMap`. Invisible in planet infoboxes of real worlds. Referenceable by calendars (Red Cult's phantom moon, use case 6). Absorbs what otherwise would have been a separate `visibility: 'mythological'` field.
- **retconned** — author sunset. Hidden from system maps, hidden from infoboxes, excluded from most queries, but still queryable by calendars that reference it and by explicit historical lookups. A soft delete with narrative intent.

Why one field instead of two (`is_destroyed` boolean + `is_mythological` boolean):

- They are mutually exclusive in practice — a body is extant, or was and isn't, or never was, or is being unmade by the author. A single enum captures the whole space cleanly.
- Queries like "show me all bodies to render on the system map at day N" become one predicate.
- Use case 16 (mythological-that-was-real) is naturally represented by a body that began `extant`, transitioned to `destroyed`, and is culturally *treated* as mythological by later calendars without the row itself changing status.

### 8. Cascade and deletion rules

Destructive operations on referenced celestial bodies must never silently break calendars. The editor intercepts and offers explicit choices.

**Deleting a moon with calendar references:**
1. Block the plain delete.
2. Offer:
   - **Mark as destroyed** — set `existence_status='destroyed'`, require `existence_ended_day` and optional note. Calendars keep working live until fossilization; system map respects the end date.
   - **Mark as retconned** — set `existence_status='retconned'`. Automatically fossilize every referencing calendar entry (snapshot cycle, null out `body_id`, record `canonical_recorded_at`). Body is hidden elsewhere.
   - **Force delete** — require the user to first fossilize or remove every reference. Friction-heavy, explicit.

**Editing a referenced body's physical quantities (orbital_period_days, epoch_phase):**
- Before committing, show blast radius: "N calendars reference this moon live and will update. M calendars have fossilized values and will show drift."
- Both outcomes are legal. The author sees the consequence before acting.

**Deleting a planet with bound calendars:**
- Block the plain delete.
- Offer:
  - **Unbind calendars** — set `calendars.planet_id = null`, snapshot `day_length_seconds` and each linked moon entry into canonical values. Calendars become abstract but keep working.
  - **Cascade-destroy** — mark planet `destroyed`, cascade to its moons (also destroyed), fossilize every referencing calendar. Use case 11 at the planet level.
  - **Force delete** — requires all dependencies resolved manually.

Deletion semantics are more permissive than they sound because the soft-delete statuses (`destroyed`, `retconned`) are the intended path; hard delete is only for truly erroneous rows.

### 9. `canonical_recorded_at`: narrative or mechanical?

Two possible interpretations of this field:

- **Narrative (recommended).** It is metadata: "the in-world year this calendar was codified." Used for drift readouts, editor display, and historical commentary. The actual rendering decision tree (§4) uses `canonical_cycle_days` directly and does not query celestial history.

- **Mechanical.** It means "render this calendar against the celestial state *as it was* at this day." Requires a temporal/versioned celestial table (bitemporal data). Heavy — turns `planetary_bodies` into a time-series table and forces every query to carry an as-of timestamp.

**Recommendation: narrative.** It covers every use case listed without turning the celestial schema into a temporal database. Mechanical versioning is a much larger conversation that should be had separately, driven by its own use cases (time-travel fiction, historical reconstruction queries), not by calendar integration.

If mechanical versioning is wanted later, the narrative interpretation doesn't block it — the field's meaning can be upgraded, and existing fossilized values remain valid as point-in-time snapshots.

## Schema changes

### `planetary_bodies`

- **Drop** `satellites integer` (was a degenerate count; moons are now rows).
- **Add** `existence_status text` with check constraint `IN ('extant', 'destroyed', 'hypothetical', 'retconned')`, default `'extant'`, not null.
- **Add** `existence_ended_day bigint` nullable.
- **Add** `existence_note text` nullable.

Indexes:
- Existing `idx_planetary_bodies_parent` on `parentId` is load-bearing for moon lookup (`SELECT * FROM planetary_bodies WHERE parent_id = ?`). Already present.
- Consider `idx_planetary_bodies_existence` on `existence_status` if queries filtering to extant-only become hot.

### `calendars`

No column changes. `planet_id` FK and `static_data` JSONB unchanged.

### `calendars.static_data` Zod schema

`src/lib/calendar/schema.ts` changes:

- `day_length_seconds` becomes optional (was: defaulted to 86400).
- `moons[]` entry shape changes as specified in §3:
  - Current field name is `celestial_id`; keep it (no rename churn) but document that it is the primary link field.
  - `celestial_id` remains optional during the migration window; after migration, new entries must set it unless they are fossilized-only.
  - Add `canonical_cycle_days`, `canonical_recorded_at`, `name_override`.
  - Existing `face_color`, `shadow_color` unchanged.
  - Existing `name`, `cycle`, `offset` become legacy fields: tolerated on read during migration, rejected on new writes.

### `star_systems`, `stars`

No changes.

## Resolver changes

The runtime injection that populates `staticData.planet` currently lives in `src/routes/celestial/[...path]/+page.server.ts` (around lines 68–78 per the survey). This is the source of a real bug: calendar routes don't run that injection, so lunisolar math on `/calendar/...` pages silently falls back to manual `moon.cycle` values even when the calendar is planet-bound.

**Fix:** extract into a shared resolver.

- Create `src/lib/server/celestial/resolve-calendar-context.ts` (or co-locate with existing structured-data resolvers).
- Function signature: `resolveCalendarContext(calendar): ResolvedCalendar` — takes a row from `calendars`, returns the calendar with `staticData.planet` populated if `planet_id` is set, with `day_length_seconds` inheritance applied, and with each moon entry's `celestial_id` resolved to its live physical values (unless fossilized).
- Called from: `src/routes/celestial/[...path]/+page.server.ts`, `src/routes/calendar/[...path]/+page.server.ts`, `src/routes/api/calendar/+server.ts`, `src/routes/api/calendar/[id]/+server.ts`, `src/routes/api/calendar/all/+server.ts`, and anywhere else calendars are loaded for rendering.
- The resolver is responsible for the §4 decision tree and the §5 day-length inheritance. The date-math library receives already-resolved data and does not need to know about live vs fossilized.

This change alone fixes the current silent fallback bug even before any of the other work lands.

## Editor UX flows

### Calendar editor: planet picker

- Add a section "Astronomical binding" above the current config fields.
- Dropdown: planet picker listing all `planetary_bodies` where `bodyType IN ('planet', 'moon', 'dwarf', ...)` filtered to `existence_status='extant'` by default with a "show historical" toggle for use cases 14 and 16.
- When set:
  - Show the planet's rotation period and orbital period as read-only inheritance values.
  - Show `day_length_seconds` as a form field that is **empty by default (inherits)** with a placeholder showing the inherited value. Author can type a value to override.
  - Show a moons section (next flow).
  - Show a drift readout comparing `sum(months[].length)` to `planet.orbital_period_days`.
- When cleared:
  - Snapshot current inherited values into explicit fields (day length, moon canonical cycles) with a confirmation: "Unbinding will preserve current values as explicit settings. OK?"
  - After snapshot, the calendar behaves as abstract.

### Calendar editor: moon picker

- Section visible when a planet is bound.
- Lists all `planetary_bodies` children of the bound planet (or, for use case 4, also allows picking from elsewhere via a "link moon from another world" button).
- Each row: checkbox (track this moon), cosmetic fields (name override, face color, shadow color), freeze/unfreeze button.
- Status per entry:
  - **Live** (default): no canonical value; renders from celestial row.
  - **Frozen**: canonical value set; renders from canonical. Shows drift badge if physical differs. Shows `canonical_recorded_at`.
- Actions:
  - **Freeze** — copy current physical cycle into `canonical_cycle_days`, set `canonical_recorded_at` to current in-world day. Editor prompts for a note if desired.
  - **Unfreeze** — clear canonical. Calendar returns to live reference. Warning: "This will cause the moon's cycle to follow astronomical changes. OK?"
  - **Refresh** — re-copy the current physical value into canonical without changing `canonical_recorded_at`. For reform events.

### Calendar creation: "freeze astronomical basis"

- New-calendar flow has a checkbox: **"Freeze astronomical basis at today's values."**
- If checked and a planet is selected: immediately snapshot `day_length_seconds` and every linked moon's canonical cycle. The calendar is historical-fossilized from creation.
- Default: unchecked. New calendars are live-bound.

### Celestial editor: blast-radius warning

- When editing a referenced body's `orbital_period_days`, `rotation_period_s`, or `epoch_phase`: show a panel above the save button listing all calendars that reference it, split into "will update live (N)" and "frozen, will show drift (M)."
- Save is not blocked; the author is informed.

### Celestial editor: existence status changes

- When setting `existence_status` to `destroyed`:
  - Require `existence_ended_day` (absolute day picker backed by a calendar widget, ideally the primary calendar).
  - Optional note.
  - Show affected calendars: "N calendars reference this body. They will continue rendering after destruction. Freeze their values now? [Freeze all / Leave live / Handle per-calendar]"
- When setting to `retconned`:
  - Automatically fossilize every referencing calendar entry.
  - Hide the body from system maps and infoboxes.
  - No end date required.

### Celestial editor: moon creation on planet pages

- On a planet detail / configure page, add a "Moons" section.
- Allows creating, editing, deleting child rows (`parentId = this.id`, `bodyType = 'moon'`).
- Each moon row gets its own orbital period, epoch phase, mass, radius, composition, etc. — the same fields as any other `planetary_bodies` row.
- Optionally also allows creating a wiki page for the moon via `contentRecordId`.
- This is the largest single piece of new editor UI. It is also the unblocker for the entire integration — without it, no one can create moons as rows, so nothing else works.

## Worked examples

**Therne standard, single culture (use case 1).**
Author creates calendar "Therne Standard," sets planet = Therne, leaves freeze-basis unchecked. Day length field is empty (inherits Therne's rotation). Moons section lists Therne's two moons (already present as child rows); author checks both, picks colors, done. Year length is authored manually; drift readout shows current alignment to Therne's orbit. No canonical values set anywhere; everything is live.

**Therne multi-culture (use case 2).**
Same as above, repeated three times with different month layouts, weekdays, eras. All three calendars reference the same two moon rows. If the author later edits one moon's orbital period, all three update identically. Drift readouts differ because each has a different year layout.

**Galactic Imperial (use case 3).**
Author creates calendar "Imperial Standard," leaves planet unset. Day length field is required; author sets 86 400. Moons section is not shown. No drift readout. Calendar works as a pure abstract count.

**Accord calendar with ceremonial reference (use case 4).**
Author creates calendar "Concord of Worlds." Planet unset (it's not bound). In the moons section — which is normally hidden — the author clicks "Link a moon from elsewhere" and picks Old Terra's Luna. The entry is frozen at creation because there is no binding to inherit live day-length from, but the moon reference is alive: Luna's cycle is live. The author freezes Luna's cycle manually to fossilize the ceremonial tradition against future Old Terra edits.

*Open question: should un-bound calendars be allowed to reference moons live, or only frozen? See §Pressure-test hooks item 1.*

**Shattered moon (use case 11).**
The moon "Iskar" orbits Therne. In narrative year 2340, Iskar is destroyed. Author opens Iskar's row, sets `existence_status = destroyed`, `existence_ended_day = <year 2340, month 3, day 17>`. Editor finds that the Therne Standard calendar references Iskar and asks: "Freeze Iskar in this calendar?" Author clicks Freeze. Canonical cycle is written; `canonical_recorded_at` is set to 2340-03-17. From this point on, the Therne Standard calendar still has an Iskar month that renders normally; SystemMap shows Iskar orbiting up until 2340-03-17 and nothing thereafter. The calendar widget shows a small note: "Iskar — historical moon, destroyed in 2340."

**Julian-to-Gregorian analogue (use cases 13, 14).**
Author creates "Therne Imperial" with freeze-basis = true at in-world year 1. All moon cycles and day length snapshot at that point. Physical celestial data is edited over in-world centuries to represent slow orbital drift. The Therne Imperial calendar's drift readout grows ("festivals now fall 4.2 days earlier than at codification"). In year 400, the author creates a new calendar "Therne Imperial (Reformed)" with freeze-basis = true at year 400. Both calendars coexist. Historical document pages can link to dates in either.

**Retcon (use case 15).**
Author decides Therne had only two moons, not three. Opens the third moon's row, sets `existence_status = retconned`. The editor finds two calendars reference it, automatically fossilizes both (snapshots cycle, nulls `celestial_id`, sets `canonical_recorded_at`). The retconned moon disappears from SystemMap and from Therne's planet infobox. The two calendars keep rendering a month for the former third moon, labeled as historical. Wiki articles about the third moon remain accessible (via the retconned row's `contentRecordId`).

**Mythological Red Moon (use case 6).**
Author creates a `planetary_bodies` row with `bodyType='moon'`, `parentId` unset or set to a placeholder, `existence_status='hypothetical'`, invented orbital period. SystemMap never shows it. Infoboxes on real planets never list it. The Red Cult calendar references it like any other moon and renders normally. The Red Moon can have its own wiki page via `contentRecordId`.

**Mythological-that-was-real (use case 16).**
Iskar was destroyed in 2340 (see above). In the narrative year 3000, a cult worships Iskar as mythological. No schema change is needed: the row is still `destroyed`, and the cult's calendar references it in exactly the same way as the historical Therne Standard calendar does. The cult's calendar can choose to freeze Iskar's cycle at its own founding year if it wants divergent ceremonial timing, or inherit from the pre-destruction canonical cycle. Whether an observer calls this "historical" or "mythological" is a narrative choice the row itself does not need to encode.

## Migration plan

Existing calendars in the database have manual moon entries (the legacy shape) and no planet bindings. Migration must not break them.

1. **Schema migration** (non-destructive first pass):
   - Add `existence_status` (default `'extant'`), `existence_ended_day`, `existence_note` to `planetary_bodies`. All existing rows become `'extant'` automatically.
   - Drop `satellites` integer. **Audit first** — if any wikitext or infobox code reads this field, update it to `SELECT COUNT(*) FROM planetary_bodies WHERE parent_id = ?` or similar.

2. **Zod schema update:**
   - Make `day_length_seconds` and moon entry physical fields (`cycle`, `offset`) optional.
   - Add `canonical_cycle_days` / `canonical_recorded_at` / `name_override` fields.
   - Keep legacy fields tolerated on read; reject them on writes from the new editor.

3. **Resolver extraction** (the bug-fix change):
   - Build `resolveCalendarContext` per §Resolver changes.
   - Wire it into all load paths.
   - Behavior for legacy entries: if an entry has `cycle` but no `celestial_id`, treat `cycle` as the canonical value and render from it. This preserves current behavior bit-for-bit until the migration assistant runs.

4. **Migration assistant** (one-time, author-driven, reversible):
   - For each existing calendar, show its current manual moon entries.
   - For each entry, offer three choices:
     - **Create as real moon.** If the calendar is bound to a planet (or the author binds one during migration), create a new `planetary_bodies` row with `parentId = planet.id`, `bodyType='moon'`, `orbitalPeriodDays = cycle`, `epochPhase = offset`, name from entry. Replace the entry with `{ celestial_id: new_row.id, face_color, shadow_color }`.
     - **Keep as historical fossil.** Convert to `{ canonical_cycle_days: cycle, canonical_recorded_at: <current in-world day>, name_override: name, face_color, shadow_color }`. No `celestial_id`. The entry survives untouched behaviorally but is now typed as fossilized. Useful when the author doesn't want to commit to a celestial body yet.
     - **Delete.** Remove the entry.
   - Migration is per-calendar and can be skipped indefinitely; the legacy read path works forever.

5. **Moon editor on planet pages** (the unblocker — see §Editor UX flows).

6. **Rest of the editor UX** (planet picker, moon picker, blast-radius warnings, existence status actions).

7. **Drop legacy write paths** once migration is substantially complete and confidence is high. Legacy read path stays indefinitely or until the next cleanup pass.

## Build order

Ordered for minimum blocked time. Each step delivers something useful even if subsequent steps are deferred.

1. **Schema migration** — `existence_status` trio on `planetary_bodies`, drop `satellites` (after audit). Adds temporal vocabulary; no behavior change yet.
2. **Resolver extraction** — `resolveCalendarContext` covering the §4/§5 decision trees. **Fixes the current silent-fallback bug for planet-bound calendars** (the lunisolar path on `/calendar/...` that currently misses injection). Immediate win, even before any new UX.
3. **Zod schema update** — new fields on moon entries and `day_length_seconds`. Legacy shape tolerated on read.
4. **Moon editor on planet pages** — the unblocker. Without this, no one can create celestial moons and the rest of the integration is inaccessible.
5. **Calendar editor: planet picker + day-length inheritance + drift readout.** Delivers use cases 1, 2, 3 end-to-end for newly-created planet-bound calendars.
6. **Calendar editor: moon picker with freeze/unfreeze.** Delivers use cases 11, 13, 14.
7. **Celestial editor: blast-radius warnings and existence-status flows.** Delivers use cases 11, 15 fully. Also makes destructive edits safe.
8. **Migration assistant** for existing calendars.
9. **System map temporal awareness** — honor `existence_status` and `existence_ended_day` relative to the current in-world day (feeds off DateScrubber, which isn't yet threaded into SystemMap). This is a small wire-up once the data exists.
10. **Back-references** — planet pages show "Calendars used here," calendar pages show "This calendar is for [planet]." Polish.

## Pressure-test hooks

Open questions and edge cases to probe before implementing. This list is the starting point for the next round of discussion.

1. **Day-length unit for unbound calendars that reference moons.** An abstract calendar's "day" is 86 400 s (or whatever the author set). A live-referenced moon's cycle is in *physical* days relative to its parent. If the Imperial calendar's standard day is 100 000 s and it references Old Terra's moon (cycle 29.5 Old-Terra-days), what does the Imperial calendar call the cycle? Options: (a) always render cycles in the calendar's own day unit, converting via each moon's own parent planet's rotation; (b) force unbound calendars to freeze any referenced moons, so the cycle is a static number the author owns; (c) prohibit unbound calendars from referencing moons at all. Option (b) feels right but needs confirmation.

2. **Moons that orbit moons.** `planetary_bodies.parentId` is self-referential and untyped by depth. Can a calendar bind to a moon (use case 5) and then reference a sub-moon of that moon? Probably yes, mechanically. Is the UI prepared to navigate the tree? Probably not, currently.

3. **Planet binding to a star.** Can a calendar be bound to a star directly? Use case: "the Coronal Cult's year is the Sun's rotation period." Currently `planet_id` points to `planetary_bodies`, not `stars`. Do we generalize to `body_id` referencing a unified view, or keep the star case out of scope?

4. **Multiple calendars reforming together.** Use case 14 assumes calendars are independent. If three calendars all reform simultaneously (an empire-wide decree), is there a batch operation, or does the author freeze each one individually? Probably individual for now; batch is a future polish.

5. **Freezing at a *past* in-world date.** Currently the Freeze action uses "current in-world day" as `canonical_recorded_at`. Should it allow back-dating (freezing as-if from year 1200 even though the author is editing in real life today)? Narrative interpretation of the field makes this harmless; mechanical interpretation would require historical physical values, which we don't store.

6. **What counts as "current in-world day"?** The system has no concept of a single canonical current-time. Each calendar has its own epoch and the user scrubs via DateScrubber. Probably the answer is: the freeze action uses *the calendar being edited*'s current-date cursor, since that's the in-world clock for this calendar's authors.

7. **Destroying a planet that has bound calendars.** §8 covers moon destruction in depth. Planet destruction is a bigger blast: does the calendar unbind and fossilize? Does it become abstract and lose its day-length inheritance unless frozen? Should we force freeze-all on planet-destroy? Likely yes: "you can't have a live-bound calendar to a destroyed planet" is a clean invariant.

8. **Existence status transitions.** Is `extant → destroyed → extant` ever legal? (Resurrection, time reversal, error recovery.) `hypothetical → extant`? (A worshipped moon turns out to be real.) `retconned → extant`? (Author changes their mind.) Probably all legal, all reversible; but each reverse transition needs a calendar-side rule.

9. **Editor concurrency.** Two authors editing the same calendar; one adds a moon reference, one freezes an existing entry. Standard optimistic-locking territory; flagged here because fossilization is a state transition that would be especially confusing if lost.

10. **Infobox behavior.** `InfoboxPlanet` today shows a `satellites` count. After the schema migration it should show a list of actual moon rows (names, maybe links). Does the infobox filter by `existence_status`? Probably yes — default to `extant` with a "historical moons" expander.

11. **Seasons.** Currently purely cosmetic. Design does not address whether seasons should derive from axial tilt / orbit phase when bound. Out of scope for this doc; flagged as a future integration.

12. **Eclipses.** Not modelled. Physics exists (`compute.ts` has Hill sphere, Roche limit). A calendar could plausibly show predicted eclipses as special days. Out of scope for this doc; flagged.

13. **Multiple calendars per planet with conflicting drift.** Use case 2: three cultures on Therne, each with different year lengths. Their drift readouts will differ. Is there ever a reason to show a *combined* view ("Therne has three calendars, all drifting differently")? Probably no; each calendar's editor shows its own drift. But the planet page could list bound calendars with their respective drifts as a feature.

14. **What prevents a calendar from binding to a `hypothetical` planet?** A purely mythological world with purely mythological moons and a calendar that tracks them. Probably allowed; no rule currently blocks it. Confirm this is desired.
