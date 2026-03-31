# Wishlist: Three Major Features

## 1. Real-World Default Presets (Calendars & Celestials)

### Goal
When creating a new calendar or celestial system, offer a preset dropdown that auto-populates the form with real-world data (Gregorian calendar, Solar system). Gives users a working reference point to modify rather than building from scratch.

### Calendar Presets

**Gregorian Calendar:**
- 12 months (Jan 31, Feb 28, Mar 31, Apr 30, May 31, Jun 30, Jul 31, Aug 31, Sep 30, Oct 31, Nov 30, Dec 31)
- 7 weekdays (Monday–Sunday)
- Leap day: Feb 29 every 4 years, skip centuries, keep 400s (`interval: 4, ignore: [100], exclusive: [400]`)
- Moon: Luna, 29.5306-day cycle
- Eras: BCE (reverse-numbered) and CE
- Seasons: Winter (Dec 21), Spring (Mar 20), Summer (Jun 21), Autumn (Sep 22)
- `day_length_seconds: 86400`, `epoch_offset: 0`

**Other potential presets:**
- Julian Calendar (no century skip rule)
- Islamic Calendar (12 lunar months, 354-day year, no leap month)
- Simple Fantasy (12 × 30-day months, 5-day week, 2 moons)

### Celestial Presets

**Solar System:**
- Star: The Sun (G2V, 1.0 solar mass, 5778 K, yellow-white)
- 8 planets with real orbital data (semi-major axis in AU, eccentricity, orbital period in days, rotation period in seconds, axial tilt)
- Key moons: Luna (Earth), Phobos/Deimos (Mars), Io/Europa/Ganymede/Callisto (Jupiter), Titan/Enceladus (Saturn), Triton (Neptune)
- Ring systems on Saturn, Uranus, Neptune

### Implementation

**Where it goes:** The calendar creation flow (`CalendarHub.svelte` "New Calendar" form) and celestial creation flow (`/celestial` page quick-add forms).

**How it works:**
1. Add a `Select` dropdown above the name input: "Start from preset" with options like "Blank", "Gregorian", "Julian", "Simple Fantasy"
2. Selecting a preset populates the form fields (or for calendars, directly sets `staticData` in the POST body)
3. User can modify any field before saving — preset is just initial state
4. Preset data lives in a `src/lib/calendar/presets.ts` and `src/lib/celestial/presets.ts` as plain objects

**Files to touch:**
- New: `src/lib/calendar/presets.ts`, `src/lib/celestial/presets.ts`
- Modified: `src/lib/components/calendar/CalendarHub.svelte` (add preset selector to create form)
- Modified: `src/routes/celestial/+page.svelte` (add preset selector to system/star/planet create forms)

---

## 2. Infobox System Rework

### Current Problems

The infobox system requires touching **6+ files** to add a new type:

1. `src/lib/infoboxes/types.ts` — add to `InfoboxType` union
2. `src/lib/infoboxes/detect.ts` — add keywords + field heuristics
3. `src/lib/infoboxes/registry.ts` — add lazy import
4. `src/lib/infoboxes/InfoboxNewType.svelte` — create component (~80 lines of `getField()` calls)
5. `src/lib/renderer/nodes/WikiTemplate.svelte` — add static import + map entry
6. `src/lib/server/structured-data.ts` — add resolver (if DB-backed)

Other issues:
- **Detection is fragile.** Stage 1 (keyword map) is fine, but Stage 2 (field heuristics) can misfire — an article with `official_languages` gets detected as "country" even if it's not.
- **Field aliases are scattered.** Each component has its own hardcoded `getField(fields, 'capital')` calls. No centralized schema of what fields a type accepts.
- **Numbered fields have magic limits.** `getNumberedFields(fields, 'leader_title', 14)` silently drops `leader_title15`. Limits vary per component (7, 13, 14, 16) with no documentation.
- **WikiTemplate.svelte statically imports all 12 components** despite a "lazy" registry existing — the registry is dead code.
- **Generic fallback renders raw `snake_case` field names** with no formatting.
- **`from=slug` pattern is implicit.** No validation if slug doesn't exist. Silent failure.

### Proposed Architecture

Replace per-type Svelte components with **data-driven infobox definitions**:

```ts
// src/lib/infoboxes/definitions/country.ts
export const countryInfobox: InfoboxDefinition = {
  type: 'country',
  keywords: ['country', 'nation', 'state', 'sovereign state'],
  sections: [
    {
      title: 'General',
      fields: [
        { key: 'capital', label: 'Capital', aliases: ['capital_city'] },
        { key: 'official_languages', label: 'Official languages', aliases: ['languages'] },
        { key: 'government_type', label: 'Government', aliases: ['government'] },
      ],
    },
    {
      title: 'Geography',
      fields: [
        { key: 'area_km2', label: 'Area', aliases: ['area_total_km2'], suffix: ' km²' },
        { key: 'population', label: 'Population', aliases: ['population_estimate', 'population_census'] },
      ],
    },
    {
      title: 'Leadership',
      fields: [
        { key: 'leader_title', label: 'Title', numbered: true },
        { key: 'leader_name', label: 'Name', numbered: true },
      ],
    },
  ],
}
```

