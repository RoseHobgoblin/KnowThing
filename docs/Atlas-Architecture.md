# KnowThing Atlas Architecture

**Status:** Design intent with isolated CRS and viewer spikes completed
**Last updated:** 8 August 2026  
**Related documents:** [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md), [Celestial Surface Models](./Celestial-Surface-Models.md), [Planetary Data Acquisition Catalogue](./Planetary-Data-Acquisition-Catalogue.md), [Celestial Orrery Roadmap](./Celestial-Orrery-Roadmap.md), [WorldMap Vision](./WORLDMAP-VISION.md), [Celestial Calendar Integration](./Celestial-Calendar-Integration.md)

> **Maturity:** Atlas remains design intent. The repository now contains disposable PostGIS/CRS and Cesium/MapLibre prototypes plus an ADR; neither prototype is an application feature or production dependency. Review this document after the first Atlas schema, release contract, or focused-viewer integration. **Expires on contact with implementation.**

## Decision Summary

KnowThing should evolve the current WorldMap and celestial viewers into one multiscale spatial publishing system called **Atlas**.

The product goal is that a user can build the equivalent of Google Maps for a fictional, reconstructed, or researched star empire:

```text
Star empire
└─ Galactic space: systems, territories, routes, phenomena
   └─ Star system: stars, orbits, bodies, stations
      └─ Planet or moon: global imagery, terrain, scientific layers
         └─ Region: borders, geology, climate, transport
            └─ Settlement or site: streets, buildings, landmarks
```

The experience should preserve search, selection, time, layer controls, entity links, and shareable locations across these levels. It must not pretend that all levels occupy one coordinate system or must be rendered by one engine.

The core architectural decisions are:

1. A map is a **composition of versioned semantic layers**, not an uploaded image.
2. Every mapped object belongs to an explicit **spatial space** with a declared coordinate reference.
3. Spaces form a navigable hierarchy and may attach to other spaces through typed transitions.
4. The celestial surface ingestor becomes the common evidence, asset, derivation, and publication pipeline for Atlas data.
5. The current color-coded WorldMap becomes a supported low-homework **import adapter**, not the canonical model.
6. Wiki entities and spatial features remain separate. A country, city, fault, storm, road, or jump lane may be represented by one or more features without being defined by its pixels.
7. Three.js remains appropriate for the galactic and orrery levels. Focused planetary exploration should use a tile-aware geospatial viewer behind a deliberate renderer handoff.
8. Missing data remains missing. Atlas must never manufacture canonical geography, borders, settlements, or history to fill a layer.

## Architecture Gate Results

The isolated spikes are recorded in [ADR 0001](./adr/0001-planetary-crs-and-focused-viewer.md). They narrow the next implementation without prematurely adopting either database or viewer infrastructure:

- A disposable `postgis/postgis:16-3.5-alpine` override successfully registered private `KNOWTHING` WKT2 definitions for Mars, a fictional sphere, and local planar space. It exercised radii/convention scoping, antimeridian and polar geometry, GiST queries, controlled transforms, vector tiles, dump/restore, and rejection of cross-body geometry. The normal development and production database images remain unchanged.
- The application-facing CRS identifier must remain independent from the database SRID. Planetary and fictional coordinates must never borrow Earth EPSG identifiers. Assigning an SRID labels coordinates; it does not perform a transformation.
- Disposable Cesium and MapLibre pages consumed the same Mars and fictional fixtures and handoff state. Cesium demonstrated custom non-Earth ellipsoids and is the selected first focused-globe direction. MapLibre exposed an Earth-radius globe limitation and remains a candidate for a later flat, styled cartographic view.
- The handoff state proven by the prototype carries body identity, application time, selected feature, incoming direction, and return-camera state. The production navigation/selection adapter is still unimplemented and must remain application-owned.

## Product Promise

Atlas should support both of these users without forcing either into the other's workflow:

- A casual author uploads one painted equirectangular world map, assigns several regions, and receives a useful interactive globe.
- A prepared author imports measured or authored elevation, imagery, vector boundaries, settlements, routes, citations, coordinate metadata, and historical versions, and receives a reproducible, deeply explorable atlas.

