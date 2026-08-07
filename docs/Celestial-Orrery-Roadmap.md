# Celestial Orrery: Viewer Roadmap

**Status:** Proposed next-stage architecture  
**Last updated:** 7 August 2026  
**Related documents:** [Atlas Architecture](./Atlas-Architecture.md), [Celestial Upgrades](./Celestial-Upgrades.md), [Celestial Body Rendering](./Celestial-Body-Rendering.md), [Celestial Surface Models](./Celestial-Surface-Models.md), [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md), [Celestial Calendar Integration](./Celestial-Calendar-Integration.md)

## Decision

KnowThing should borrow Universe Sandbox's camera, visibility, lighting, time, and inspection ideas without becoming a physics sandbox.

The celestial map is an astronomical viewer backed by authoritative setting data. It should let someone move continuously from a whole-system overview to inspecting a moon while preserving the same physical coordinate system. It should not move planets into layout lanes, compress individual orbits, or enlarge the selected body's geometry to make it readable.

The two main views have different jobs:

- **Plan** is a top-down orthographic reference view. It keeps the clarity of the existing 2D map while using the same physical positions as Orrery.
- **Orrery** is an object-centric perspective view. Inclination, depth, parallax, lighting, and apparent size must read as genuinely three-dimensional.

The default Orrery representation should be **Enhanced**, where physical meshes remain physical and a separate screen-space visual layer keeps important bodies discoverable. A strict **Physical** representation and a symbolic **Markers** representation should also be available.

## Product Boundaries

Universe Sandbox is both a viewer and a simulation game. KnowThing needs the viewer, not the game.

### In scope

- Perspective, object-centric navigation
- Physical placement and physical body geometry
- Screen-space discovery markers that never alter geometry
- Star-positioned lighting and readable exposure
- Time playback over the existing deterministic orbital model
- Reference frames, trails, vectors, and scientific overlays
- Progressive surface detail and future texture-map support
- Selection, focus, following, comparison, and accessible fallback UI

### Explicitly out of scope

- General N-body integration and perturbation simulation
- Collisions, fragmentation, deformation, or accretion
- Climate, fluid, atmospheric, or habitability simulation
- Launching, editing, heating, or destroying bodies as a toy
- Replacing stored orbital elements with an emergent simulation state

Those features would change KnowThing's data model and product identity. Stored epochs, periods, and orbital elements must continue to produce deterministic positions for calendar and article integration.

## Current Baseline

The Three.js conversion has already removed several inherited schematic behaviours:

- Plan and Orrery use physical AU positions rather than the former Log, Linear, Compact, and Inner layout scales.
- Planet and ring meshes use physical relative radii.
- Overview readability is handled by a separate marker level of detail rather than by changing the physical sphere.
- Selection uses an indicator instead of making a body fatter.
- WASD and arrow-key navigation pan the view.
- Double-click focus moves from system overview toward the physical body and its rings.
- The scale legend reports real AU or kilometre distances.
- Labels are projected into a DOM overlay and can be decluttered independently of the scene.

The main remaining problem is the viewing model. Orrery and Plan still share an orthographic camera, so Orrery is spatially rotated but does not have perspective foreshortening, depth-dependent apparent size, or an object-centric sense of arrival. It can therefore feel like a tilted diagram rather than a place.

## Non-Negotiable Rendering Invariants

These rules prevent a return to the SVG, Canvas, and Pixi-era compromises:

1. **One physical coordinate system.** A body's world position is derived from its orbital data. A view mode may transform the camera or reference frame, but not the orbit's scale.
2. **One physical mesh size.** Selection, hover, importance, and focus never change a sphere or ring's world-space dimensions.
3. **Visibility is a separate layer.** Markers, glows, labels, and hit targets may use screen-space minimums. They identify the physical object; they are not the object.
4. **The selected state is an annotation.** Use a reticle, outline, bracket, or label treatment, never a swollen planet.
5. **Every enhancement is switchable.** Physical mode must reveal what the data literally produces.
6. **Tungolcraft owns astronomy.** Three.js owns cameras, scene presentation, and picking; it must not create competing orbital conventions.
7. **Missing data remains visible as provenance.** A schematic or frozen placement is labelled as such rather than disguised as a physical result.

