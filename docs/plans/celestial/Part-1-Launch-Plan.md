# Celestial Part 1 Launch Plan

**Status:** Proposed launch plan for the personal KnowThing instance  
**Prepared:** 9 August 2026  
**Decision updated:** 18 August 2026  
**Branch:** `3D-system-maps-and-worldwright`  
**Audience:** Maintainer and first author  
**Related documents:** [Celestial Sector and System Model](../../architecture/celestial/Celestial-Sector-and-System-Model.md), [Celestial Orrery Roadmap](./Celestial-Orrery-Roadmap.md), [Atlas Architecture](../../architecture/Atlas-Architecture.md)

## Meaning of “Launch”

Part 1 is not a KnowThing product launch. It is the point at which this branch is safe and useful enough to merge into the maintainer's personal instance so that real canon can be authored with it.

Future KnowThing product concerns—including tenancy, selectable modules, public access, and a database redesign—do not gate Part 1. The current database is treated as temporary infrastructure. Part 1 must avoid creating additional import schemas or new persistence commitments merely to anticipate that future redesign.

The release is successful when creating a star system produces an immediate, enjoyable feedback loop:

1. enter an authored fact;
2. see its physical and orbital consequences;
3. see the system and its bodies change in the 3D Orrery;
4. keep the authored fact, the derived result, and illustrative appearance visibly distinct;
5. continue building canon without leaving KnowThing for routine arithmetic or visualization.

## Decisions

### Existing forms are the Part 1 input format

Part 1 will not introduce a custom CSV format, environment package, or parallel body schema. The celestial editor and API remain the only canonical authoring interface for this release.

Scientific formats such as PDS4, CF-NetCDF, GeoTIFF, GeoPackage, SPICE, and RO-Crate remain future ingest inputs. When implemented, their original files will be retained and projected into the application rather than translated into a second hand-authored body schema.

### Cesium is deferred

Cesium is not part of Part 1. A read-only globe without user-authored geography, layers, or a Google-Maps-like workflow does not yet create enough value to justify its bundle, asset-hosting, adapter, and lifecycle costs.

The existing viewer spike and ADR remain evidence for the future focused surface viewer. Cesium should return when Atlas can support at least one authored or imported surface layer, selection, and a useful `Explore surface` workflow.

### Desktop authoring is the practical target

Part 1 is desktop-first. Existing responsive behaviour should not be deliberately broken, and the current mobile Orrery smoke coverage should remain, but a comprehensive device matrix is not a launch gate for a personal instance.

### No deadline-driven scope inflation

There is no fixed launch date. This does not make the scope open-ended. Work that does not strengthen the author → consequence → visualization loop is deferred.

## Part 1 Product Boundary

Part 1 covers:

- authoring a new system without relying on the Solar System preset;
- authoring single and hierarchical multiple stars;
- authoring planets, moons, asteroids, and the current ring representation;
- physically meaningful orbital placement and animation;
- immediate derived consequences and validation;
- procedural or uploaded overview appearance;
- an enjoyable Plan and Orrery experience;
- enough documentation to understand inputs, consequences, fallbacks, and limitations;
- preserving system coordinates so a later stellar-neighbourhood view can use real canon.

Part 1 does not cover:

- a general scientific ingest system;
- a second interchange schema for celestial bodies;
- Atlas, Cesium, terrain, cartography, or surface feature editing;
- tectonic, climate, biome, erosion, or geology simulation;
- N-body integration;
- system synthesis or automatic invention of planets;
- a universal habitability score;
- production tenancy, module packaging, database replacement, or public launch concerns.

## Minimum Authored Data

The application must permit progressive authoring. Only identity and parentage are structurally required; other facts unlock consequences.

### System

Required:

- name and stable slug.

Optional:

- distance;
- a broad, possibly approximate galactic context;
- neighbourhood X/Y/Z coordinates only when attached to an explicit declared sector frame; a home-centred origin is supported but not mandatory;
- formation age;
- designations and prose.

### Star

Required:

- name and parent system.

Useful consequence inputs:

- mass;
- radius;
- effective temperature;
- luminosity;
- spectral type;
- age and metallicity;
- orbital elements for stellar multiples.

Missing stellar luminosity may use the existing visibly declared display fallback. A fallback must never be persisted or presented as authored fact.

### Planetary body

Required:

- name;
- parent star, system barycentre, or body.

Useful consequence inputs:

- broad body/surface class;
- mass and radius;
- semi-major axis;
- eccentricity and orbit orientation;
- epoch phase or an explicitly overridden period;
- rotation period and axial tilt;
- representative temperature, composition, and atmosphere prose;
- authored visual coverage targets;
- optional appearance, elevation, normal, roughness, and emissive assets.