Supplying better homework should improve fidelity, available tools, and defensibility. It should not merely replace a prettier procedural texture.

Atlas is therefore not a fantasy map generator. It is a framework for composing, publishing, and navigating spatial knowledge.

It may:

- render explicitly illustrative appearance when the user opts into it;
- accept simple images and masks as useful authored inputs;
- derive optimized render artifacts reproducibly from supplied data;
- connect spatial features to the rest of the wiki;
- expose uncertainty, provenance, validity, and missing layers;
- allow a map to become richer incrementally.

It must not:

- infer canonical continents from radius, temperature, or composition;
- invent countries or settlements because a color was detected;
- flatten all source types into one image and discard their semantics;
- silently treat an illustration as observation or authoritative setting fact;
- require complete geology, climate, or cartography before accepting one useful layer.

## What Exists Today

### Celestial placement and surfaces

The celestial model already provides several pieces of the Atlas hierarchy:

- systems have stable records and optional galactic `X/Y/Z` placement;
- stars and bodies form a parented orbital hierarchy;
- bodies have stable identities and physical metadata;
- the Three.js orrery provides system-level selection and navigation;
- the surface compositor can bind independent albedo, elevation, normal, roughness, cloud, and emissive inputs;
- the proposed data-ingest architecture defines sources, immutable assets, derivations, semantic surface layers, and published releases.

These should become Atlas inputs rather than a parallel mapping system.

### Current WorldMap

The current WorldMap is an early prototype with a useful interaction idea and an unsuitable canonical model.

It currently stores:

- one `world_maps` row with an image filename, image dimensions, water color, description, and loose time/event strings;
- palette-derived `world_map_regions` keyed by one hex color per map;
- optional `countries` created or linked for detected colors;
- `world_map_region_geometry` as SVG path strings in source-image coordinates;
- a destructive re-ingest process that deletes and recreates region records;
- server-side raster color quantization and partial SVG parsing;
- direct links from generated countries to Know pages.

The directionally correct ideas are:

- a user can start with an image editor rather than a proprietary map editor;
- map selections can link to wiki entities;
- one geographic foundation can support multiple thematic views;
- time-aware political or cultural layers can connect to Calendar;
- a globe and flat map can expose the same information.

The inherited assumptions that must not survive are:

- an uploaded filename is the map;
- one source image is both geography, presentation, identity, and hit-test index;
- a detected region is necessarily a country;
- a color value is a durable feature identifier;
- SVG path text is a sufficient geographic storage format;
- one string describes the validity time of an entire world;
- re-ingesting may destroy stable region identity;
- all useful visualization can be produced by recoloring one raster.

## The Atlas Scale Ladder

Atlas navigation is continuous in product language, but hierarchical in data and rendering.

### Empire or galactic level

This level answers questions such as:

- Where are the systems?
- Which polity claims this volume of space at the selected date?
- Which systems are connected by jump lanes, trade routes, or communications?
- Where are fleets, anomalies, surveys, or frontiers?

Its primary reference is a declared three-dimensional galactic or setting coordinate frame. The current celestial `galacticX/Y/Z` fields are a starting point, not a complete coordinate contract.

### Star-system level

This is the Three.js orrery:

- physical or computed orbital positions;
- selectable stars, planets, moons, rings, and stations;
- Plan and Orrery cameras;
- physical, enhanced, and marker visibility modes;
- time playback and follow behavior;
- an explicit path into focused body exploration.

System coordinates are not galactic map coordinates and are not surface coordinates. Atlas navigation preserves context while changing space.

### Body level

This level presents a planet, moon, asteroid, or artificial world as a body-fixed globe:

- global imagery and material appearance;
- terrain and bathymetry where available;
- political, geological, climate, biome, or hazard overlays;
- points, lines, polygons, fields, and time-dependent observations;
- search, coordinate readout, measurement, and shareable views.

### Regional and local levels

At increasing detail, Atlas may reveal:

- provinces, drainage basins, tectonic units, and administrative boundaries;
- roads, rail, rivers, shipping lanes, and utility networks;
- settlements, districts, landmarks, ruins, and facilities;
- local site plans, stations, ships, habitats, or interior maps.

