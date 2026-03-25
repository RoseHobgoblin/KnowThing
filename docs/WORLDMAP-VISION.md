# KnowThing: WorldMap

> **Far-future project.** This document captures the full vision for an interactive 3D world map system integrated with KnowThing's structured data layer.

## Core Concept

The user paints an equirectangular projection in any image editor. Black is water. Each region is a unique hex color. KnowThing wraps it onto a 3D globe, makes regions clickable, and dynamically recolors the map based on structured data — political, linguistic, religious, historical — all from the same base image.

**One map, infinite visualizations.**

---

## How It Works

### Input

1. User paints a flat equirectangular map in their image editor of choice
2. Convention: `#000000` = water/ocean, every other hex = a distinct region
3. Upload the PNG to KnowThing
4. In the dashboard, assign each hex color to an entity (wiki page)

### Pipeline

```
Equirectangular PNG (user-painted)
        │
        ▼
Upload + parse pixel data server-side (Sharp)
        │
        ▼
Region registry: hex color → wiki page slug
        │
        ▼
Three.js globe (client-side)
  ├── Base texture: equirectangular mapped onto sphere
  ├── Display texture: dynamically recolored per visualization mode
  ├── Hit detection: raycaster → UV → pixel sample → region lookup
  └── City markers: 3D points at lat/long on sphere surface
```

### Why Equirectangular

- Maps directly onto a sphere — it's literally how every 3D globe texture works
- `u` = longitude, `v` = latitude. Pixel `(x, y)` → `(lon = (x/width) * 360 - 180, lat = 90 - (y/height) * 180)`
- No custom map editor needed — the user's existing image editor IS the editor
- Pixel-perfect region boundaries with zero polygon math
- Hit detection is trivial: ray cast → UV coordinate → sample pixel → read hex → lookup entity

---

## Data Model

### Maps

```
maps
  id              serial PK
  name            text        -- "Main World Map"
  slug            text unique
  image_file      text        -- uploaded equirectangular PNG filename
  description     text
  page_slug       text        -- link to a Know wiki page
  created_at      timestamptz
  updated_at      timestamptz
```

### Regions

```
map_regions
  id              serial PK
  map_id          FK → maps
  hex_color       text        -- "#FF4444"
  page_slug       text        -- "Oncheran_Empire" (links to Know)
  label           text        -- display name for tooltip
```

### Cities

```
map_cities
  id              serial PK
  map_id          FK → maps
  name            text
  page_slug       text        -- links to Know
  latitude        float
  longitude       float
  city_type       text        -- 'capital' | 'city' | 'town' | 'ruin' | 'fortress'
```

### Region Demographics

Structured data that drives map visualizations. Multiple rows per region per category — a region can be 60% one religion and 40% another.

```
region_demographics
  id              serial PK
  region_id       FK → map_regions
  category        text        -- 'religion' | 'language' | 'ethnicity' | 'resource' | 'climate' | 'biome'
  value           text        -- 'Solarian Faith' | 'Oncheran' | 'Iron'
  percentage      float       -- 0.85 (nullable — not all categories need percentages)
  notes           text
```

### Region History

Temporal ownership data. Who controlled this region, and when. Combined with the Calendar system for date math.

```
region_history
  id              serial PK
  region_id       FK → map_regions
  entity_slug     text        -- wiki page of controlling entity
  start_date      text        -- calendar-system date
  end_date        text        -- nullable (null = current controller)
  notes           text
```

---

## Visualization Modes

All from the same base map. The globe re-renders with a new color scheme by swapping the color lookup table.

| Mode | Colors by | Data source |
|---|---|---|
| Political | Country / empire | Region registry (default hex assignments) |
| Language | Primary language spoken | Wordbook language → region demographic |
| Language family | Proto-language group | Wordbook ancestry tree → region |
| Religion | Dominant religion | Region demographics (category = 'religion') |
| Script | Writing system used | CarveCraft script → language → region |
| Ethnicity | Ethnic group | Region demographics |
| Climate / Biome | Terrain type | Region demographics (category = 'biome') |
| Population | Density heat map | Region demographics (category = 'population') |
| Resources | Natural resources | Region demographics (category = 'resource') |
| Historical | Controller at year X | Region history + Calendar time slider |

