# AstroSynthesis 3 Ring-System Distillation

**Status:** Research evidence for a future Rodder ring-system contract  
**Reviewed:** 20 August 2026  
**Applies to:** ring authoring, orbital hierarchy, Orrery rendering, and generated celestial presets  
**Related documents:** [Celestial Orrery Roadmap](../plans/celestial/Celestial-Orrery-Roadmap.md), [Celestial Sector and System Model](../architecture/celestial/Celestial-Sector-and-System-Model.md), [Celestial Surface Models](../architecture/celestial/Celestial-Surface-Models.md)

> **Maturity:** This is a source distillation, not an adopted schema. It records what AstroSynthesis 3 actually models and displays, identifies the useful product ideas, and compares them with the current Rodder implementation. Review it when ring persistence or authoring enters implementation. **Expires on contact with implementation.**

## Evidence

The primary evidence is the manual and application data bundled with the official [AstroSynthesis 3 trial](https://nbos.com/nox/item/400), together with NBOS's [system-generator description](https://www.nbos.com/products/astrosynthesis/system-generator) and [orbital-view screenshots](https://www.nbos.com/products/astrosynthesis/screen-shots).

The trial was inspected without launching the application or beginning its time-limited licence period. Its CHM manual, default SQLite schema, stock ring model, and public screenshots agree on the main structure described below. The generator's exact ring-formation formulas and renderer source are not published, so this document does not infer them.

## What AstroSynthesis Models

### A ring is a child object

AstroSynthesis places a Ring beneath a planet in the same parent-relative hierarchy used for moons and other system bodies. An author adds a ring by selecting its parent in the System Data tree and adding a child body of type Ring. Several rings may therefore be siblings beneath one planet.

Deleting the parent deletes its ring children along with its other descendants. A ring also retains ordinary object identity and descriptive fields rather than existing only as a rendering flag.

### Distance means inner edge; width means radial extent

The Ring/Asteroid Belt editor defines two spatial quantities:

- **Distance:** the innermost distance from the parent;
- **Width:** how far the band extends outward, in kilometres.

The outer edge is consequently `distance + width`. This is a particularly useful contract because it describes an annular extent instead of pretending that a distributed ring is a point orbit.

The shared Orbital Properties tab also exposes eccentricity, inclination, ascending node, periapsis angle, epoch offset, and retrograde state for orbiting records. The bundled database stores those fields on every body row. The manual does not explain which of them the orbital renderer honours for a Ring, so their ring-specific behavior should not be copied without further evidence.

### Generation is physically motivated but opaque

The generator may add rings to terrestrial planets and gas giants. NBOS also says it examines low-density moons and may replace a moon with a ring when the parent body's tidal forces would disrupt it.

That is a useful authoring explanation, but not a reproducible scientific model: the manual does not publish the Roche-limit calculation, material assumptions, probability distribution, band-count rules, or generated radial extents. KnowThing must not label an equivalent generator as derived science unless those inputs and formulas are explicit.

## What AstroSynthesis Displays

### Orbital view: annular extent

In the planet-and-moons screenshot, rings appear as flat, semi-transparent annular bands centred on the planet. The display contains several bands at different radii and shares the view with moons and labels, so it communicates both radial extent and hierarchy. Because one Ring record supplies one inner distance and width and several Ring children are permitted, object composition is sufficient to create stripes and gaps. The published material does not establish whether AstroSynthesis also adds decorative subdivision inside an individual band.

The useful effect does not require a detailed particle simulation. KnowThing can reproduce it by composing simple annuli whose inner distances and widths differ.

### Object preview: representative debris

The bundled default Ring model is a sparse collection of icy/rocky chunks with a stock texture. That model is used as an object-scale representation; it is not the same geometry as the annular extent shown in the orbital display.

This is a good multiscale distinction:

- the orbital representation answers **where does the ring extend?**;
- the preview representation answers **what kind of material is it?**

KnowThing should preserve that separation without reusing AstroSynthesis's stock illustrative debris as evidence.

## Useful Ideas to Carry Forward

1. **Rings are topology, not decoration.** A ring belongs to a parent and participates in its hierarchy.
2. **Extent is authored data.** Inner and outer boundaries determine geometry; `has rings` is only a summary.
3. **Several bands compose a system.** Gaps need not be painted into one arbitrary translucent washer.
4. **Representations change with scale.** An Orrery annulus, a focused radial profile, and individual debris are different levels of detail over the same system.
5. **Generation should explain origin.** Tidal disruption is meaningful provenance only when the calculation and assumptions are retained.
6. **Ring identity can be useful.** Named rings, evidence, composition, observations, and links should not be trapped inside a planet's appearance settings.

## What KnowThing Should Not Copy

- Do not overload a generic point-orbit `distance` field to mean an inner boundary without naming that semantic difference.
- Do not use a planet-wide boolean as the authoritative ring model.
- Do not infer canonical dimensions, composition, or optical depth from a generated preview.
- Do not assume every band needs independent eccentric orbital elements merely because a permissive body table supplies them.
- Do not present a stock debris model or procedural banding as observed or authored structure.
- Do not merge asteroid belts and planetary rings at the persistence boundary merely because their editor controls are similar.

## Current Rodder Gap

Rodder previously had two incomplete representations:

- a legacy ring boolean created one fixed annulus from `1.3 ×` to `1.9 ×` the body's radius, with a colour derived from the planet and constant opacity;
- `bodyType: 'ring_system'` is constrained to have a body parent, but it has no ring-specific extent contract and the generic body renderer would treat it as a sphere.

These overlap without establishing one source of truth. The boolean produces attractive geometry but cannot represent ring dimensions, bands, gaps, names, origin, or provenance. The child type supplies identity and hierarchy but not a valid visual or physical model.

## Proposed Rodder Contract

The AstroSynthesis lesson should be strengthened into a ring system with one or more bands:

```text
planet or other parent body
└─ ring system
   ├─ band: inner radius, outer radius, appearance and provenance
   ├─ gap: implied by adjacent band boundaries
   └─ band: inner radius, outer radius, appearance and provenance
```

The ring-system record should own:

- stable identity, name, parent body, description, and provenance;
- a plane policy, initially `parent-equatorial` with explicit alternatives only when authored;
- zero or more ordered bands;
- an optional origin classification such as captured debris, impact ejecta, tidal disruption, artificial, unknown, or illustrative;
- summary fields derived from its bands rather than independently stored.

Each band should minimally carry:

- inner radius and outer radius in metres from the parent's centre;
- optional name;
- optional colour or neutral appearance input;
- optional opacity or optical-depth description with its interpretation stated;
- optional composition and evidence references;
- provenance distinguishing authored, imported, derived, illustrative, and unavailable values.

The initial contract should use inner and outer radii directly. Width is derived as `outer - inner`, avoiding AstroSynthesis's special meaning for the otherwise generic word `distance`.

The legacy ring boolean and its data are removed. Boolean-only records do not receive inferred dimensions or fallback geometry; a ring appears only when a valid ring-system child supplies bands.

## Rendering Direction

The Orrery should render ring bands as part of the parent's physical visual hierarchy:

- bands use their authored inner and outer radii;
- the default plane follows the parent's equator and axial orientation;
- ring material receives stellar light and is not emissive;
- opaque planets occlude the far side through the depth buffer;
- overview visibility is governed by the ring system's physical projected extent, without enlarging it;
- selection and labels identify the ring system without turning each narrow band into a permanent marker;
- focused detail may later replace smooth annuli with radial-opacity textures or particle-level representations.

A first implementation does not need particle simulation. Several physically sized annular geometries are sufficient to capture AstroSynthesis's strongest visual idea while allowing a later radial profile to improve detail.

## Recommended Delivery Slice

1. Define and validate the ring-system and band payload, including `parent-equatorial` orientation and inner/outer radius invariants.
2. Remove the legacy ring boolean and prevent ring-system records from reaching the sphere renderer.
3. Add ordinary field authoring for bands.
4. Render multiple physical bands with per-band material inputs and correct parent occlusion.
5. Add a deterministic fixture containing a broad band, a narrow band, and a gap; verify Plan, Orrery, focus, selection, and all visibility modes.
6. Only then consider generated band profiles, Roche-limit suggestions, shadows, debris models, or focused particle detail.

## Open Decisions

- whether bands are child records with their own stable identities or schema-versioned members of one ring-system facet;
- whether non-equatorial natural rings are supported initially or deferred until precession and stability semantics exist;
- whether optical depth is stored as a scientific value, a presentation opacity, or two explicitly separate fields;
- legacy ring presets are discarded rather than migrated into invented canonical radii;
- whether artificial orbital rings share this model or require a separate megastructure capability;
- when a named gap deserves identity rather than remaining the absence between two bands.

## Review Trigger

Review this distillation when the first ring schema migration, ring authoring form, or multi-band Orrery renderer enters implementation.