## Orrery and Star Map Are Different Views

A realistic local-system Orrery and a realistic interstellar star map should not be forced into one camera mode.

The Orrery uses system-relative orbital elements and distances measured in AU or kilometres. An interstellar star map needs parsec-scale positions, a stated coordinate frame, right ascension/declination or Cartesian equivalents, distance uncertainty, proper motion, and apparent or absolute magnitude. It also needs much more aggressive precision and level-of-detail handling.

If KnowThing adds a star map, it should be a sibling view entered from the system boundary:

```text
Galaxy / star map
  -> select a stellar system
     -> system Orrery
        -> focus a body
           -> surface or body-detail view
```

The views may share camera controls, selection language, markers, and material assets. They should not share a single distance transform or pretend that AU-scale orbit data is enough to place stars realistically.

## Missing Viewer Capabilities

### 1. Perspective, object-centric Orrery camera

This is the highest-priority gap.

Plan should keep an `OrthographicCamera`. Orrery should receive a separate `PerspectiveCamera` and camera rig with a moderate default field of view. Switching views should match the apparent framing of the current target so the system does not jump unexpectedly.

The Orrery camera must support:

- Orbiting around the current focus target
- WASD and arrow-key translation relative to the view plane
- Mouse or modified-drag panning
- Wheel and pinch dolly toward the pointer or focus target
- Double-click focus and an explicit focus action
- Follow mode that preserves the camera's offset while the target moves
- Escape or Reset to return to the system frame
- Upper-hemisphere restriction only when useful; inspection must not feel artificially trapped
- Adaptive near and far clipping for system overview and close body inspection
- Reduced-motion transitions that become immediate

The camera target is first-class state. It is not always the system origin, and selection does not automatically have to change it.

### 2. Physical, Enhanced, and Markers visibility modes

Astronomical scale creates a real conflict: at a whole-system view, physically sized planets are usually smaller than a pixel. The solution is not to enlarge the spheres.

| Mode | Physical mesh | Screen-space aid | Intended use |
|---|---|---|---|
| Physical | Exact relative size | Labels on request | Scale inspection and screenshots |
| Enhanced | Exact relative size | Subtle marker, glow, and minimum pick target | Default exploration |
| Markers | Optional at subpixel size | Clear symbols and labels | Dense systems and accessibility |

Enhanced markers should fade out as soon as the physical mesh becomes large enough to read. The threshold should be based on projected angular size, with hysteresis so it does not flicker while zooming. Hover and selection decorate the marker or reticle, not the body mesh.

Stars may have a restrained halo for visibility, but the photosphere remains physically sized. Orbit lines and labels follow the same principle: they are reference graphics, not geometry.

### 3. Star-based lighting and exposure

The current softly lit body presentation is useful for debugging but does not communicate where bodies are in relation to their stars.

The target lighting model should:

- Place light sources at the actual positions of luminous stars
- Derive relative output from luminosity when available, with documented fallbacks
- Preserve visible day and night hemispheres
- Support multiple stars without treating one arbitrary directional light as the sun
- Use tone mapping and bounded automatic or manual exposure so stars do not wash out every body
- Keep emissive star surfaces separate from the light they cast
- Let Physical mode reduce or disable non-physical fill light

Full shadow simulation is a later quality decision. A limited shadow budget for the focused body and its immediate children would provide useful eclipses without requiring every object to cast shadows across the full system.

### 4. A real astronomical time controller

The renderer already accepts an absolute day and computes deterministic Keplerian positions. The missing part is a viewer-level time experience.

Required controls:

- Play and pause
- Reverse
- Step forward or backward by configurable units
- Logarithmic speed presets spanning hours to years per second
- Direct date/day entry
- Reset to epoch or the page's calendar date
- Clear indication when a body is frozen because timing is unavailable

