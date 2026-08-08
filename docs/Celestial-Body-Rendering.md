# Celestial Body Rendering: Procedural Planet Visuals from Config

## Problem

SystemMap.svelte renders planets as colored dots. The orbital mechanics are correct
(Kepler solver, eccentricity, multi-scale layout) but the bodies themselves have no
visual identity. A gas giant and a rocky terrestrial look the same. The data to
differentiate them already exists in the schema (`composition`, `atmosphere`,
`temperatureK`, `hasRings`, `axialTilt`, `color`, and the structured surface recipe) but nothing interprets it
visually.

The goal: render each celestial body as a visually distinct, beautiful sphere —
procedurally generated from its existing database fields — so the system map reads
like Destiny's planet select, not an astronomy textbook.

## Constraints

- **Config-driven**: no hand-painted textures. Every visual property derives from
  fields users already fill in. Two planets with identical config must look identical.
  Two planets with different config must look different.
- **No new schema changes**: the existing `planetaryBodies` and `stars` tables have
  everything needed. The `composition`, `atmosphere`, `temperatureK`, `color`,
  `hasRings`, `axialTilt`, and structured surface recipe drive the renderer.
- **Integrate with SystemMap**: rendered planets replace the current `ctx.arc()` dots
  on the existing Canvas2D map. The renderer produces cached bitmaps that
  `renderMap()` stamps via `drawImage()`.
- **Performance**: rendering happens once per body (or on config change), not per
  frame. The system map must stay smooth at 60fps even with 20+ bodies.

## Architecture

```
DB fields ──> PlanetConfig ──> WebGL shader ──> OffscreenCanvas ──> ImageBitmap cache
                                                                         │
                                                      SystemMap.svelte ◄─┘
                                                      ctx.drawImage(bitmap, x, y)
```

### Pipeline

1. **Config extraction** (`planet-config.ts`): maps DB row fields to a normalized
   `PlanetRenderConfig` struct of shader-ready values.
2. **Shader rendering** (`planet-renderer.ts`): a single offscreen WebGL2 canvas
   renders one planet at a time to a framebuffer, then reads it as an `ImageBitmap`.
3. **Cache** (`planet-cache.ts`): `Map<slug, ImageBitmap>` keyed by a hash of the
   render config. Cache invalidates when config changes.
4. **Integration**: `SystemMap.svelte` calls `drawImage` in place of `arc`/`fill` for
   each body that has a cached bitmap.

## Config Mapping

### PlanetRenderConfig

```ts
interface PlanetRenderConfig {
  // Surface
  surfaceType: 'rocky' | 'gas' | 'ice' | 'molten' | 'ocean'
  surfaceColors: [string, string, string]  // primary, secondary, tertiary
  noiseScale: number                       // terrain detail frequency
  noiseSeed: number                        // deterministic from slug hash

  // Atmosphere
  atmosphereColor: string
  atmosphereThickness: number              // 0 = none, 1 = Venus-thick
  cloudDensity: number                     // 0 = clear, 1 = fully obscured

  // Lighting
  temperature: number                      // K, drives emissive glow for hot bodies

  // Geometry
  axialTilt: number                        // degrees, tilts the sphere + rings
  hasRings: boolean
  ringColor: string
  ringInnerRadius: number                  // relative to planet radius
  ringOuterRadius: number

  // Rendering
  resolution: number                       // px, 64 for map dots, 256 for detail view
}
```

### Field-to-Config Rules

**surfaceType** — derived from `composition`:

| composition contains | surfaceType |
|---|---|
| "hydrogen", "helium", "gas giant" | `gas` |
| "ice", "nitrogen ice", "methane" | `ice` |
| "iron", "silicate", "rock", "chondrite" | `rocky` |
| "lava", "magma", "molten" | `molten` |
| "ocean", "water" (+ temperature > 200K) | `ocean` |
| fallback | `rocky` |

**surfaceColors** — derived from `composition` + `temperature` + `color`:

- If `color` is set explicitly, use it as primary and derive secondary/tertiary from
  temperature shift.
- Otherwise, use surface type defaults:
  - Rocky: temperature maps through a gradient (hot = orange/brown, temperate =
    tan/green, cold = grey/white)
  - Gas: band colors from temperature (hot = red/orange bands, cold = blue/white
    bands, mid = tan/amber Jupiter-like)
  - Ice: blue-white primary, with crack color from composition (nitrogen = pale blue,
    methane = slight yellow)
  - Molten: dark rock primary, emissive orange/red secondary for lava veins
  - Ocean: deep blue primary, lighter blue secondary, white tertiary for waves/ice caps