No environment restructuring is required before merge. Current ambiguous fields must be documented honestly rather than expanded into a premature replacement model.

## The Authoring Feedback Loop

Part 1 must make consequences more prominent than raw configuration.

### Consequences already implemented

The current code can derive or screen:

- density;
- surface gravity;
- escape velocity;
- luminosity from radius and effective temperature;
- simple stellar habitable-zone bounds;
- Keplerian orbital period;
- periapsis and apoapsis;
- mean orbital speed;
- Hill radius and satellite stability;
- rotational breakup;
- orbit crossing and implausible physical ranges;
- deterministic position at an absolute fractional day;
- procedural body appearance, including host-star influence on vegetation pigment;
- stellar irradiance for the renderer and its resulting lighting/exposure.

These results are not sufficient merely because they exist in a library or hidden computed tab. The launch journey must expose the relevant result next to the input that changed it, with units and a short explanation.

### Part 1 consequence work

Before launch, verify and improve the following author-facing loop:

1. Editing star mass, radius, temperature, or luminosity updates luminosity, habitable-zone context, stellar appearance, and system lighting without a page reload.
2. Editing body mass or radius updates density, gravity, escape velocity, scale, and warnings without a page reload.
3. Editing semi-major axis or eccentricity updates period, periapsis, apoapsis, mean speed, Orrery placement, and orbit-crossing context without a page reload.
4. Editing rotation or axial tilt updates rotation consequences and visual orientation where supported.
5. Editing a moon's orbit shows Hill/stability feedback relative to its parent.
6. Editing surface class, seed, coverage, or channel bindings updates the preview and overview material.
7. Every unavailable result says which input is missing.
8. Every illustrative result is labelled illustrative; every derived result identifies its model or assumption at an appropriate level of detail.

### Small, high-value consequence additions

The Tungolcraft model catalogue already contains models that are not fully integrated into the ordinary body-authoring journey. Part 1 should evaluate wiring these into an explicitly derived “Consequences” presentation rather than adding new canonical fields:

- stellar irradiance at the body's orbit;
- equilibrium-temperature screening with assumptions shown and no result silently written to `temperatureK`;
- conservative Kopparapu habitable-zone context;
- rocky mass-radius screening where the author supplies an applicable composition assumption;
- constant-Q tidal/eccentricity-damping screening where the necessary assumptions are supplied.

These additions are launch candidates, not permission to build a general model-running platform. A result may be omitted when its assumptions cannot be communicated simply and honestly.

## Worldbuilding Pasta Coverage