Camera damping and time playback must be independent. Pausing time should not prevent a camera transition from settling, and a stationary paused scene should still stop rendering on demand.

This remains analytic playback, not an N-body simulation. Stored periods continue to override derived periods, and unavailable periods remain fixed with visible provenance.

### 5. Reference frames and meaningful trails

Orbit ellipses alone do not explain motion in binaries, moon systems, or moving frames. Universe Sandbox's useful lesson here is not decorative trails; it is the ability to change what the camera is moving relative to.

Initial reference frames:

- **System inertial:** barycentric or declared system origin
- **Selected parent:** useful for a planet and its moons
- **Focused body:** translates with the focused object while retaining inertial orientation
- **Two-body rotating:** keeps a selected pair stationary on screen when the required data is coherent

Trails must be generated and labelled in the active frame. Switching frames should rebuild or transform them explicitly rather than leaving a visually plausible but scientifically false curve behind.

The two-body rotating frame is particularly valuable for binaries and moon systems. It should be gated behind valid masses and coherent relative placement; ambiguous systems retain schematic provenance.

### 6. Scientific overlays

The viewer should be able to explain the data, not merely display attractive spheres.

Useful overlays, added progressively, include:

- Orbital plane and system reference plane
- Ascending and descending nodes
- Periapsis and apoapsis markers
- Semi-major axis and instantaneous distance measurements
- Velocity and direction vectors
- Barycentre markers and parent-child relationship lines
- Hill sphere and Roche limit when the necessary mass/radius data exists
- Habitable-zone bands when stellar luminosity supports them
- Coordinate axes, grid, and scale ruler
- Orbit and timing provenance for incomplete or schematic records

Every overlay should be individually switchable. Dense systems need presets such as Clean, Navigation, Orbits, and Science instead of one wall of checkboxes.

### 7. Surface and atmosphere presentation

This roadmap does not include texture generation, but the viewer must provide a stable destination for it.

The existing body hierarchy should remain the material boundary:

```text
orbit anchor
└─ axial-tilt group
   ├─ spin group
   │  └─ UV-ready physical sphere
   └─ equatorial rings
```

Future uploaded or generated equirectangular maps can replace a material's color, normal, roughness, emissive, cloud, or height inputs without changing orbital placement, selection, or camera logic. Color textures use sRGB; scientific data maps remain linear. Atmosphere shells, cloud layers, and terrain displacement belong to focused-body levels of detail, not the system overview.

## Proposed Architecture

### Camera rigs

Introduce a camera abstraction rather than branching camera rules throughout the renderer:

```ts
interface MapCameraRig {
  readonly camera: THREE.Camera
  readonly target: THREE.Vector3

  resize(width: number, height: number): void
  frameSystem(bounds: THREE.Box3, immediate?: boolean): void
  focus(target: FocusTarget, immediate?: boolean): void
  follow(target: FocusTarget | null): void
  update(deltaSeconds: number): boolean
  dispose(): void
}
```

- `PlanCameraRig` owns the top-down orthographic camera and pan/zoom rules.
- `OrreryCameraRig` owns the perspective camera, object pivot, dolly, and orbit rules.
- A coordinator transfers target, apparent framing, and input ownership when modes change.

Camera-relative rendering or a floating origin should be introduced when precision tests show it is needed. It is likely necessary before an interstellar star map, but should not complicate the local-system renderer pre-emptively.

### Visibility controller

A visibility controller computes projected angular radius, marker opacity, label priority, and picking radius from the active camera. It does not write to physical mesh scale.

This controller is the only place allowed to apply screen-space minimums. That makes it testable and prevents visibility hacks from leaking into body creation, selection, or orbital layout.

### Lighting controller

A lighting controller owns star lights, exposure inputs, focused-body shadow eligibility, and fallback lighting when luminosity is missing. Materials remain owned by the body-visual factory.

### Reference-frame transform

Scientific positions remain in inertial world coordinates. A reference-frame layer computes the transform used to present those positions and trajectories for the current time. It must be pure and testable independently of Three.js scene objects.