**atmosphereColor** — derived from `atmosphere`:

| atmosphere contains | color |
|---|---|
| "N2" or "nitrogen-oxygen" or "O2" | `#4488FF` (Earth blue) |
| "CO2" | `#DDAA66` (Mars/Venus amber) |
| "CH4" or "methane" | `#88BBDD` (Uranus pale blue) |
| "SO2" or "sulfur" | `#CCBB44` (Io yellow) |
| "H2" or "hydrogen" | `#EEDDCC` (Jupiter warm white) |
| empty or "trace" or "none" | transparent (no atmosphere pass) |

**atmosphereThickness** — derived from `surfacePressure`:

- Parse numeric value from text field. Normalize: 0 atm = 0.0, 1 atm = 0.3,
  90 atm (Venus) = 0.8, 1000+ atm = 1.0. Log scale.
- Fallback: gas giants default to 0.6, rocky bodies with atmosphere text but no
  pressure to 0.15, airless bodies to 0.0.

**cloudDensity** — derived from `surfacePressure` + `atmosphere`:

- Gas giants: 0.7 base (clouds always visible)
- High pressure + atmosphere: 0.5-0.9
- Thin atmosphere: 0.0-0.1
- No atmosphere: 0.0

**noiseSeed** — deterministic hash of the body's `slug` string. Ensures the same
body always renders identically, but different bodies get unique terrain.

**temperature** — parsed from the text `temperature` field. Used for:
- Color palette selection
- Emissive glow on hot bodies (> 800K gets visible red/orange emission)
- Night side glow on tidally locked bodies

**rings** — if `hasRings` is true:
- `ringColor`: derived from composition (icy = white/blue, rocky = brown/grey).
  Default: warm grey.
- `ringInnerRadius`: 1.3 (just outside the body)
- `ringOuterRadius`: 2.4 (Saturn-like proportions)
- Ring plane tilted by `axialTilt`

## Shader Design

### Vertex Shader

Fullscreen quad. Two triangles covering clip space. Passes UV coordinates to fragment
shader.

```glsl
#version 300 es
out vec2 vUv;
void main() {
  // Triangle strip: 0,1,2 and 2,1,3
  vec2 pos = vec2(
    float((gl_VertexID & 1) << 2) - 1.0,
    float((gl_VertexID & 2) << 1) - 1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
```

### Fragment Shader: Planet Surface

Core idea: for each pixel, compute a sphere normal from the UV, then use that normal
to sample procedural noise (surface), compute lighting (diffuse + fresnel rim), and
composite atmosphere and clouds.