The [Worldbuilding Pasta “An Apple Pie From Scratch” sequence](https://worldbuildingpasta.blogspot.com/p/blog-page.html?m=1) is used as an external workflow audit, not as a specification to copy. Part 1 aims to make Parts II–IV useful; later physical-world modules establish future direction.

| Guide step | Current KnowThing position | Part 1 disposition |
|---|---|---|
| Part I: Time and Place | System distance and bare X/Y/Z fields exist. Calendars exist elsewhere. There is no declared sector frame or stellar-neighbourhood view. | Adopt the sector/root-system model, define the current coordinate frame before collecting canon coordinates, and keep broad galactic context separate. A neighbourhood UI remains post-Part-1 unless it directly improves the first canon workflow. |
| Part II: Stars | Strong basic star authoring, physical derivations, luminosity, simple habitable zone, stellar procedural appearance, hierarchical multiple stars, and animated stellar orbits. | Core Part 1 scope. Improve the consequence presentation and document unsupported stellar evolution/special classes. |
| Part III: Orbits | Full bound elliptical elements, deterministic Keplerian playback, hierarchy, Plan/Orrery views, and several stability checks exist. | Core Part 1 scope. Reference frames, trails, Lagrange points, resonances, and N-body behaviour remain later work. |
| Part IVa: Planet and Moon Formation/Orbits | Planets and moons can be authored and validated. Hill, Roche, satellite stability, tidal, and orbit-crossing models exist at varying levels of UI integration. There is no formation model, co-orbital system, or first-class planetary barycentre. | Support deliberate authoring and consequences; do not synthesize formation histories. Expose useful existing checks. |
| Part IVb: Size and Surfaces | Mass/radius consequences and a strong illustrative/uploaded overview surface pipeline exist. Temperature and atmosphere remain broad authored fields. | Core visual Part 1 scope. Add no new environment schema; document the boundary. |
| Part IVc: Habitability | Simple and conservative habitable-zone models exist, but there is no planetary environment evaluation. | Show qualified orbital/irradiance context only. Do not claim whole-planet habitability. |
| Part V: Tectonics | No canonical tectonic-history tooling. Procedural terrain is explicitly not tectonics. | Deferred to Atlas and external-tool ingest. |
| Part VI: Climate | Representative procedural clouds, snow, and coverage targets exist; no climate model or climate data workflow exists. | Deferred. Preserve the illustrative labels. |
| Part VII: Geology and Landforms | Elevation can be uploaded and illustrative terrain generated; there is no geological model or focused terrain authoring. | Deferred to Atlas and scientific/GIS ingest. |

## Stellar Neighbourhood Decision

A stellar neighbourhood is a legitimate early worldbuilding object. Artifexian's published setting, for example, places the home system within a 12-light-year neighbourhood of 25 systems and uses that context to establish nearby stars and story-relevant destinations.

KnowThing will follow the sector and root-system approach documented in [Celestial Sector and System Model](../../architecture/celestial/Celestial-Sector-and-System-Model.md). A bounded sector supplies a local Cartesian frame with an origin at `(0,0,0)`. The origin may be an explicitly designated home system or an arbitrary frame centre; AstroSynthesis itself leaves that convention to the dataset. Broad galactic context and precise local navigation remain separate concerns.

KnowThing must therefore distinguish:

- **Galactic context:** a possibly incomplete description such as galaxy, region or arm, approximate galactocentric radius, and height from the galactic plane.
- **Celestial sector frame:** a bounded local Cartesian space measured in light-years or parsecs, with declared origin semantics, axes, handedness, and optional parent frame.
- **Root object:** an independently positioned sector object. It may be a stellar system, unbound world, compact object, station, phenomenon, fleet, or marker.
- **Orbital hierarchy:** children positioned relative to a root or another child through orbital state rather than sector XYZ.

The current `galacticX/Y/Z` fields are not a sufficient contract because they do not declare their origin, axes, frame, handedness, or epoch. They should be treated as legacy local coordinates until their reference frame is explicit. If the author chooses a home-centred sector, KnowThing should place the origin system at `(0,0,0)` automatically.

The minimum Part 1 data-semantics decision is:

1. Adopt and document the sector/root-system convention.
2. Stop describing bare `galacticX/Y/Z` values as self-explanatory galactic positions.
3. Do not collect substantial canon coordinates until their frame identity and origin semantics can be preserved.
4. Permit broad galactic placement to remain approximate and independently editable.
5. Preserve the distinction between sector-root XYZ and parent-relative orbital state.

No procedural neighbourhood generator is required. Systems may be placed incrementally using a relative vector, distance and direction, direct advanced XYZ entry, or a future real-star catalogue import.

### Sector-to-Orrery viewer decision

AstroSynthesis uses an integrated application with distinct sector and orbital rendering modes. KnowThing will adopt that boundary. Sector roots use light-year or parsec coordinates; Orrery children use AU or kilometre-scale parent-relative orbital state. The views share identity, selection, application time, controls, browser history, and return-camera state, but they do not need one numerical coordinate space, scene graph, or persistent WebGL canvas.

A visually matched transition is desirable, not a launch requirement. A later neighbourhood slice must prove:

1. sector overview to selected-system entry and return preserves context;
2. local orbital distances and sector distances remain independently correct and clearly labelled;
3. selection, labels, markers, keyboard access, time state, and browser history survive the transition;
4. unloaded systems remain cheap and detailed body textures are requested only for the active system;
5. renderer disposal and memory remain acceptable in both modes.

Part 1 does not require the neighbourhood UI because only one system is needed to begin canon and no canon neighbourhood dataset exists yet. It must preserve the coordinate and identity contracts needed by the later sector view. Do not add placeholder systems or procedural generation merely to justify that view.

## Documentation Deliverables

Part 1 requires practical documentation, not another speculative architecture expansion.

### New: Orrery author guide

Create a concise guide covering:

- creating a system from scratch;
- adding single or multiple stars;
- adding planets and moons;
- the minimum useful data for each;
- Plan and Orrery controls;
- Physical, Enhanced, and Markers visibility;
- time controls;
- focus, follow, selection, and reset;
- surface preview and channel uploads;
- worked example: author a small star–planet–moon system and observe consequences;
- current limitations and recovery from unavailable rendering.

### New: Celestial data semantics guide

Document:

- authored versus derived versus overridden versus illustrative values;
- required and optional fields;
- units and epoch semantics;
- parent relationships, stellar multiples, circumbinary bodies, and moons;
- fallback behaviour;
- the meaning and limitations of `temperatureK`, composition, atmosphere, coverage, and surface classes;
- why generated terrain, clouds, vegetation, and snow are not canonical geography or climate;
- which future data belongs to scientific ingest or Atlas.

### Reconcile existing documents

Completed documentation reconciliation:

- [x] Archive the obsolete pre-Three.js `Celestial-Body-Rendering.md`.
- [x] Remove the stale claim that generated normal derivation is future work.
- [x] Rename the stale Surface Recipe Version 4 migration heading to match the implemented version.
- [x] Ensure the Orrery roadmap distinguishes implemented work from post-Part-1 work.
- [x] Ensure Atlas and the ADR record Cesium as selected future evidence but explicitly deferred from Part 1.

## Verification and Merge Gates

### Required journey

Starting from an instance with no authored celestial records, an author can:

1. create a system without using a preset;
2. add a star and enough data to obtain visible physical consequences;
3. add a planet and see it placed and lit in the Orrery;
4. add a moon and receive useful orbital/stability feedback;
5. edit values and see consequences and visuals update predictably;
6. choose procedural appearance or attach available surface media;
7. leave and return without losing authored or pinned data;
8. understand every fallback or unavailable result from the interface and guides.

### Automated gates

- database migrations apply to a representative pre-branch database and preserve celestial records;
- unit and integration tests pass;
- Svelte check passes;
- production build passes;
- deterministic Orrery and surface-preview browser tests pass in their supported environment;
- media rename/delete protection and broken-binding reporting pass;
- the main desktop authoring journey receives an end-to-end test;
- existing mobile smoke coverage remains green;
- renderer, workers, textures, observers, and event handlers are disposed during navigation.

### Manual gates

- complete the required journey with a deliberately new fictional system rather than only the Solar System preset;
- spend at least one uninterrupted authoring session using the system as a worldbuilding tool;
- record moments where an input's consequence is missing, hidden, misleading, or not joyful;
- fix launch-blocking problems and move broader ideas into post-launch notes;
- confirm the documentation matches the interface actually being merged.

## Delivery Sequence

### Phase 0: Freeze scope and reconcile truth

- Adopt this launch boundary.
- Make no new environment or interchange schema.
- Confirm Cesium is deferred.
- Adopt the celestial sector/root-system model and define the legacy status of bare `galacticX/Y/Z` values.
- Keep the sector UI and sector-to-Orrery transition post-Part-1 unless real authoring demonstrates that they block creation of the first canon system.
- Correct stale status statements in existing documentation.

### Phase 1: Audit the from-scratch authoring journey

- Create a system, star, planet, and moon without presets.
- Repair blocking CRUD, navigation, validation, or persistence defects.
- Confirm existing schema migrations preserve old records.

### Phase 2: Make consequences immediate

- Inventory every consequence currently computed in forms, detail pages, Tungolcraft, and the renderer.
- Surface high-value results beside the authoring flow.
- Explain missing inputs, assumptions, overrides, and fallbacks.
- Integrate only the small additional Tungolcraft models that improve the ordinary workflow without expanding persistence scope.

### Phase 3: Polish the joy loop

- Verify Plan/Orrery switching, focus, follow, visibility, lighting, time playback, procedural surfaces, uploaded channels, and editor previews.
- Remove friction found during a real fictional-system authoring session.
- Preserve responsive and reduced-motion behaviour already covered by the branch.

### Phase 4: Write the user-facing guides

- Write the Orrery author guide around the tested fictional system.
- Write the celestial data semantics guide from the actual implementation.
- Link both from the celestial hub or another discoverable documentation entry point where appropriate.

### Phase 5: Verify, merge, and use

- Run the automated and manual gates.
- Merge into the personal instance.
- Begin authoring canon immediately.
- Let real use determine the next slice.

## Post-Part-1 Candidate Order

This order is intentionally evidence-driven:

1. **Implement the first celestial sector**, using the adopted root-system contract and a state-preserving transition into the Orrery.
2. **Time and reference frames**, if Orrery playback limits impede system reasoning.
3. **Structured environment observations**, when actual authored environmental data demonstrates the current strings are inadequate.
4. **Atlas and Cesium**, when there is authored geography or imported surface data worth exploring.
5. **Tectonics, climate, and geology tool integrations**, guided by the later Worldbuilding Pasta steps and external formats rather than in-app reinvention.

## Launch Test World

The Solar System preset remains a regression fixture, but it must not be the only launch proof. Part 1 should create a small fictional test system containing:

- one authored main-sequence star;
- one warm terrestrial planet;
- one moon near enough to exercise satellite stability feedback;
- one outer giant or icy body;
- at least one non-circular and inclined orbit;
- one procedural surface with explicit coverage targets;
- one uploaded surface channel if convenient;
- at least one deliberately missing value to verify unavailable/fallback explanations.

This test world is disposable. The first real post-merge activity is creating the author's canon system, not polishing the fixture into substitute lore.

## Launch Definition

Part 1 is ready to merge when the maintainer can honestly say:

> I can create a star system from scratch, understand the practical consequences of the values I choose, and enjoy watching those choices become a coherent moving Orrery. The system tells me what it derived, what it merely illustrated, and what it still cannot know.