### DOM interaction layer

Labels, marker annotations, scale, time controls, selected-object data, and status remain in Svelte DOM. The renderer publishes projected coordinates and state snapshots only when materially changed. This keeps accessibility and responsive layout out of the WebGL scene.

## Delivery Plan

### Phase 1: Split Plan and Orrery camera models

Status: implemented.

Implement `PlanCameraRig` and `OrreryCameraRig`, make Orrery perspective, and preserve the current focus, follow, WASD, mouse, touch, reset, resize, and reduced-motion behaviour.

Acceptance criteria:

- A body farther from the camera has a smaller apparent physical mesh.
- Orbit inclination produces readable depth and parallax.
- Double-click arrives at a body without changing its geometry.
- Switching Plan/Orrery preserves the selected object and approximately preserves framing.
- Plan screenshot parity remains stable.
- Focused rings can be inspected without near-plane clipping.

### Phase 2: Finish the visibility model

Status: implemented. Physical keeps literal meshes and literal picking; Enhanced adds fading discoverability markers and minimum pick targets; Markers uses larger symbols and omits only subpixel meshes. Selection is reticle-only, marker fade uses hysteresis, and none of these modes writes to mesh scale or orbital layout.

Add Physical, Enhanced, and Markers modes through the visibility controller. Replace any remaining overview-size or selection-size mutation with markers and reticles.

Acceptance criteria:

- Physical mode never applies a minimum rendered sphere radius.
- Enhanced mode keeps every configured important body discoverable at system scale.
- Markers fade cleanly as physical meshes become readable.
- Selection changes annotation only.
- Picking remains usable for subpixel bodies without adding visible geometry.

### Phase 2.5: Surface composition foundation

Status: initial slice implemented. A versioned recipe now composes uploaded albedo, elevation, normal, roughness, cloud-opacity, and emissive channels with deterministic procedural or flat fallbacks. Uploaded channels always win, channel provenance is visible, and generated geology is explicitly illustrative.

Before star-derived lighting, finish media validation and texture LOD, then establish the scientific/GIS ingest contract described in [Celestial Surface Models](./Celestial-Surface-Models.md).

### Phase 3: Star lighting and exposure

Status: initial implementation complete. The map now renders space as true black and gives every rendered luminous star its own inverse-square point light at the star's resolved 3D position. Stored luminosity wins, radius plus effective temperature can derive luminosity with Stefan–Boltzmann, and an unavailable value is visibly reported as a deterministic 1 L☉ display fallback. Point-light intensity compensates for the current AU-to-world scale, so changing system framing cannot change the irradiance of an otherwise identical orbit.

Stars keep separate unlit photospheres, rings and planetary/cloud materials receive stellar light, and binary components illuminate from their independent live positions. Physical visibility has no non-physical fill and keeps a fixed reference exposure for brightness comparison. Enhanced and Markers retain a very weak exposure-compensated accessibility floor and use bounded automatic exposure when a readable non-stellar body occupies the optical centre. Exposure is driven by the view rather than selection, and the HUD reports fixed/auto policy, signed EV compensation, and the auto-exposure target. This changes the virtual camera, not stellar output. Shadow maps and eclipses remain deliberately deferred to the focused-body shadow-budget experiment.

Replace generic scene lighting with lights derived from star position and luminosity, plus a controlled fallback. Add exposure presets and focused-body shadow experiments.

Acceptance criteria:

- Moving a body around its orbit moves the terminator consistently.
- Binary stars illuminate from their separate positions.
- Missing luminosity is reported and uses a deterministic fallback.
- System overview and close inspection remain legible without manual exposure thrashing.

### Phase 4: Time and reference frames

Add the time toolbar, explicit frozen-timing state, system/parent/focus frames, and frame-correct trails. Add two-body rotating frames for coherent pairs.

Acceptance criteria:

- Playback works forward and backward across fractional days.
- Follow remains stable at every supported playback speed.
- Trails and overlays identify their active reference frame.
- Pausing a settled scene stops the render loop.
- Two-body rotating mode holds a valid pair fixed relative to the view.

