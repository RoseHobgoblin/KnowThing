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
