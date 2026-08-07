# Celestial Surface Models

**Related documents:** [Atlas Architecture](./Atlas-Architecture.md), [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md)

## Product Boundary

KnowThing renders the best planet model supported by the user's data. It is not a fantasy map generator and does not claim that seeded noise is tectonics, climate, or geography.

The surface system is progressive:

1. With no surface data, the map can show a deterministic illustrative texture derived from the body's broad class and explicit surface settings.
2. A user may disable procedural fallback and keep a flat material.
3. Each uploaded material channel independently replaces its fallback. Supplying one map never creates an obligation to supply the other maps.
4. Complete researched data can replace every generated channel without being altered by the generator.

Every texture choice retains provenance as `uploaded`, `procedural`, `constant`, or `unavailable`. Procedural output is described in the UI as illustrative.

## Current Recipe

The versioned recipe lives in `celestial_bodies.extra.surface`, so the first implementation needs no database migration:

```json
{
  "version": 1,
  "fallback": "procedural",
  "class": "terrestrial",
  "seed": 436,
  "hydrosphereFraction": 0.55,
  "cloudCoverage": 0.48,
  "maps": {
    "albedo": "Saxnat albedo.png",
    "elevation": "Saxnat elevation.png",
    "normal": "Saxnat normal.png",
    "roughness": "Saxnat roughness.png",
    "clouds": "Saxnat clouds.png",
    "emissive": "Saxnat night.png"
  }
}
```

All fields are optional in the editor. `fallback: "flat"` is the explicit opt-out. `class: "auto"` uses conservative body-type/composition clues only for missing procedural channels. It does not modify uploads.

## Texture Channels and Upload Handoff

The current runtime expects ordinary images stored in KnowThing Media. A 2:1 equirectangular plate is the interchange projection for the overview sphere.

| Channel | Meaning | Recommended handoff | Runtime treatment |
|---|---|---|---|
| Albedo | Intrinsic base color, without baked sunlight or labels | PNG, JPEG, or WebP; 2:1; sRGB | `material.map`, sRGB |
| Elevation | Relative or measured surface height | Grayscale PNG; 2:1; document units and vertical datum | Subtle bump in overview; reserved for close-view displacement |
| Normal | Authored tangent-space surface normals | PNG; 2:1; document OpenGL/DirectX Y convention | `normalMap`, non-color; supersedes elevation bump |
| Roughness | Microsurface roughness | Grayscale PNG; 2:1 | `roughnessMap`, non-color (Three samples green) |
| Clouds | Cloud opacity, separate from the ground | Grayscale PNG; 2:1 | `alphaMap` on an independent cloud shell, non-color |
| Emissive | Actually luminous features such as lava or city lights | PNG, JPEG, or WebP; 2:1; sRGB | `emissiveMap`, sRGB |

Color and data textures are deliberately separated. Three.js requires color textures such as albedo/emissive to declare sRGB, while normal, roughness, displacement, and opacity maps remain non-color data. See [Three.js color management](https://threejs.org/manual/en/color-management.html) and [MeshStandardMaterial map semantics](https://threejs.org/docs/pages/MeshStandardMaterial.html).

An uploaded normal map is considered more authoritative than generated or uploaded height used as bump. The original uploaded files are never rewritten by procedural generation.

## What the Worldwright Prototype Contributed

The prototype contributed four sound implementation ideas:

- deterministic seeded generation;
- three-dimensional noise sampled on a sphere, avoiding a longitude seam;
- class-specific visual fallbacks for rocky, terrestrial, gas, and ice bodies;
- clouds as a separate layer.

The adaptation intentionally removed or constrained claims that the prototype could not justify:

- gravity no longer fabricates mountain amplitude;
- temperature does not fabricate biomes or life;
- atmosphere text does not automatically fabricate clouds;
- random craters, volcanoes, and tectonics are not treated as canonical data;
- height shading is not baked into albedo, because lighting belongs to the material and scene;
- generated relief, roughness, clouds, and color remain independent channels.

The overview fallback is currently generated at 256 x 128. That is enough for system-map inspection without making every system-map body carry a large texture. Uploaded maps currently keep their own resolution. A later focused-body renderer should select validated higher-resolution tiles or generated LODs.

## Scientific and GIS Data

Yes, tectonic and planetary-science datasets exist, but there is no single “tectonic texture” format.

Common source families include:

- GeoTIFF or Cloud-Optimized GeoTIFF for georeferenced rasters such as elevation, crustal age, heat flow, or classified surface units;
- NetCDF and HDF5 for multidimensional climate, atmospheric, ocean, and time-series grids;
- GeoJSON, Shapefile, GeoPackage, or GPlates GPML for plate boundaries, faults, coastlines, and reconstruction polygons;
- PDS products for NASA planetary missions, often with detached labels, instrument-specific calibration, map projections, and non-display sample formats.

Those formats should be handed to a future ingest pipeline, not directly to Three.js. Ingest must retain:

- source and citation;
- coordinate reference system and longitude convention;
- projection and seam placement;
- units, scale, offset, and no-data value;
- vertical datum or reference ellipsoid for elevation;
- epoch/time slice for changing tectonic or atmospheric data;
- resampling method and the exact derived runtime assets.

The ingest output may be equirectangular runtime textures, tiled textures, or a vector overlay. The original scientific file must remain the authority. Converting a plate-boundary vector dataset into an albedo line drawing would be a visualization product, not a replacement for the source.

## When the UI Should Say “Upload Your Own Data”

Ask for user data when the information is intended to be canonical rather than decorative:

- named continents, coastlines, basins, and settlements;
- plate boundaries, faults, crustal age, and tectonic reconstruction;
- measured or authored elevation/bathymetry;
- climate zones, seasonal clouds, storms, ice cover, or vegetation;
- city lights, lava, aurorae, or other emissive phenomena;
- exact gas bands, storms, impact sites, or geological units.

Do not block a user who lacks those assets. Leave the channel procedural, flat, or unavailable and say which one it is.

## Next Surface Work

The complete provenance, ingest, publishing, and migration design is maintained in [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md).

Before detailed body navigation, the next useful additions are:

1. Validate media existence, MIME type, aspect ratio, and channel-specific metadata in the celestial editor.
2. Add a proper GeoTIFF/NetCDF/PDS ingest job that creates derived runtime assets while retaining originals and provenance.
3. Generate normal maps from elevation as a derived channel with declared units and strength.
4. Add texture LOD and a focused-body renderer so high-resolution uploads are useful without burdening the system overview.
5. Add atmosphere and ocean shells only when their inputs and visual semantics are separately defined.
