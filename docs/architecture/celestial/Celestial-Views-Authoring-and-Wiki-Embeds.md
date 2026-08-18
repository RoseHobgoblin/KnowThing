# Celestial Views, Authoring, and Wiki Embeds

**Status:** Design intent
**Decision date:** 18 August 2026  
**Applies to:** celestial sector and system displays, field-driven authoring, apparent skies, saved views, and WikiText transclusion  
**Related documents:** [Structured Data Vision](../STRUCTURED-DATA-VISION.md), [Atlas Architecture](../Atlas-Architecture.md), [Celestial Sector and System Model](./Celestial-Sector-and-System-Model.md), [Calendar and Celestial Boundaries](./Celestial-Calendar-Integration.md), [Celestial Orrery Roadmap](../../plans/celestial/Celestial-Orrery-Roadmap.md)

> **Maturity:** KnowThing currently exposes the firmament subsystem in code and URLs as **Rodder**. It has concrete Rodder records, sector and root viewers, page-level configuration, a schema-versioned URL view contract for copying and restoring sector/root compositions, authored same-sector apparent skies in Orrery mode, a full-width root viewer shell with contextual inspectors and optional display trays, presentation-neutral public consumer documents, and direct WikiText root/sector map transclusion. Those skies currently use static root barycentre positions and unresolved combined stellar light; they do not add procedural ambient stars, proper motion, light-travel delay, atmospheric effects, or surface parallax. The local viewer is named `RootMap`, not `SystemMap`: stellar systems and independent bodies such as rogue worlds can both own sector-root hierarchies. Remnant-specific facts, vessels, stations, phenomena, and other future root kinds still require the generic object/facet model. Saved view objects remain an optional future convenience rather than a publishing dependency.

## Decision Summary

KnowThing is a structured wiki, not a collection of isolated specialist applications. Celestial maps therefore remain **displays over authored fields and relationships**. They must not become a second source of celestial truth.

Hierarchy and spatial editing are useful, but they are authoring lenses:

- a relationship display derives a tree or graph from parent, orbit, containment, and membership fields;
- a spatial display derives a sector or system scene from position, orbit, appearance, and time fields;
- direct manipulation in either display writes through the same validated field contracts used by ordinary forms;
- prose pages, infoboxes, tables, maps, timelines, and future displays can project the same objects differently.

This works with the current typed celestial tables and with the intended future model in which one object declares a set of facets. The viewer consumes capabilities rather than owning persistence.

Every interactive map is driven by a serializable **view specification**. A saved view is a stable, revisionable object containing such a specification. WikiText can transclude a saved or inline view in a locked composition and offer an **Explore** action that opens the free viewer at exactly the same state.

System views must also render a generated apparent sky from authored spatial and stellar data. Other authored stars are part of the setting's spatial truth and should appear in the correct direction, colour, and relative brightness from the current system. A decorative generic star texture is not an adequate substitute.

## Product Principle: Fields Become Displays

The durable abstraction is not a sector editor, calendar application, or Orrery database. It is:

```text
object
  -> declares facets
  -> facets expose typed fields and relationships
  -> displays consume facet capabilities
  -> author interactions produce validated field mutations
```

A future object representing Nacre might declare identity, celestial-body, orbit, physical-properties, spatial-representation, and article-content facets. A route might declare identity, ordered-network, spatial-representation, temporal-validity, and article-content facets. They remain ordinary objects even though different displays become available for each.

The current schema does not need to be prematurely replaced to use this pattern. An application-owned projection layer can expose today's tables through the same capability contracts expected from future facets:

```text
current celestial tables         future generic objects
            \                         /
             -> capability projection
                       |
             relationship / sector / Orrery / infobox displays
```

Displays must depend on stable object identity and declared capabilities, not on a page slug or an assumption that every spatial object is a star system.

### Distinct responsibilities