**One generic renderer** (`InfoboxRenderer.svelte`) reads the definition and renders sections/fields. No per-type Svelte component needed.

### Benefits
- **Adding a new type = one file.** Write a definition, drop it in `definitions/`, done.
- **Centralized field schemas.** Labels, aliases, formatting, and numbered field support all declared in one place.
- **Kill detect.ts heuristics.** Only use keyword matching (Stage 1). If the template name says `Infobox country`, it's a country. No guessing from fields.
- **Kill registry.ts and the static imports in WikiTemplate.** One renderer handles everything.
- **Formatted labels.** Definition provides `label`, no more raw `snake_case` rendering.
- **Numbered fields are unbounded.** Scan the FieldMap for matching prefixes instead of hardcoding limits.

### Files to touch
- New: `src/lib/infoboxes/definitions/` (one file per type, ~12 files)
- New: `src/lib/infoboxes/InfoboxRenderer.svelte` (replaces all 12 type-specific components)
- New: `src/lib/infoboxes/definitions.ts` (index that collects all definitions)
- Modified: `src/lib/renderer/nodes/WikiTemplate.svelte` (replace 12 imports with one)
- Modified: `src/lib/infoboxes/types.ts` (add `InfoboxDefinition` type, simplify `InfoboxType`)
- Delete: `src/lib/infoboxes/detect.ts` (replaced by keyword lookup on definitions)
- Delete: `src/lib/infoboxes/registry.ts` (dead code)
- Delete: 12× `src/lib/infoboxes/Infobox*.svelte` (replaced by InfoboxRenderer)
- Keep: `InfoboxShell.svelte`, `InfoboxRow.svelte`, `InfoboxSection.svelte` (used by renderer)
- Keep: `src/lib/server/structured-data.ts` (still resolves DB fields, untouched)

---

## 3. Celestial Editing (Currently Broken)

### What's Broken

There is **no form to edit celestial body properties** after creation. The infrastructure exists:
- API endpoints (PUT `/api/stars/:slug`, PUT `/api/planetary-bodies/:slug`) work and validate with Zod
- Database schema has all columns (mass, radius, orbital params, composition, atmosphere, etc.)
- Infobox components display the data correctly

But the UI only has:
- Quick-add forms on `/celestial` (create only, minimal fields)
- An "edit" mode on `/celestial/[slug]` that **only edits wiki prose**, not properties
- "Edit" links on the main page that misleadingly link to the view page

Compare to calendars: `CalendarConfigure.svelte` has a full form for every property, with live preview, and a proper edit flow (`/calendar/[slug]/configure`).

### What Needs to Happen

Build `CelestialConfigure.svelte` following the same pattern as `CalendarConfigure.svelte`:

**For Stars:**
- Identity: name, slug, spectral type, description
- Physical: mass, radius, luminosity, temperature, age, color
- Orbital (for binaries): period, semi-major axis, eccentricity, epoch phase
- Observation: apparent magnitude, angular diameter

**For Planets/Moons:**
- Identity: name, slug, body type (planet/moon/dwarf planet), description
- Physical: mass, radius, density, surface gravity, escape velocity, temperature, age
- Composition: composition, atmosphere, surface pressure
- Orbital: period (text + days numeric), semi-major axis (text + AU numeric), eccentricity, inclination
- Rotation: period (text + seconds numeric), axial tilt
- Observation: apparent magnitude, albedo, satellites count, has rings

**UI flow:**
1. `/celestial/[slug]` detail page gets a "Configure" button (like calendar detail has)
2. Clicking it navigates to `/celestial/[slug]/configure`
3. Configure page shows the full property form + wiki content editor
4. Form POSTs to existing PUT API endpoints
5. Live preview of the infobox as you edit (stretch goal)

### Files to touch
- New: `src/lib/components/celestial/CelestialConfigure.svelte`
- Modified: `src/routes/celestial/[...path]/+page.svelte` (add "Configure" link, add configure route handling)
- Modified: `src/routes/celestial/[...path]/+page.server.ts` (add form action for configure POST)
- Modified: `src/routes/celestial/+page.svelte` (fix misleading "Edit" links)
- Consider: Split into `StarForm.svelte` and `BodyForm.svelte` sub-components since stars and planets have different field sets