```glsl
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

// Config uniforms
uniform vec3 uSurfaceColor1;
uniform vec3 uSurfaceColor2;
uniform vec3 uSurfaceColor3;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereThickness;
uniform float uCloudDensity;
uniform float uAlbedo;
uniform float uTemperature;
uniform float uNoiseScale;
uniform float uNoiseSeed;
uniform int uSurfaceType;           // 0=rocky, 1=gas, 2=ice, 3=molten, 4=ocean
uniform vec3 uLightDir;

// --- Noise functions (simplex3D) inlined here ---

// Sphere from UV
vec3 sphereNormal(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) return vec3(0.0);     // outside sphere
  return vec3(p, sqrt(1.0 - d2));
}

void main() {
  vec3 N = sphereNormal(vUv);
  if (N.z == 0.0) discard;

  // Diffuse lighting
  float NdotL = max(dot(N, uLightDir), 0.0);
  float light = mix(0.02, 1.0, NdotL);    // ambient floor

  // Surface color from procedural noise
  vec3 surfacePoint = N * uNoiseScale + uNoiseSeed;
  vec3 baseColor;

  if (uSurfaceType == 0) {
    // Rocky: FBM terrain mapped through color gradient
    float terrain = fbm(surfacePoint, 5);
    baseColor = mix(uSurfaceColor1, uSurfaceColor2, smoothstep(0.3, 0.7, terrain));
    baseColor = mix(baseColor, uSurfaceColor3, smoothstep(0.75, 0.95, terrain)); // peaks
  }
  else if (uSurfaceType == 1) {
    // Gas giant: horizontal bands distorted by turbulence
    float band = sin(N.y * 12.0 + fbm(surfacePoint * 0.5, 3) * 3.0);
    baseColor = mix(uSurfaceColor1, uSurfaceColor2, band * 0.5 + 0.5);
    // Storm spots
    float spot = 1.0 - smoothstep(0.0, 0.15, length(N.xy - vec2(0.3, -0.1)));
    baseColor = mix(baseColor, uSurfaceColor3, spot * 0.6);
  }
  else if (uSurfaceType == 2) {
    // Ice: smooth base with voronoi crack network
    float cracks = voronoiCracks(surfacePoint * 4.0);
    baseColor = mix(uSurfaceColor1, uSurfaceColor2, cracks);
  }
  else if (uSurfaceType == 3) {
    // Molten: dark crust with emissive lava in cracks
    float lava = smoothstep(0.42, 0.5, fbm(surfacePoint * 3.0, 4));
    baseColor = mix(uSurfaceColor1, uSurfaceColor2, lava);
    // Lava is emissive — additive glow independent of lighting
    light = mix(light, 1.0, lava * 0.8);
  }
  else {
    // Ocean: water base with continent noise
    float land = smoothstep(0.48, 0.55, fbm(surfacePoint * 2.5, 5));
    baseColor = mix(uSurfaceColor1, uSurfaceColor2, land);
    baseColor = mix(baseColor, uSurfaceColor3, smoothstep(0.85, 0.95, N.y * N.y)); // ice caps
  }

  vec3 color = baseColor * light * uAlbedo;

  // Emissive glow for very hot bodies (lava worlds, close-in planets)
  if (uTemperature > 800.0) {
    float emission = smoothstep(800.0, 2000.0, uTemperature);
    color += vec3(1.0, 0.3, 0.05) * emission * 0.5 * (1.0 - NdotL);
  }

  // Cloud layer
  if (uCloudDensity > 0.0) {
    float clouds = fbm(N * 6.0 + uNoiseSeed * 0.7, 3);
    clouds = smoothstep(1.0 - uCloudDensity, 1.0, clouds);
    color = mix(color, vec3(1.0) * light, clouds * 0.7);
  }

  // Atmospheric rim (fresnel)
  if (uAtmosphereThickness > 0.0) {
    float fresnel = pow(1.0 - N.z, 3.0);
    float atmosphereLit = max(dot(normalize(vec3(N.xy, 0.0)), uLightDir), 0.2);
    color = mix(color, uAtmosphereColor * atmosphereLit, fresnel * uAtmosphereThickness);
  }

  fragColor = vec4(color, 1.0);
}
```

### Fragment Shader: Ring Pass

Separate draw call composited on top. Uses ray-plane intersection with the ring
plane (tilted by axialTilt), then applies concentric band pattern with gaps.

The ring pass also casts a shadow on the planet: darken planet pixels where the
ring plane intersects the light ray to the surface.

## Star Rendering

Stars use the same pipeline but a simpler shader:

- No noise-based terrain. Instead, a radial gradient from core color to limb
  darkening color (derived from `temperatureK` via Planck curve approximation).
- Subtle turbulence overlay for solar granulation.
- Intense radial glow extending beyond the sphere edge.
- Corona effect: faint spikes or halo in the alpha channel.

Config from existing fields:

| Field | Visual effect |
|---|---|
| `spectralType` | Selects base color (O=blue, B=blue-white, A=white, F=yellow-white, G=yellow, K=orange, M=red) |
| `temperatureK` | Fine-tunes color via blackbody curve |
| `color` | Override if set |
| `radiusM` | Relative glow size when multiple stars shown together |

## Cache Strategy

```ts
// planet-cache.ts

type RenderCache = Map<string, { bitmap: ImageBitmap, configHash: string }>

function configHash(config: PlanetRenderConfig): string {
  // Stable JSON of all visual-impacting fields
  return hashString(JSON.stringify(config))
}

async function getOrRender(
  slug: string,
  config: PlanetRenderConfig,
  renderer: PlanetRenderer
): Promise<ImageBitmap> {
  const hash = configHash(config)
  const cached = cache.get(slug)
  if (cached && cached.configHash === hash) return cached.bitmap

  const bitmap = renderer.render(config)
  cache.set(slug, { bitmap, configHash: hash })
  return bitmap
}
```

The cache lives for the lifetime of the SystemMap component. On body config update
(user edits a planet), the cache entry for that slug is invalidated and re-rendered
on next frame.

## Resolution Strategy

Bodies are rendered at different resolutions depending on context:

| Context | Resolution | Notes |
|---|---|---|
| System map (zoomed out) | 64px | Small dots, most common |
| System map (zoomed in) | 128px | When zoom > 2x on a body |
| Body detail panel | 256px | Sidebar/tooltip preview |
| Full page view | 512px | Dedicated body page hero |

The renderer accepts resolution as a parameter. Higher resolutions use more noise
octaves for finer surface detail. Cache stores per-resolution.

## SystemMap Integration

In `SystemMap.svelte`, the rendering changes are minimal. Replace body dot drawing:

```ts
// Before
ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
ctx.fill()

// After
const bitmap = planetCache.get(body.slug)
if (bitmap) {
  const size = radius * 2 * PLANET_RENDER_SCALE
  ctx.drawImage(bitmap, position.x - size / 2, position.y - size / 2, size, size)
} else {
  // Fallback: colored dot (loading or WebGL unavailable)
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
  ctx.fill()
}
```

The fallback ensures the map works on devices without WebGL2. The colored-dot
rendering is preserved as the baseline.

Star glows in the current code (radial gradient arcs) remain as-is, with the
procedural star bitmap drawn on top at the center point.

## File Structure

```
src/lib/celestial/
  SystemMap.svelte             # existing — add drawImage calls
  planet-config.ts             # DB fields -> PlanetRenderConfig
  planet-renderer.ts           # WebGL2 setup, shader compile, render-to-bitmap
  planet-cache.ts              # slug -> ImageBitmap cache with hash invalidation
  star-config.ts               # DB fields -> StarRenderConfig (simpler)
  shaders/
    planet.vert                # fullscreen quad vertex shader
    planet.frag                # planet surface + atmosphere + clouds
    ring.frag                  # ring overlay pass
    star.frag                  # star surface + limb darkening + glow
  colors.ts                    # existing — extend with atmosphere/composition maps
  orbit.ts                     # existing — unchanged
  map-settings.ts              # existing — unchanged
```

## Implementation Order

1. **planet-config.ts**: field-to-config mapping with composition/atmosphere parsers.
   Testable in isolation with the existing preset data (Solar System planets).
2. **Shader prototyping**: get the rocky planet shader working in a standalone test
   page. Nail the sphere normal trick, lighting, and one noise function. This is
   where most iteration happens.
3. **planet-renderer.ts**: WebGL2 boilerplate — create context, compile shaders,
   render to offscreen canvas, extract ImageBitmap.
4. **planet-cache.ts**: hash-based cache with resolution tiers.
5. **SystemMap integration**: swap dot drawing for cached bitmaps, add fallback.
6. **Gas giant shader variant**: horizontal bands, storm spots, turbulence.
7. **Ice + molten + ocean variants**: extend the fragment shader branching.
8. **Ring pass**: separate shader for ring rendering with shadow casting.
9. **Star rendering**: limb darkening, granulation, glow.
10. **Detail view**: higher-resolution renders for body pages and tooltips.

## Risks

- **Shader compatibility**: WebGL2 is well-supported but mobile GPUs may have
  precision issues with complex noise functions. Test on low-end devices early.
  The colored-dot fallback handles graceful degradation.
- **Noise quality**: cheap simplex noise at 64px can look muddy. May need to
  tune octave counts and contrast per resolution tier.
- **Gas giant bands**: getting convincing Jupiter-like banding requires careful
  tuning of the horizontal frequency and turbulence distortion. This will be
  the most iteration-heavy surface type.
- **Composition parsing**: the `composition` field is free text. The parser needs
  to handle varied phrasings ("iron, silicates" vs "Silicate rock with iron core"
  vs "rocky"). Keyword matching with fallbacks is more robust than exact matching.
- **Ring shadow on planet**: requires a second pass or multi-pass compositing.
  Can be deferred without losing much visual impact.

## What This Does NOT Cover

- **3D rotation / animation of the planet sphere**: the rendered bitmap is a static
  snapshot from one viewing angle. Rotation would require re-rendering per frame,
  which defeats the cache. If rotation is needed later, the shader pipeline supports
  it — just add a rotation uniform and render in the animation loop instead of
  caching.
- **Terrain heightmaps / bump mapping**: the noise is purely color-based, no
  parallax or relief. At 64-256px this wouldn't be visible anyway.
- **Physically accurate atmospheric scattering**: the fresnel rim is a visual
  approximation. True Rayleigh/Mie scattering is expensive and overkill for this
  use case.
- **User-uploadable textures**: this system is procedural-only. Supporting uploaded
  planet textures (painted maps) is a separate feature that could bypass the shader
  entirely and feed images directly into the cache.