| Concern | Owns | Must not own |
|---|---|---|
| Object or typed record | authored facts, identity, provenance | viewer-local state |
| Facet or current-schema adapter | field schema, validation, available capabilities | page layout |
| Relationship record | typed connection and its qualifiers | a single permanent tree presentation |
| Display | projection and interaction language | duplicate canonical data |
| View specification | composition, camera, layers, time, interaction policy | physical or cultural facts |
| Saved view object | stable identity and revisions of a view specification | copies of referenced entities by default |

## Authoring Through Displays

### Relationship lens

A hierarchy display may present sector membership and orbital ancestry as a tree because that is often the clearest authoring representation. The tree is not canonical in itself. It is derived from typed relationships.

Author actions such as reparenting a moon, promoting a body to a sector root, or moving a subtree between systems must invoke domain mutations that:

- validate allowed relationship types;
- prevent cycles and orphaned published objects;
- resolve or explicitly archive incompatible orbital and sector-position fields;
- preserve stable identity, prose, media, provenance, and descendants;
- preview the consequences before committing a destructive structural change.

The same relationship data may later render as a graph, table, breadcrumb, infobox section, or query result.

### Spatial lens

A sector display may author root positions, reference frames, regions, and routes. Direct manipulation writes declared spatial fields; it does not save renderer coordinates.

Dragging a root can update sector XYZ only when the author is in an editing mode with a declared frame and units. Renderer normalization, camera distance, marker enlargement, and screen-space label offsets are never written back as physical positions.

The spatial lens should eventually support:

- adding and selecting roots in context;
- camera orbit, pan, dolly/zoom, focus, reset, and useful orthographic views;
- numeric and gizmo-based position editing;
- frame bounds and out-of-bounds warnings;
- relationship and position validation in context;
- filters and overlays provided by compatible facets;
- creation from reusable object/facet templates without making templates canonical types.

### Ordinary field authoring remains first-class

Every mutation available through a graphical display must remain understandable through structured fields. A user must be able to inspect exact coordinates, relationships, units, provenance, and derivation state without reverse-engineering a picture.

Graphical authoring is an additional field editor, not a replacement for precise field authoring.

## View Specification

The same view contract should drive full viewers, page hero displays, infoboxes, WikiText transclusions, previews, and static fallbacks.

A view specification requires at least:

```text
schema version
renderer and view mode
space or system identity
focus and selected object identities
camera projection, pose, target, zoom or field of view
application epoch or time cursor
visible layers and filters
separate object-label and apparent-sky-label settings, plus trail, exposure, and visibility settings
viewport hints such as aspect ratio
data resolution policy
interaction policy
```

Renderer-specific options may extend the common contract, but they must be schema-versioned and validated. Unknown or obsolete options must produce a recoverable compatibility message rather than a page-level failure.

### Camera state

Camera controls are not merely viewer polish. Their serializable state is what makes a composition reproducible.

Sector and Orrery cameras remain separate because they operate in different authoritative coordinate spaces. Each view records the appropriate camera state, while transitions retain enough return state to move between them without losing context.

The camera contract should avoid storing unstable implementation details from Three.js or another renderer when a renderer-neutral value is available. Store projection, target, orientation, distance or scale, and field of view; derive internal matrices at runtime.

### Data resolution policy

Fixing the view does not automatically fix the data. A saved view therefore declares one of the following policies:

- **Live:** stable object references resolve to their currently published data.
- **Fixed membership:** the included object IDs are fixed, but their published fields remain live.
- **Revision pinned:** the view and referenced object revisions are fixed for historical or evidentiary citation.

Live should be the normal wiki behavior. Revision pinning exists where a page must reproduce what was known or asserted at a particular revision.

### Interaction policy

Interaction is a capability set, not one `locked` boolean. It independently controls:

- camera movement;
- time movement;
- layer and filter changes;
- selection and hover inspection;
- following links to referenced objects;
- mutation and authoring controls.

Product presets can expose this simply:

- **Locked composition:** fixed camera, time, layers, and filters; hover, selection, and entity links may remain available.
- **Guided:** limited camera or selection changes within an authored composition.
- **Explore:** normal free viewer controls, with no authoring permission implied.
- **Author:** free viewer plus validated field mutations according to user permissions.

An embedded view's **Explore** action opens the free viewer while preserving its focus, camera, time, layers, and selection.