A local space may use a projected planar reference rather than latitude and longitude. A station interior need not pretend to exist in a terrestrial map projection.

## Spatial Spaces

No universal coordinate tuple can correctly identify every location in Atlas. A coordinate is meaningful only inside its declared space.

Conceptually, a location is:

```ts
interface AtlasLocation {
  spaceId: string
  geometry: SpatialGeometry
  verticalReference?: VerticalReference
  time?: AtlasInstant
}
```

An **Atlas space** owns:

- a stable ID and human-readable name;
- a kind such as `galactic`, `system_inertial`, `body_fixed`, `local_projected`, or `interior`;
- its coordinate dimensions, units, axes, handedness, and origin;
- a serialized coordinate-reference definition where applicable;
- a parent or host attachment;
- supported bounds and wrap behavior;
- optional reference ellipsoid, sphere, irregular shape, or planar extent;
- temporal behavior, including whether the frame rotates or moves;
- provenance for the definition itself.

### Required initial space kinds

| Kind | Typical owner | Coordinates | Notes |
|---|---|---|---|
| Galactic | Setting or atlas | Cartesian XYZ | Units and origin must be declared |
| System inertial | Celestial system | Cartesian XYZ | Used by orbital state and the orrery |
| Body fixed | Planet or moon | Longitude, latitude, height | Declares prime meridian, direction, datum, and shape |
| Local projected | Region or settlement | Planar XY plus optional height | Projection must identify its source body-fixed space |
| Interior or schematic | Site, station, ship | Local XY or XYZ | May be topological rather than globally georeferenced |

### Attachments and transitions

Spaces form a graph, not merely a database parent tree.

Examples include:

- a system location attached to one point in galactic space;
- a body-fixed surface attached to a moving and rotating body in system space;
- a city plan projected from a bounded area of a body-fixed surface;
- a station interior attached to an orbiting station feature;
- a fictional portal linking two otherwise unrelated spaces.

An attachment must declare whether its transform is:

- static;
- derived from celestial state at a time;
- projected through a coordinate operation;
- approximate or schematic;
- navigational only, with no meaningful metric transform.

The UI may animate between spaces, but it must never imply precision the attachment does not possess.

## Core Domain Model

The detailed database design should follow a schema spike, but the domain boundaries should be fixed first.

### 1. Atlas space

`atlas_spaces` identifies each coordinate domain and its attachment to a host entity or parent space.

Important properties include:

- stable identity;
- kind and coordinate contract;
- optional celestial body/system association;
- parent-space attachment;
- world bounds or shape parameters;
- default camera and scale hints;
- source and revision metadata.

### 2. Atlas layer

A layer is a semantically coherent collection inside exactly one space.

Examples:

- natural-color imagery;
- terrain elevation;
- political boundaries;
- settlements;
- tectonic plates;
- precipitation climatology;
- roads;
- jump routes;
- sensor observations;
- author annotations.

A layer declares:

- semantic type;
- geometry or field type;
- owning space;
- expected units and attributes;
- origin, lineage, and authority;
- default visibility and useful zoom range;
- temporal model;
- style compatibility;
- source asset or derivation lineage;
- permissions and publication state.

A layer is not a style and is not a tile set. The same political-boundary layer can be styled differently in an administrative view, historical view, or monochrome embed.

### 3. Spatial feature

A feature represents one spatial occurrence with stable identity.

It may contain or reference:

- point, multipoint, line, multiline, polygon, multipolygon, volume, or network geometry;
- typed attributes;
- one or more entity links;
- label and search metadata;
- a validity interval or event history;
- uncertainty or positional accuracy;
- source and derivation lineage.

Features and wiki entities have a many-to-many relationship:

- one empire may have disconnected territories represented by many features;
- one river may cross many administrative features;
- one city may have a point at low zoom, a polygon at regional zoom, and a detailed local space;
- one geological unit may have no corresponding wiki article;
- one feature may link to a country, event, language, organization, or other structured record.

Atlas must therefore remove the assumption that every region is a `country`.

### 4. Layer version

A layer version is an immutable snapshot of a layer's content and interpretation.

It pins:

- feature versions or raster/field assets;
- coordinate metadata;
- valid time or supported time range;
- source asset versions;
- derivations and parameters;
- quality and publication state.