The **historical timeline** mode is the standout feature: a time slider on the globe. Drag it through the centuries and watch empires expand, collapse, and fragment. The Calendar system provides the date math and era boundaries.

### Dynamic Recoloring

The display texture is generated client-side. For each pixel in the equirectangular:

1. Read the hex color from the base texture
2. Look up which region that hex belongs to
3. Look up the visualization value for that region (e.g., dominant religion)
4. Map that value to a display color (e.g., "Solarian Faith" → gold)
5. Write the display color to the output texture

This runs once when switching modes, producing a new texture that wraps onto the globe. For the historical slider, it re-runs on each scrub position.

---

## Wiki Integration

### Templates

```wikitext
{{map-globe|Main Map}}
```
Embeds the full interactive 3D globe on a wiki page.

```wikitext
{{map-region|Main Map|Oncheran Empire}}
```
Highlighted flat view of a single region, cropped or zoomed.

```wikitext
{{map-cities|Main Map|country=Oncheran}}
```
Auto-generated table of cities within a region, pulled from structured data.

```wikitext
{{map-demographics|Main Map|Oncheran|religion}}
```
Renders a table or chart of demographic breakdown for a region.

### Bidirectional Links

- **Map → Wiki:** Click a region or city on the globe, navigate to its wiki page.
- **Wiki → Map:** A wiki page for a country/city can embed a focused map view showing its location.
- **Infobox integration:** The country/settlement infobox can auto-include a map thumbnail showing the entity's location highlighted on the globe.

---

## Dashboard

```
/worldmap                             Map gallery
/worldmap/create                      Upload equirectangular + create map
/worldmap/[map]                       Interactive globe view
/worldmap/[map]/regions               Assign hex colors to entities
/worldmap/[map]/cities                Place cities with lat/long picker
/worldmap/[map]/demographics          Edit demographic data per region
/worldmap/[map]/history               Edit historical ownership timeline
```

### Region Assignment UI

Display the flat equirectangular with detected unique hex colors listed alongside. User clicks a color swatch → assigns it to a wiki page. Preview updates the globe in real time.

### City Placement

Click on the 3D globe to place a city marker. The click position converts to lat/long automatically. Assign a name, wiki page link, and city type.

---

## Technical Notes

### Client-Side Rendering

- **Three.js** for WebGL globe rendering
- **SphereGeometry** with equirectangular texture mapping (standard UV)
- **Raycaster** for click detection → UV → pixel lookup
- **CanvasTexture** for dynamic recoloring (render to offscreen canvas, upload as texture)

### Server-Side Processing

- **Sharp** (already in the project) for reading uploaded PNGs and extracting unique hex colors
- Pixel data parsing to build the region color index
- Thumbnail generation for map previews in wiki infoboxes

### Performance

- Equirectangular images should be reasonable resolution (2048×1024 or 4096×2048)
- Dynamic recoloring operates on the image data once per mode switch, not per frame
- City markers as instanced meshes or sprites for efficient rendering at scale
- Texture compression (basis/ktx2) for faster loading on slower connections

---

## Cross-System Data Flow

WorldMap connects to every other KnowThing system:

```
Know ◄── Wordbook ◄──► CarveCraft
  ▲           ▲              ▲
  │           │              │
  └─── WorldMap ────────────┘
          ▲
          │
       Calendar (temporal dimension for all systems)
```

- **Know:** Region/city pages link bidirectionally with the map. Templates embed map views.
- **Wordbook:** Language → region demographics enables the "language map" visualization. The language family tree from Wordbook drives the "language family" view.
- **CarveCraft:** Script → language → region enables the "script map" visualization.
- **Calendar:** Date math powers the historical timeline slider. Era boundaries mark major transitions on the time axis.

The map is not a standalone feature — it's another structured data source that feeds the wiki and draws from every other system. Same philosophy as Wordbook and CarveCraft: define structured data, render it everywhere.