## Saved Views and WikiText

If durable named compositions become useful, a saved view may be introduced as a first-class KnowThing object with:

- stable identity and human-readable title;
- a schema-versioned view specification;
- creator, revisions, permissions, and publication state;
- optional explanatory prose and preview media;
- backlinks showing which pages transclude it.

Such a reference would be optional convenience syntax:

```wikitext
{{view:Orison Fold/Nacre overview}}
```

Convenience syntax may exist for common displays:

```wikitext
{{Root map|Orison Fold|focus=Nacre|mode=orrery}}
{{Sector map|The Palimpsest Reach|focus=Orison Fold}}
```

The direct root and sector forms are the implemented baseline. They resolve live public Rodder consumer documents, accept readable display and interaction arguments, and may also consume the same validated `view` payload used by copied viewer links. They do not require a persisted saved-view record.

These forms are authoring conveniences and should compile to the same view specification. They must not create separate celestial-only embedding infrastructure.

Wiki transclusions should support:

- responsive article-body and compact infobox profiles;
- an authored aspect ratio and accessible text alternative;
- locked, guided, or exploratory interaction presets;
- loading the same display component used by the full viewer;
- a static preview for printing, no-JavaScript clients, reduced capability, and render failure;
- permission-aware resolution of objects and layers;
- an Explore link that preserves the complete view state;
- clear indication when a referenced view or data revision is unavailable.

The server-side WikiText pipeline should discover view references during parsing, batch-load their published specifications and referenced data, and avoid client-side request waterfalls. A map embed is a structured-data display, following the same principle as generated infobox fields and comparison tables.

## Generated Apparent Skies

### Required outcome

When a user enters a system, the background must represent the sky implied by the authored setting. If Glasswake and Vey's Anvil exist at known sector coordinates, they must appear from Orison Fold in their correct directions with defensible relative appearance.

This makes sector and system views spatially coherent. It also creates a foundation for later statements and displays such as “visible from Nacre,” constellation diagrams, historical alignments, and observer-sky views.

### Local authored star field

For a system-centred view:

1. Resolve the viewpoint in a declared sector frame.
2. Resolve every visible authored stellar source in compatible spatial frames.
3. Compute the direction vector from viewpoint to source.
4. Derive colour from authored temperature or spectral data when available.
5. Derive relative apparent intensity from luminosity or absolute magnitude and distance when available.
6. Render the source on a camera-centred celestial sphere or equivalent non-translating background layer.
7. Retain stable source identity for selection, labels, links, and navigation.

For an absolute magnitude `M` and distance `d` in parsecs, the ordinary distance modulus may provide apparent magnitude:

```text
m = M + 5 log10(d) - 5
```

The renderer will require bounded exposure and a visual transfer function because physically large brightness ranges cannot be represented literally on an ordinary display. The transfer function is presentation; the ordering and authored inputs remain inspectable.

Movement within an Orrery is negligible relative to interstellar distance for most background stars, so a system-root viewpoint is an acceptable initial contract. It should remain explicit rather than pretending to be a surface observer.

The view specification's epoch also applies to the sky. The initial implementation may evaluate authored positions at that epoch without modelling light-travel delay, but it must declare that convention. If KnowThing later stores time-varying stellar state, proper motion, eruptions, or other historical observations, the apparent-sky service may add retarded-time evaluation rather than embedding temporal assumptions in the renderer.

### Local companions and remote context

Three categories must remain distinct:

- **System-local luminous bodies:** placed from orbital state and rendered as scene geometry and lights.
- **Authored stars in compatible sectors:** projected into the apparent sky from actual positions.
- **Remote sky objects:** galaxies, quasars, nebulae, or authored directional features outside the navigable local volume.

A fourth optional category may provide a procedural ambient galactic field where authored catalogues are incomplete. It must be visually and semantically marked as illustrative, deterministic from a declared seed, and incapable of becoming canonical objects merely because it was rendered.

Missing luminosity, temperature, distance, or frame data must degrade visibly and predictably. The renderer may use a declared illustrative fallback, hide the source, or show a warning; it must not silently present invented values as authored fact.

