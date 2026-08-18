# Celestial Sector and System Model

**Status:** Adopted; delivery steps 1–4 and sector-frame authoring implemented 18 August 2026 (migration 0054, sector CRUD/view, explicit system membership, sector↔Orrery transition context) — steps 5–7 pending
**Decision date:** 18 August 2026  
**Applies to:** stellar neighbourhoods, system roots, unbound objects, routes, and the transition into the Orrery  
**Related documents:** [Atlas Architecture](../Atlas-Architecture.md), [Celestial Orrery Roadmap](../../plans/celestial/Celestial-Orrery-Roadmap.md), [Celestial Calendar Integration](./Celestial-Calendar-Integration.md), [Part 1 Launch Plan](../../plans/celestial/Part-1-Launch-Plan.md)

> **Maturity:** This document defines the target model; the first implementation slice now exists. `celestial_sectors` carries the authored frame contract, `celestial_sector_roots` carries root positions (migration 0054 migrated the legacy `galactic_x/y/z` values verbatim into a declared legacy sector and dropped the columns), `/celestial/manage/sectors` authors frames and membership, `/celestial/sector/[slug]` presents the 3D sector view, and entering/returning from a system preserves selection and the sector camera. General non-system roots, regions, routes, influence volumes, time-qualified agents, and distant-sky backdrops remain unimplemented — for those, this document is still the target, not a description.

## Decision Summary

KnowThing will follow the core AstroSynthesis 3 separation between a three-dimensional **sector map** and a parent-relative **orbital hierarchy**.

The model has two spatial levels:

1. A **sector** is a bounded three-dimensional authoring space measured in light-years or parsecs. It contains independently positioned root objects.
2. A **system** is a root object on the sector map together with any hierarchy of stars, planets, moons, rings, stations, ships, or other children beneath it.

The word `system` does not imply that the root is a star. A rogue planet, black hole, station, fleet, local phenomenon, or marker may be a system root. An object is in interstellar or “dead” space when it is a root in a sector and has no orbital parent.

Sector and Orrery views share identity, selection, time, navigation language, and application state. They do not share one literal numerical coordinate space. The viewer may animate the transition between them, but light-years, astronomical units, kilometres, and body radii remain separate authoritative scales.

## Source Model and Deliberate Differences