### Phase 5: Scientific overlays and inspection

Add overlay presets, measurements, nodes, apsides, vectors, barycentres, and derived zones where data permits.

Acceptance criteria:

- Derived values state their units and provenance.
- Missing inputs suppress an overlay with an explanation rather than inventing a value.
- Clean mode remains visually quiet.
- Overlay state does not alter orbital or body geometry.

### Phase 6: Focused-body visual detail

Connect higher-detail materials, atmosphere/cloud shells, and uploaded or generated maps to the existing UV-ready meshes. Keep system-scale rendering cheap and on demand.

This phase supplies the integration point for the separate texture-generation project; it does not define that project's generation or upload workflow.

## Verification

### Pure tests

- Camera framing calculations for rectangular viewports
- Matched apparent framing during Plan/Orrery handoff
- Projected angular-size and marker hysteresis thresholds
- Selection never affects physical body scale
- Reference-frame transforms preserve relative distances
- Two-body rotating frames maintain the pair's screen-relative axis
- Trails are deterministic for a date range and frame
- Lighting fallbacks and luminosity conversion remain finite

### Browser tests

- Plan and Orrery at desktop-wide and mobile-tall sizes
- Perspective overview, inclined system, and focused planet/moon/rings
- WASD, arrows, mouse orbit, pan, wheel, pinch, focus, follow, and reset
- Physical, Enhanced, and Markers visibility at multiple zoom levels
- Selection at overview and body scale
- Playback forward/reverse, fractional days, and unavailable timing
- Binary lighting and two-body rotating frame
- Reduced motion, hidden-document suspension, resize, WebGL failure, and context loss

Visual tests should continue to use a deterministic celestial fixture and the same Linux/Chromium environment. Screenshot readiness must wait for camera, marker, material, and time transitions to settle.

### Performance and cleanup

- Render on demand when paused and settled
- Cap device pixel ratio
- Avoid allocating vectors, materials, or label snapshots per frame
- Dispose camera controls, scene resources, textures, observers, and event handlers
- Establish budgets for draw calls and shadow casters in overview and focused modes

## Open Product Decisions

The following decisions should be made during the relevant phase, not encoded accidentally in renderer constants:

1. **Default visibility:** Enhanced is recommended; Physical is more literal but nearly empty at system scale.
2. **Default Orrery field of view:** begin around 45–55 degrees and tune with fixture screenshots and input testing.
3. **Fill light:** decide how dark Physical mode is allowed to become on night sides.
4. **Shadows:** choose between none, focused-body only, or a small selected-system budget.
5. **Orbit visibility:** decide whether orbit paths fade automatically during close body inspection.
6. **Mode persistence:** decide whether camera and visibility mode survive navigation or reset per visit.
7. **Star-map boundary:** define the minimum coordinate and magnitude fields before presenting any interstellar view as realistic.

## Immediate Next Work

Finish Phase 2.5 surface media validation and texture LOD, then implement Phase 3 star-derived lighting and exposure. The perspective camera split and visibility controller already provide the depth and angular-size boundaries both systems need.

Do not reintroduce layout scales to compensate for an inadequate camera. Do not make bodies larger to compensate for an inadequate marker system. Fix the camera and visibility layers at their proper boundaries.

## References

- [Universe Sandbox controls](https://universesandbox.com/support/controls/) — focus, orbit, field of view, navigation, and view controls
- [The Space Goggles Do Nothing — Update 28.1](https://universesandbox.com/blog/2021/10/the-space-goggles-do-nothing-update-28-1/) — realistic and enhanced visibility modes
- [Space in a New Light — Update 35](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/) — physically informed light intensity and distance
- [Winds of Change — Update 36.2](https://universesandbox.com/blog/2026/06/winds-of-change-update-36-2/) — rotating camera behaviour for two selected bodies
- [History of Science Museum: Orrery](https://www.hsm.ox.ac.uk/orrery) — the mechanical Orrery tradition and its explanatory purpose