### Observer skies are a later display

A sky from a planetary surface additionally requires:

- observer body and surface coordinates;
- date and time;
- body rotation and axial orientation;
- local horizon and possibly terrain;
- atmosphere and extinction model;
- system-local orbital state.

That is a later observer-sky display using the same objects and apparent-direction services. It should not be conflated with the first system-centred background.

## Viewer UI Direction

The system and sector viewer should no longer reserve a permanent right-hand panel for unrelated information. That panel currently mixes system metadata, hierarchy, calendar display, and viewer controls while substantially reducing the map.

The intended composition is:

- page identity and breadcrumbs remain part of the wiki page shell;
- a small in-view identity indicator may show the current space and focus;
- view controls use compact floating or edge toolbars;
- object labels and hover affordances remain in context, with leader pillars separating labels when distant bodies converge on screen;
- selecting an object opens a temporary inspector card or responsive bottom drawer;
- optional displays such as calendars, legends, sources, and layer configuration open as trays or overlays;
- complete structured fields render below or around the hero view using the page's normal display composition;
- authoring controls appear only in author mode and do not permanently burden cited views.

On narrow layouts and infoboxes, the view must remain useful without reproducing the desktop inspector. The map is a page display, not an application dashboard embedded beside a second page.

## Calendar Boundary

Calendars are cultural and historical rule systems. They are not required to obey contemporary or local orbital physics.

A calendar display or builder must faithfully evaluate the rules declared at the calendar's creation or reform. It may reference celestial bodies, physical cycles, and historical states, but those references are optional inputs and comparisons rather than compulsory consistency constraints.

Validation distinguishes:

- structural validity: the declared calendar schema and rules can be evaluated;
- referential validity: linked objects and revisions exist or have an explicit fossilized representation;
- author-visible divergence: calendar rules differ from current physical cycles;
- physical validity: applicable only when a field explicitly claims to represent physical reality.

An unusual, drifting, symbolic, or deliberately inaccurate calendar can be valid. Malformed data that crashes its display cannot.

## Cross-Domain Worldbuilding Objects

Routes, settlements, factions, events, territories, claims, and anomalies must not be implemented as features owned only by celestial maps. They are ordinary worldbuilding objects and typed relationships that multiple displays may consume.

Examples:

| Concept | Possible capabilities | Displays that may consume it |
|---|---|---|
| Route | ordered network, spatial references, validity interval, traversal rules | sector map, planetary atlas, timeline, article |
| Settlement | location, population, polity links, article content | globe, local map, infobox, tables |
| Faction | organization, membership, claims, temporal state | article, relationship graph, map overlays |
| Event | time, participants, locations, consequences | timeline, calendar, map, article |
| Territory or claim | claimant, region, validity, confidence, type of control | sector map, world map, historical view |
| Anomaly | location or extent, phenomenon facets, observations | Orrery, sector map, article, event views |

Spatial displays query objects with compatible location or geometry capabilities. Timeline displays query temporal capabilities. Wiki pages and infoboxes can render both. No domain must copy the object merely to show it.

## Integrity and Publication

Direct manipulation, generic facets, and JSON-backed extensibility do not reduce the need for integrity.

The system should enforce invariants at the lowest practical layer:

- foreign keys for stable object and relationship references;
- uniqueness and required-value constraints for locally decidable facts;
- cycle prevention and valid relationship-type checks;
- complete coordinate tuples attached to declared frames;
- root/child exclusivity where the spatial model requires it;
- schema validation for every typed facet and view specification;
- transactions for multi-object structural mutations;
- optimistic concurrency or revision checks for authoring;
- publish-time validation for cross-facet and cross-object conditions that cannot be expressed as simple database constraints.

Drafts may remain incomplete when incompleteness is explicit and useful. Published displays must not receive structurally invalid data. “Unknown” is a valid authored state; accidental `null`, an orphan, and an obsolete payload are not equivalent to unknown.

View rendering must fail locally. One invalid optional display should produce an actionable placeholder and diagnostic, not a 500 for the entire wiki page.