Editing creates a new draft version. Published views never change because a source filename was replaced.

### 5. Atlas release

An Atlas release is a coherent published selection of layer versions for one space or a related collection of spaces.

It records:

- included layer versions;
- default styles and visibility;
- a valid time or time policy;
- published runtime artifacts;
- credits, citations, and licenses;
- the user and time of publication.

A planetary surface release from the celestial ingest design should be compatible with, or become a specialized form of, an Atlas release. Do not build two unrelated publication systems.

### 6. Atlas view

A view is a shareable presentation state, not canonical geography.

It can preserve:

- current space;
- camera or viewport;
- selected entity or feature;
- active time;
- visible layers;
- style preset;
- filters and query state;
- transition destination or focused local space.

Named views support wiki embeds such as “political map in 1382,” “tectonic overview,” or “capital district transit.” URL state supports copying the current location without publishing a named view.

### 7. Runtime artifact

The browser should consume optimized derivatives rather than source scientific or authoring formats.

Runtime artifacts may include:

- raster tile pyramids;
- vector tiles;
- quantized terrain tiles;
- simplified overview geometry;
- GPU-compressed textures;
- label/search indexes;
- thumbnails and static previews;
- release manifests.

Every artifact must link to the exact layer version and derivation that produced it.

## Geometry Storage and Querying

Canonical vector geometry must not remain encoded as SVG path strings or palette values.

