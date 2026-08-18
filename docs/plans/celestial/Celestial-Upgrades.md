# Celestial Upgrades

## Immediate

### Canonical-field cleanup
- Pick one stored source of truth for each quantity
- Make derived/display fields read-only everywhere
- Apply the same rules in both create and edit flows

### System map — remaining work
- Toggle visibility: companion stars, planets, moons, asteroids, rings
- Highlight overlays: habitable zone, resonant bodies, eccentric orbits
- Hide tiny bodies: slider or threshold
- Classification lens: all / dwarf-tagged / inhabited / artificial / custom tags
- "Show parent/children only" filter (beyond current family highlighting)
- Pin comparison: compare 2-3 bodies side by side

### Time controls
- Date source: now / calendar / manual day count
- Step size: hour, day, month, year
- Play/Pause with speed control
- Reset to epoch
- Moon phases and relative positions for a selected world

### Registry browsing
- Sortable/filterable tables by type, star, parent body, AU, period, rings, moon count
- Quick jump from registry row to map focus and article
- Saved views like "all moons of Sunly" or "all inhabited worlds"

### Hierarchy UX
- Every body page should show: parent chain, sibling bodies, child moons/rings, key system context
- Make hierarchy navigation one-click and obvious

### Connect celestial to the rest of the app
- Show calendars linked to this world
- Show articles, civilizations, regions, or lore tied to the body
- Let celestial pages feel central to the setting, not isolated records

### Search
- Search by name, type, parent star, parent body, and article content
- Results show path context like Sunly > Earth > Moon

### Procedural body rendering
- Zoom-aware detail levels: flat dot < 8px, gradient sphere 8–30px, full detail 30px+
- Gas giants: horizontal banding with wave distortion, color-driven palette
- Rocky worlds: procedural landmass patches from composition/color data
- Ice worlds: pale base with fracture lines, blue-white limb
- Atmosphere haze ring at limb for bodies with atmosphere data
- Ring systems: tilted ellipses for hasRings bodies
- Star corona expansion at high zoom
- All driven by existing schema fields: color, bodyType, atmosphere, composition, hasRings, temperature

### Import/backfill/admin tools
- Bulk-fix old records
- Recompute derived fields for all celestial records
- Rebuild links/content records/search state safely

## Composability — making the systems talk to each other

### Embeddable system map
- `{{System map|slug}}` template renders an inline map in any wiki article
- Sized to context, shows whatever time the page's calendar says it is
- An article about a historical battle shows where the planets were on that date
- A religion article embeds the map frozen at an alignment event

### Calendar-driven orbital state
- A page can declare a calendar epoch; every celestial reference on that page resolves from it
- Moon phases, planet positions, seasonal context all computed from the page's calendar date
- Calendar system and celestial system already share a DB — wire them together on article pages

### Cross-body computed infobox fields
- "Habitable zone: Yes (0.95 AU, inner edge 0.91 AU)" from parent star luminosity
- "Visible from [body]: evening sky, magnitude -4.6" from relative orbital positions at current date
- All derivable from two bodies' orbital elements plus the star's properties

### Comparative tables from queries
- `{{Compare|earth,mars,venus|mass,radius,density,orbital_period}}` template
- Pulls structured data for multiple bodies, renders a comparison table
- No manual data entry — same fields the infobox uses
- Subsumes the "saved views" registry concept as an inline wiki feature

### Auto-generated hierarchy sections
- Star pages auto-generate a "Planetary system" section listing children with key stats
- Planet pages auto-generate a "Moons" table
- Hierarchy data already in DB — render it as article content, not just sidebar

### Extra JSONB as first-class infobox escape hatch
- Surface the `extra` field in the configure UI as a key-value editor
- Extra fields flow into the infobox via `getRemainingFields` (already works)
- Covers edge cases without schema changes: classification tags, tidally locked, Lagrange points, custom flags

## Data model gaps

### Circumbinary orbits
- `starId` is a single integer — no way to express a planet orbiting a binary pair
- Needs either a `starIds` array or a virtual "barycenter" entity

### Body subtypes
- `bodyType` only allows planet, asteroid, ring_system
- Missing: gas giant, terrestrial, ice giant, dwarf planet, station, habitat, artificial
- Could be a separate `classification` field or expand the enum

### Asteroid belts / zones
- No belt or zone entity type — each body is discrete
- Need a "belt" concept: inner AU, outer AU, parent star, density hint
- Map could render as a faint band rather than individual dots

### Missing orbital elements
- Longitude of ascending node, argument of periapsis — real orbital mechanics fields
- Some users will want these; schema addition

### Shape detail
- Single `radius` field — no equatorial vs polar radius, no flattening/oblateness
- Could use `extra` JSONB or add dedicated columns