## Delivery Direction

The architectural dependency order is:

1. ~~Define and validate the first common view specification, including serializable sector and Orrery cameras.~~ Delivered for ephemeral versioned view links; saved-view policy and interaction profiles remain later work.
2. ~~Complete sector camera controls using that state contract.~~ Delivered for the current orbit/pan/zoom controls and link restoration.
3. ~~Generate system apparent skies from authored sector and stellar data.~~ Delivered for static same-sector root positions, unresolved stellar members, and brightness-provenance diagnostics; observer-surface and illustrative ambient layers remain later opt-in work.
4. ~~Refactor the viewer shell around contextual overlays and remove the permanent information panel.~~ Delivered for the root viewer: selection opens a temporary inspector, while overview, object browsing, calendar, and display settings use responsive opt-in trays; backlinks remain in normal page flow.
5. ~~Expose comprehensive live Rodder consumer documents and use them for full viewers, APIs, infobox projections, and WikiText root/sector displays.~~ Delivered with typed public entity/sector documents, local diagnostics, batched transclusion discovery, configurable interaction policies, copied-view restoration, and textual fallbacks.
6. Optionally add named saved views if real authoring workflows need reusable identities, permissions, or revision-pinned compositions; direct transclusion does not depend on them.
7. Expose relationship and spatial displays as bidirectional field authoring surfaces.
8. Generalize current-schema projections into facet capability providers as the generic object model arrives.
9. Add cross-domain objects and map/timeline layers without making them celestial-owned.

This order does not require the generic facet database migration before useful work begins. The view and capability contracts are the compatibility seam.

## Acceptance Criteria

This architecture is sufficiently realized when:

1. sector and system view state can be serialized, restored, linked, and validated;
2. every authored star with sufficient compatible data appears in the system sky at the correct direction and defensible relative appearance;
3. illustrative sky content is distinguishable from authored objects;
4. the same viewer component can render a free view and a locked wiki transclusion;
5. an embedded view can open Explore mode without losing composition or selection;
6. saved views can use live, fixed-membership, or revision-pinned data policies;
7. hierarchy and spatial interactions write validated fields and relationships rather than renderer state;
8. current celestial tables and future facet objects can satisfy the same display capability contracts;
9. calendars may be culturally arbitrary while malformed rules and references are caught before publication;
10. selected-object information and optional displays no longer require a permanent desktop side panel;
11. invalid embedded view data fails within the display rather than taking down its containing page;
12. cross-domain objects can appear in celestial, planetary, temporal, and wiki displays without duplication.

## Non-Goals

- replacing exact field editors with graphical manipulation;
- forcing all objects into one literal hierarchy;
- treating all spatial scales as one coordinate system or renderer;
- requiring calendars to match celestial mechanics;
- rendering procedural background stars as canonical objects;
- performing full radiative transfer or N-body simulation for the initial apparent sky;
- making every embedded map an unrestricted interactive application;
- requiring the final generic facet persistence model before implementing views;
- creating celestial-specific copies of factions, routes, settlements, events, or claims.

## Open Decisions

- the exact generic capability and facet schema interfaces;
- whether inline WikiText configuration may create an anonymous saved view or remains ephemeral;
- the default interaction permissions for locked infobox and article-body profiles;
- the visual transfer function and accessibility treatment for extreme stellar brightness ranges;
- when apparent skies should apply light-travel delay and time-varying source state;
- how cross-sector frame transforms are declared and validated;
- whether saved views receive ordinary wiki page titles, a dedicated namespace, or both;
- how static previews are regenerated when a live view's referenced data changes;
- which incomplete drafts may be previewed privately and which violations block publication.

## Review Triggers

Review this document when any of the following occurs:

- the first schema-versioned celestial view state is implemented;
- saved view persistence or WikiText map transclusion enters implementation;
- the generic object/facet model receives a concrete schema;
- apparent-sky rendering gains a second spatial frame or observer-surface mode;
- the celestial viewer panel is replaced;
- Atlas defines a conflicting or more general named-view contract.