This design is informed by the AstroSynthesis 3 manual bundled with the [official trial](https://www.nbos.com/download/trial-versions), its [feature list](https://www.nbos.com/products/astrosynthesis/features), and its [system-generator description](https://www.nbos.com/products/astrosynthesis/system-generator).

The useful AstroSynthesis ideas are:

- every sector-map point is a root system, regardless of body type;
- only roots need sector coordinates;
- descendants use parent-relative orbital relationships;
- a subtree can be detached and promoted to a root;
- objects can be reparented between systems;
- sector and orbital views are integrated but remain distinct rendering modes;
- subsectors, routes, influence regions, filters, and notes are layers over the root map;
- authoring may progress from an empty location to a fully described hierarchy.

KnowThing will strengthen areas where AstroSynthesis is deliberately permissive:

- every sector declares a reference-frame contract instead of accepting unexplained XYZ values;
- local physical objects and remote sky backdrops are different data categories;
- authored, imported, derived, overridden, and illustrative values retain explicit provenance;
- generic common spatial identity does not erase type-specific validation;
- dynamic agents such as fleets do not silently masquerade as timeless fixed positions.

## Terminology

### Space

An Atlas spatial context with its own coordinate reference, units, extent, and renderer contract. A celestial sector is one kind of space. A planetary globe or local projected map is another.

### Sector

A bounded three-dimensional space used to author and navigate a stellar neighbourhood, cluster, setting region, or other interstellar volume.

A sector may be:

- cuboid, with width, height, and depth;
- spherical, with a radius;
- measured in light-years or parsecs;
- centred on an authored origin object or an explicitly arbitrary origin.

### Root object

An independently positioned object displayed on the sector map. It has sector coordinates and no orbital parent.

### System

A root object and the complete descendant hierarchy attached to it. The root may be stellar, planetary, artificial, transient, or symbolic.

### Orbital child

An object positioned relative to a parent through authored or derived orbital elements. It does not carry an independent sector XYZ position.

### Region

A named three-dimensional volume used to group, filter, label, or style sector objects. AstroSynthesis calls these subsectors. A region is not the parent of the objects inside it.

### Route

A typed connection between sector roots. A route represents authored setting connectivity, not an orbit and not necessarily a straight physical journey.

### Influence volume

A visual or analytical region associated with a root, such as political reach, sensor range, communications coverage, or a travel boundary. It is not automatically canonical territorial ownership.

### Unbound object

A local physical object with no orbital parent, such as a rogue planet, isolated black hole, or deep-space station. It is a sector root.

### Distant sky object

A remote galaxy, quasar, supernova, or similar feature whose apparent direction matters but whose location is outside the local navigable sector. This is a backdrop object, not a local unbound object.

## Coordinate Contract

### Sector coordinates

Each sector defines:

- a stable identifier and name;
- units: light-years or parsecs;
- shape and extent;
- origin semantics;
- axis directions and labels;
- handedness;
- reference epoch when positions are time-dependent or imported from a time-dependent catalogue;
- whether coordinates are authored, imported, transformed, or approximate;
- optional parent spatial context for a later galaxy-scale Atlas.

The local tuple `(x, y, z)` is meaningful only with that sector contract.

The origin may be:

- **object-centred:** a designated home or reference system is fixed at `(0,0,0)`;
- **frame-centred:** `(0,0,0)` is an arbitrary declared centre with no object required there;
- **imported:** the origin and axes reproduce an external catalogue or setting reference.

KnowThing must not label bare legacy `galacticX/Y/Z` values as self-explanatory galactic coordinates. Until migrated, they are legacy local coordinates with an unknown or implicit frame.

### Orbital coordinates

Orbital children are positioned using their parent relationship and orbital model. Depending on body type and available evidence, that may include:

- semi-major axis or another appropriate distance parameter;
- eccentricity;
- inclination;
- longitude of ascending node;
- argument of periapsis;
- epoch phase, mean anomaly, or equivalent time anchor;
- explicit or derived period;
- declared reference plane and reference direction.

Sector coordinates never substitute for orbital elements. Orbital elements never substitute for the sector position of a root.

### Scale boundary

The authoritative scales remain separate:

| View | Typical units | Authoritative position |
|---|---|---|
| Sector | light-years or parsecs | root XYZ in the sector frame |
| Orrery | AU or kilometres | parent-relative orbital state |
| Body overview | kilometres or normalized body radii | body-fixed or renderer-local coordinates |
| Atlas surface | geographic/projected coordinates | declared planetary CRS |

Renderer-local normalization is allowed, but it must not leak back into authored coordinates.

## Object Model

All sector roots share common spatial identity and presentation, while typed records carry domain-specific facts.

### Common root fields

- stable object ID;
- sector ID;
- name, slug, and optional designations;
- root type;
- XYZ position and coordinate provenance;
- optional position uncertainty;
- notes and citations;
- visibility and discovery status;
- label and marker presentation;
- optional media or model reference;
- optional time-state reference;
- created, updated, and revision metadata.

### Root categories

| Category | Examples | Expected detail |
|---|---|---|
| Stellar | single star, hierarchical multiple, stellar remnant | stellar hierarchy and orbiting bodies |
| Unbound celestial | rogue terrestrial planet, rogue gas giant, isolated minor body | body facts; optional moons, rings, or stations |
| Compact or local phenomenon | black hole, local nebula, anomaly | phenomenon-specific facts and safety/context notes |
| Artificial | station, habitat, megastructure, navigation beacon | structure facts, population, ownership, attachments |
| Agent | fleet, ship, expedition | scenario state or time-qualified position |
| Symbolic | waypoint, battle site, survey marker, narrative location | marker semantics without invented physical properties |

Root type and hierarchy position are separate. A station may be a sector root in interstellar space or an orbital child of a planet. A ship may be independently positioned or contained by a fleet. A planet may orbit a star or exist as an unbound root.

### Typed details

The common root must not become an unvalidated property bag. Type-specific tables or schemas remain responsible for facts such as:

- stellar mass, radius, luminosity, temperature, and spectral type;
- planetary mass, radius, surface model, atmosphere, and rotation;
- station class, population, owner, and operational status;
- fleet composition and scenario time;
- phenomenon class, extent, and observation notes.

Custom fields may extend the model, but established scientific or application semantics must use defined fields.

## Hierarchy Rules

1. Every sector object has either a sector root position or an orbital parent, never neither.
2. A root may own any valid descendant hierarchy supported by its type.
3. A child inherits its containing system from its root ancestor.
4. A subtree may be promoted to a root if its type can exist independently.
5. Promotion preserves the subtree, identity, authored facts, provenance, and media bindings.
6. Promotion requires a new sector position and removes or archives the former parent-relative orbit.
7. A root may be attached beneath a valid parent, becoming an orbital child.
8. Reparenting must explicitly resolve incompatible orbital elements rather than silently retaining invalid values.
9. Deleting a root must never silently delete its descendants without a clear subtree warning.
10. Cycles are invalid.

Example:

```text
Before ejection
Sector
└── Helion system at (0, 0, 0)
    └── Helion
        └── Nera
            └── Nera I

After promotion
Sector
├── Helion system at (0, 0, 0)
│   └── Helion
└── Nera at (3.2, -0.4, 1.1)
    └── Nera I
```

## Objects in Interstellar Space

“Dead space” is not a container or parent type. It is the absence of an orbital parent inside a sector.

### Rogue worlds and isolated natural bodies

An ejected or independently formed planet becomes an unbound celestial root. It keeps normal planetary facts and may retain moons, rings, stations, or other descendants.

Its thermal and visual models must account for the lack of a host star. Any internally generated heat, artificial illumination, or external radiation field must be explicit rather than supplied by a hidden stellar fallback.

### Stations, habitats, and megastructures

Artificial structures may be roots when their meaningful position is interstellar. The authoring model must not require a parent star merely to make them visible.

### Fleets, ships, and expeditions

AstroSynthesis treats fleets and ships as placeable roots, but its sector positions are effectively snapshots. KnowThing must distinguish:

- a timeless or approximately fixed authored location;
- a position valid at a declared scenario time;
- a trajectory or ephemeris supplied by a future dynamics layer.

Part 1 does not require moving interstellar agents. Until such a layer exists, the UI must label time-qualified positions honestly.

### Markers and narrative locations

Markers cover waypoints, navigation beacons, battle sites, anomalies, survey frontiers, and other useful locations that do not justify a specialized schema. A marker is explicitly symbolic and must not acquire fabricated mass, orbit, or physical dimensions.

### Remote sky backdrops

Remote galaxies and similar sky features do not belong in the local sector merely because they are visible from it. Store them by astronomical direction or another appropriate sky reference, with appearance and observation metadata. Their renderer may preserve apparent intensity across local camera movement.

## Sector Layers

### Regions

Regions provide named three-dimensional grouping and filtering. A region defines:

- name and description;
- shape: sphere or cuboid initially;
- centre and size;
- optional orientation;
- styling and label visibility;
- optional semantic type such as survey volume, polity, neighbourhood, or operational zone.

An object may intersect more than one region. Region membership should normally be derived spatially, with optional authored inclusion only when the setting meaning is not purely geometric.

### Routes

Routes connect roots and define setting-specific reachability or common travel paths. Initial fields are:

- stable route and segment IDs;
- start and end root IDs;
- route type and name;
- directionality;
- authored status;
- presentation style;
- optional valid-time interval;
- optional traversal model reference.

Straight rendered segments are presentation. They do not assert that a vessel follows a Euclidean straight line or that the route is physically traversable without an attached travel model.

Proximity tools may propose routes by distance and connection limits. Proposed routes remain illustrative until accepted by the author.

### Influence volumes

Influence volumes may be centred on roots or defined independently. They are typed overlays, not a single `sphereOfInfluence` truth. Political control, communications range, sensor coverage, and jump reach require separate records because they have different meaning and may change over time.

## Viewer Contract

### Sector mode

Sector mode displays roots, regions, routes, influence volumes, labels, and optional distant-sky context. It supports:

- orbiting, panning, and zooming the camera;
- focusing or following a root;
- selecting one or more roots;
- filtering by region, type, affiliation, population, visibility, or route;
- measuring distance in sector units;
- entering the selected system;
- returning to a saved sector view.

### Orrery mode

Orrery mode displays the selected root hierarchy in the existing Plan or Orrery representation. It uses system-local orbital state and retains the sector root as navigation context.

### Transition

The minimum transition contract preserves:

- sector ID and selected root ID;
- selected descendant, if known;
- application time;
- sector camera return state;
- Orrery camera state;
- active filters and layers;
- browser history and a deep-linkable URL.

One persistent canvas is optional. Continuity of state and interaction is required; continuity of the underlying renderer or numerical coordinate space is not.

## Authoring Workflows

### Create a sector

1. Name the sector.
2. Choose light-years or parsecs.
3. Choose a spherical or cuboid extent.
4. Declare the origin and axes.
5. Optionally designate a home system at the origin.
6. Add roots incrementally or import a catalogue with an explicit mapping to the sector frame.

### Create a root

1. Choose a root category or create an explicitly unknown placeholder.
2. Assign identity and sector position.
3. Add the minimum type-specific facts available.
4. Add descendants only when needed.
5. Review how the root is labelled in sector mode and rendered in Orrery mode, if applicable.

### Promote a child to interstellar space

1. Select the child subtree.
2. Choose `Promote to sector root`.
3. Supply or derive the sector position at a declared time.
4. Review the former orbit and choose whether it is archived as history or removed.
5. Confirm the new root and preserved descendants.

### Attach an unbound object to a system

1. Select the root and target parent.
2. Choose `Attach as orbital child`.
3. Supply valid orbital elements or an explicit unknown orbit.
4. Archive the former sector-position assertion where historical provenance matters.
5. Confirm the new hierarchy.

## Search and Query Expectations

Search must operate across roots and descendants. It should support questions such as:

- all roots within 10 light-years of the home system;
- all systems containing a hospitable body;
- all unbound planets in a region;
- all stations on a selected route;
- all roots owned by a polity;
- all objects whose coordinates lack a declared frame;
- the containing root for a matching moon or station.

Results must distinguish the matching body from its containing root.

## Persistence Direction

The future schema should separate these concerns:

```text
celestial_spaces
spatial_reference_frames
sector_roots
celestial_bodies / typed object records
orbital_relationships
sector_regions
sector_routes and route_segments
influence_volumes
distant_sky_objects
position_assertions / ephemerides
```

This is a direction, not a migration prescription. The current database remains temporary infrastructure for Part 1. No parallel import schema should be added solely to anticipate this model.

Stable identity is mandatory across reparenting. A body does not receive a new identity merely because it is promoted from a planet to an unbound root or attached to another system.

## Part 1 Boundary

Part 1 should preserve the path to this architecture without implementing the whole neighbourhood feature.

Required before collecting substantial canon XYZ data:

- document the frame of the existing coordinates;
- stop calling unexplained `galacticX/Y/Z` values universal galactic positions;
- preserve stable system and body identity;
- keep parent relationships general enough for hierarchical multiples and moons;
- keep sector and Orrery units separate.

Not required for Part 1:

- a sector editor;
- region, influence, or route authoring;
- catalogue import;
- continuous interstellar camera travel;
- moving fleets or N-body integration;
- a galaxy-wide parent map;
- automated system or neighbourhood generation.

## Initial Delivery Order

1. ~~Introduce an explicit reference-frame record for the existing system coordinates.~~ Done (0054: `celestial_sectors`).
2. ~~Treat the current home neighbourhood as one sector and migrate existing coordinates into it without changing values.~~ Done (0054: `celestial_sector_roots`, "Local Sector", legacy provenance).
3. ~~Add a sector view of authored roots and an authoring surface for frame contracts and system membership.~~ Done (`/celestial/sector/[slug]`, `/celestial/manage/sectors`).
4. ~~Preserve selection, time, and camera return state when entering and leaving the Orrery.~~ Done for selection (`?focus=` deep link) and sector camera (session-scoped return state); application time is not yet shared because the sector view has no time dimension.
5. Generalize roots to support unbound planets, stations, phenomena, and markers.
6. Add regions and typed routes when authored canon demonstrates a need.
7. Add time-qualified agents and remote sky backdrops as separate later slices.

## Acceptance Criteria

The architecture is implemented sufficiently when:

1. every displayed root belongs to a declared sector frame;
2. roots can be stars or non-stellar objects;
3. an unbound planet can retain moons and other descendants;
4. children use parent-relative orbital data and do not require sector XYZ;
5. the user can move between sector and Orrery modes without losing selection, time, or return context;
6. local unbound objects and distant sky backdrops cannot be confused in the data model;
7. reparenting preserves identity and provenance;
8. filters and search can return both a matching descendant and its containing root;
9. unavailable positions, orbits, and frame semantics remain visibly unavailable rather than inferred as canon.

## Non-Goals

- one global scene graph spanning galaxies to terrain;
- one universal unit or coordinate representation;
- procedural generation as a prerequisite for useful sector authoring;
- forcing every root to be a star;
- treating political regions as the same thing as astronomical reference frames;
- storing narrative markers as fake physical bodies;
- representing remote galaxies as precise local XYZ objects;
- silently converting snapshot positions into trajectories.