KnowThing already uses PostgreSQL. The isolated spike confirms that PostGIS can support the tested planetary and local geometry operations, including GiST queries and native Mapbox Vector Tile output through `ST_AsMVT`. It does not yet justify changing the primary database image or settling the Atlas schema. See [PostGIS spatial indexes](https://postgis.net/documentation/faq/spatial-indexes/) and [`ST_AsMVT`](https://postgis.net/docs/ST_AsMVT.html).

The spike registered private `KNOWTHING` WKT2 definitions using internal SRIDs and kept stable application CRS keys separate. The production schema must preserve that split and body/radius/convention constraints. Atlas must not assign Earth EPSG identifiers to fictional or planetary coordinates simply to satisfy a library.

Recommended separation:

- PostGIS geometry for queryable vector features and spatial relationships;
- immutable asset storage for source rasters, multidimensional arrays, terrain, and large vector products;
- derived tiles and compressed assets for delivery;
- JSONB for extensible typed attributes, not primary geometry;
- SVG paths only as import material or derived display output.

Portable GeoPackage import is worth supporting because the OGC standard can package vector features and raster tile sets in one self-describing SQLite container. It remains an exchange asset, not the application's live database. See the [OGC GeoPackage standard](https://docs.ogc.org/is/12-128r19/12-128r19.html).

## Layers, Styles, and Views Must Stay Separate

The old phrase “one map, infinite visualizations” is directionally right but technically incomplete.

The correct model is:

```text
sources and authored facts
    -> semantic layer versions
    -> published Atlas release
    -> style + filters + active time
    -> viewer-specific render artifacts
    -> shareable Atlas view
```

For example:

- a `political_boundaries` layer stores boundary features and entity links;
- a historical query selects features valid at the active date;
- a political style assigns colors from polity identity;
- a language style can join region features to demographic facts;
- a flat viewer consumes vector tiles;
- a globe viewer consumes the same feature identities in globe-projected tiles;
- a static wiki preview renders a server-produced image from the same release.

No recolored output becomes the underlying political, language, or religious truth.

## Time and History

Time is a first-class query dimension, not one label on a map.

Atlas should support:

- timeless layers;
- features valid over an interval;
- discrete dated snapshots;
- sampled time series;
- moving features;
- model outputs with declared epochs;
- uncertainty in dates;
- setting-calendar dates resolved through Calendar.

The active Atlas time must be explicit about which clocks it affects:

- astronomical state in the orrery;
- historical feature validity;
- observational surface layers;
- animated or simulated overlays.

These may share a user-facing time controller without pretending they share precision or origin. A political map dated “Year 420” does not imply that a cloud observation exists for the same instant.

A release or view should report mixed-time content rather than silently presenting it as simultaneous.

## Search, Selection, and Permalinks

The continuity of Atlas comes from shared application state more than a single canvas.

Search should be able to return:

- systems, stars, and bodies;
- wiki entities with mapped features;
- named features without wiki pages;
- coordinates in the current space;
- saved views and releases.

A result carries a destination containing at least:

```text
space + feature/entity + camera/extent + optional time + optional layer hint
```

Selecting a system in empire view should enter its orrery. Selecting a planet should reveal an `Explore surface` action. Selecting a city can focus its surface feature and, if present, enter its local space.

Every meaningful view should have a durable URL. Wiki embeds should use the same destination model with restricted controls.

## Renderer Boundaries and Handoffs

Atlas should not force one renderer to solve every scale.

### Three.js responsibilities

Three.js remains responsible for:

- galactic spatial views;
- system Orrery and Plan views;
- celestial physical/enhanced/marker visibility;
- overview body materials;
- animated transitions to the boundary of focused surface exploration.

### Focused planetary viewer responsibilities

A dedicated geospatial viewer should handle:

- globe and flat cartographic modes;
- raster and vector tile streaming;
- terrain level of detail;
- labels, symbols, clustering, and layer styling;
- high-density feature picking;
- coordinate readout and measurement;
- stable navigation from global to local scales.

CesiumJS is the selected first focused 3D planetary direction after the disposable prototype demonstrated custom non-Earth ellipsoids. Its documented model separates imagery from streamed terrain, and `CesiumTerrainProvider` accepts an ellipsoid option. Production adoption remains gated on an app-owned adapter, tiled KnowThing assets, teardown/memory tests in Svelte, and self-hosting review. See [Cesium terrain](https://cesium.com/learn/cesiumjs-learn/cesiumjs-terrain/), [Cesium imagery providers](https://cesium.com/learn/cesiumjs/ref-doc/ImageryProvider.html), and [`CesiumTerrainProvider`](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html).

MapLibre GL JS remains a strong candidate for a later flat styled vector/raster view. The prototype confirmed that its globe route carries an Earth-radius assumption and should not be the first arbitrary-body globe. See [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs) and [MapLibre globe projection data](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/).

The prototype used shared Mars and fictional-world fixtures to test:

- a non-Earth radius or ellipsoid;
- a 2:1 authored albedo;
- a tiled height field;
- vector boundaries crossing the antimeridian and poles;
- body-fixed positive-east coordinates;
- globe and flat navigation;
- feature picking and DOM overlays;
- on-demand loading and disposal inside Svelte;
- self-hosted artifacts without a mandatory proprietary service;
- a handoff to and from the Three.js orrery.

### Initial handoff contract

The first implementation should use an explicit transition rather than fake seamless zoom:

1. The user selects a body in the orrery.
2. `Explore surface` opens the body's active Atlas release.
3. The handoff carries body identity, active time, selected feature if applicable, incoming camera direction, and return destination.
4. The surface viewer opens at a globe overview with matching visual orientation where practical.
5. `Return to system` restores the prior system camera and selection.

A later visual transition may cross-fade or match camera framing. Internal renderer separation should remain.

## Ingest Is Shared Infrastructure

The celestial surface ingestor should become the first Atlas ingest implementation.

Its source, asset, asset-file, derivation, layer, and release concepts generalize beyond material textures:

```text
original file or authored data
    -> source and license
    -> immutable data asset
    -> inspection and declared interpretation
    -> coordinate normalization
    -> semantic Atlas layer version
    -> derived runtime artifacts
    -> review
    -> immutable Atlas release
```

The renderer must never parse GeoTIFF, NetCDF, PDS, GPML, Shapefile bundles, or similar source products directly. Background ingest creates fit-for-purpose artifacts while retaining the original.

### Adapter contract

Each importer should implement the same conceptual stages:

```ts
interface AtlasIngestAdapter {
  canInspect(asset: DataAsset): boolean
  inspect(asset: DataAsset): InspectionReport
  validate(asset: DataAsset, interpretation: DeclaredInterpretation): ValidationReport
  derive(asset: DataAsset, request: AtlasDerivationRequest): Promise<DerivedAsset[]>
}
```

An adapter reports ambiguity instead of guessing canonical meaning.

## The Homework Ladder

Users should be able to stop after any useful step.

| Homework supplied | Atlas result | What remains unavailable |
|---|---|---|
| Body facts only | Flat or explicitly illustrative overview sphere | Canonical geography and surface layers |
| Painted albedo | Authored globe appearance | Clickable regions, terrain, semantics |
| Color-coded region mask | Clickable categorical regions after assignment | Meaning for unassigned values |
| SVG or GeoJSON boundaries | Queryable vector regions and labels | Terrain unless separately supplied |
| Elevation raster | Terrain and measurement against declared datum | Land cover or politics unless supplied |
| Settlement CSV/GeoJSON | Searchable markers and wiki links | Street detail unless supplied |
| Road/route network | Network visualization and future routing | Travel costs unless declared |
| Dated boundary versions | Historical map slider | Intervals not covered by supplied history |
| Scientific source products | Reproducible analytical layers with provenance | Any variables not present in the products |
| Complete published release | Stable, citable, restorable atlas | Nothing is inferred beyond the release |

Quality labels should describe individual channels and layers, not stamp the whole planet as “realistic” or “procedural.”

## Legacy WorldMap as an Import Adapter

The existing workflow remains valuable when explicitly demoted from data model to adapter.

### Colored raster import

The user uploads an image and chooses its meaning:

- **Appearance image:** store as an albedo or cartographic raster; do not detect entities.
- **Categorical mask:** treat each exact or configured palette value as a category key.
- **Region seed:** optionally polygonize selected values into derived vector features.

The importer must ask for, or clearly default, the following:

- target Atlas space;
- projection or plate convention;
- whether antialiasing and color quantization are intentional;
- water/background meaning, if any;
- category semantics;
- mapping from category values to existing entities or new neutral features;
- valid time;
- origin and authority.

It must not automatically create `countries`.

### SVG import

SVG shapes may be imported as authored vector features when a coordinate interpretation is declared. CSS fill extraction and path parsing can remain compatibility logic, but canonical geometry must be normalized and validated.

The source SVG remains immutable. Parsed geometry is a derived product. Unsupported transforms or shapes produce review warnings rather than silent omission.

### Stable identity on re-import

Re-import creates a new draft layer version. It must not delete the published version.

Feature matching may use:

- explicit source IDs;
- user-assigned stable keys;
- palette keys within one source lineage;
- geometry-assisted suggestions requiring confirmation.

Published feature URLs remain stable where identity is confirmed. Unmatched additions and removals appear in a review diff.

## Entity and Wiki Integration

Atlas should link through stable structured identities, not fragile slugs embedded in geometry records.

Capabilities should include:

- feature-to-entity and entity-to-feature backlinks;
- a wiki page listing all spaces and layers in which it appears;
- map embeds focused on an entity, feature, coordinate, or saved view;
- automatic location thumbnails for infoboxes;
- Sources and Data panels shared with celestial bodies;
- entity search that can open the most relevant Atlas representation;
- permission-aware links to unpublished or private layers.

The same entity may have different representations by scale and time. Atlas resolves the best visible representation without changing entity identity.

## Networks and Routing

Routing is not required for the first Atlas release, but the model must not prevent it.

Networks may exist at several unrelated scales:

- streets and paths;
- rivers and shipping lanes;
- rail and air routes;
- orbital transfer or service routes;
- interstellar jump lanes or gates.

A network layer needs explicit nodes, edges, directionality, costs, constraints, validity, and owning space. Cross-space travel uses typed transition edges rather than pretending a road LineString continues through interstellar coordinates.

Initial Atlas work should visualize networks and preserve their topology. Route solving can follow after the feature, time, and space contracts are stable.

## Runtime Delivery and Performance

Atlas should generate immutable artifacts per published layer version and viewer profile.

Likely outputs include:

- low-resolution global plates for the orrery;
- raster pyramids for planetary imagery and analytical fields;
- vector tiles for features and labels;
- quantized terrain or height tiles;
- overview geometry for empire and system levels;
- search indexes keyed by stable feature/entity IDs;
- static previews for wiki pages and unavailable-WebGL fallbacks.

Mapbox Vector Tiles are a practical vector delivery format and can be generated by PostGIS. The format encodes geometry and attributes in tile-local coordinates; it is a runtime artifact, never the authoritative geometry. See the [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec).

The tile coordinate scheme must be an explicit derivation choice. Do not assume an Earth Web Mercator plate is correct for polar, global, irregular-body, or local-site data.

The client should:

- request only visible zoom levels and layers;
- cancel obsolete requests during navigation;
- cap caches by memory budget;
- use release-addressed immutable URLs;
- degrade to overview artifacts on constrained devices;
- dispose renderer and GPU resources on navigation;
- expose failed or unavailable tiles as status, not fabricated content.

## Authorship, Permissions, and Publication

Atlas separates draft editing from published consumption.

A safe workflow is:

```text
upload or edit
    -> inspect
    -> declare meaning
    -> derive preview
    -> review warnings and provenance
    -> publish immutable release
    -> update active release pointer
```

Permissions may apply independently to:

- original assets;
- draft layers;
- published layers;
- source citations;
- derived downloadable artifacts;
- named views and embeds.

A public release must not leak a private original through predictable artifact URLs or embedded metadata.

## Proposed Route and UI Model

Names are provisional, but the product should expose these concepts directly:

```text
/atlas                                  atlas and space search
/atlas/[space]                          default view for a space
/atlas/[space]/data                     layers, releases, sources
/atlas/[space]/edit                     layer composition and draft release
/atlas/[space]/import                   ingest assets or legacy maps
/atlas/[space]/views/[view]             named shareable view
/celestial/[system]                     existing system detail and orrery
/celestial/[body]/surface               redirect or entry into its Atlas space
```

The surface viewer should include:

- search;
- globe/flat control where supported;
- layer switcher and legend;
- active date and data-time status;
- coordinates, scale, and measurement;
- selected feature/entity panel;
- Sources and Data access;
- share-view action;
- return-to-system context.

The editor should include:

- source and asset browser;
- layer stack and semantic type;
- coordinate interpretation review;
- feature/entity assignment;
- derivation status and validation warnings;
- before/after or release diff;
- publication checklist.

## Migration from Current WorldMap

Migration should preserve existing work without allowing the legacy tables to dictate Atlas.

### Phase A: Freeze the conceptual boundary

- Mark `WORLDMAP-VISION.md` as a legacy prototype, not the target architecture.
- Stop expanding `world_maps` with new thematic or scientific fields.
- Keep current pages working while Atlas foundations are built.
- Treat current ingest as compatibility behavior.

### Phase B: Introduce Atlas foundations

- Add spatial spaces and body/system associations.
- Add generic layers, features, entity links, versions, releases, and views.
- Add source/asset/derivation records from the celestial ingest design.
- Use the completed disposable PostGIS/non-Earth CRS spike and ADR as evidence before choosing canonical geometry columns; keep the primary database unchanged until that schema decision.

### Phase C: Build legacy import

- Import each `world_maps` source as an immutable asset.
- Create a body-fixed or explicitly planar Atlas space.
- Convert its regions into a draft categorical layer.
- Preserve palette values as source keys, not feature identity.
- Convert linked countries to generic entity links.
- Retain existing paths as source/diagnostic material while deriving canonical geometry.
- publish only after an administrator reviews ambiguous projection, time, and feature matches.

### Phase D: Redirect consumption

- Render migrated maps through Atlas.
- Make old WorldMap URLs redirect or act as compatibility views.
- Keep a migration audit until every map has a reviewed Atlas release.
- Remove legacy write paths only after parity and rollback testing.

The migration must never silently overwrite a published Atlas release or delete unmatched legacy information.

## Implementation Sequence

### Phase 0: Contracts and integrity

- Adopt the Atlas name and this scale/space model.
- Implement the existing surface-media integrity work: usage lookup, validation, rename rewriting, delete protection, and texture-load failure reporting.
- Define stable resource references shared by celestial bodies, wiki entities, and Atlas features.
- Decide how setting calendars produce comparable internal intervals without discarding original notation.

### Phase 1: Evidence and spatial foundation

- Add source, immutable asset, asset-file, and derivation records.
- Promote the completed disposable PostGIS findings into an application schema only after the production ADR gate is satisfied.
- Add Atlas spaces, layers, layer versions, releases, and generic entity links.
- Make celestial surface releases use the shared publication model.

### Phase 2: Planetary vertical slice

- Create one body-fixed Atlas space from an existing celestial body.
- Publish albedo, elevation, one vector boundary layer, and settlement points.
- Generate tiled runtime artifacts.
- Build the production Cesium adapter from the completed shared-fixture prototype; retain MapLibre as a later flat-view candidate.
- Implement explicit Orrery → Explore surface → Return to system handoff.
- Add search, selection, permalink, layer legend, and provenance display.

### Phase 3: Progressive authoring and legacy import

- Add colored raster/mask import.
- Add SVG and GeoJSON import.
- Add feature/entity assignment and re-import diffing.
- Migrate one existing WorldMap without losing identity or source information.
- Add draft/review/publish workflow.

### Phase 4: Rich data and local spaces

- Add scientific raster and multidimensional adapters from the ingest roadmap.
- Add terrain production and level-of-detail policies.
- Add local projected spaces and settlement/site transitions.
- Add layer joins to structured language, religion, demographic, and other wiki data.
- Add static and interactive wiki embeds.

### Phase 5: Empire atlas

- Formalize galactic coordinate spaces and provenance.
- Build system points, territories, route networks, and labels.
- Connect empire search to systems, bodies, surfaces, and local spaces.
- Add named multiscale views and return navigation.

### Phase 6: Time and networks

- Add dated feature versions and coherent historical queries.
- Add mixed-time warnings and Calendar integration.
- Add network topology validation.
- Add routing only after space-transition and cost models are explicit.

## Verification Strategy

Pure and integration tests should cover:

- coordinate round trips within each supported space;
- body-fixed longitude direction, prime meridian, poles, and antimeridian;
- stable feature identity across reviewed re-imports;
- immutable published releases;
- exact provenance from runtime artifact to derivation and source asset;
- feature/entity many-to-many links;
- time interval selection and mixed-time reporting;
- spatial queries and tile bounds at several zoom levels;
- globe/flat selection parity;
- Orrery-to-surface handoff and camera restoration;
- missing, private, corrupt, and failed assets;
- legacy map migration without destructive replacement;
- reduced-motion and non-WebGL fallbacks;
- permissions on sources, drafts, releases, and artifacts.

The first end-to-end fixture should contain:

- one system with a placed planet and moon;
- a body with known radius and coordinate convention;
- authored albedo and elevation;
- one region crossing the antimeridian;
- one polar region;
- settlements at several zoom levels;
- one dated boundary change;
- one linked local site;
- complete source and derivation records.

## Acceptance Criteria

The Atlas foundation is successful when:

- every displayed location belongs to a declared space;
- every published layer identifies its meaning, time, provenance, and exact version;
- simple authors can publish a useful globe from one well-described image;
- advanced authors can replace or add individual layers without rebuilding the planet;
- a color-coded map imports without colors becoming permanent feature identity;
- entities are linked to features without being defined by them;
- a user can navigate empire → system → body → region and return without losing context;
- surface renderers consume tiled derivatives rather than original scientific files;
- missing layers remain visibly unavailable rather than invented;
- published views are shareable, reproducible, and restorable;
- old WorldMap content can be migrated through review rather than discarded.

## Explicit Non-Goals

The initial Atlas project does not include:

- automatic invention of geography, tectonics, climate, countries, or settlements;
- a full GIS desktop editor in the browser;
- physical galaxy or orbital simulation beyond the celestial viewer's declared model;
- street-address geocoding without user-provided address data;
- routing before network semantics and cross-space transitions exist;
- one renderer or one projection for every scale;
- automatic claims that authored fictional data is scientific observation;
- conversion of every wiki fact into a map layer.

## Naming Decision

Use **Atlas** for the product and shared architecture.

Use **WorldMap** only for the current legacy feature and its compatibility importer. A world map is one possible Atlas composition attached to one body; it is not the system boundary.

The durable product statement is:

> KnowThing Atlas lets people compose, publish, and navigate the best spatial model supported by their work—from a star empire to a single site—without requiring complete data and without inventing authority they did not provide.
