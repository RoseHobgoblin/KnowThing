# Celestial Surface Models

**Related documents:** [Atlas Architecture](./Atlas-Architecture.md), [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md), [Planetary Data Acquisition Catalogue](./Planetary-Data-Acquisition-Catalogue.md)

> **Maturity:** Design intent plus an implemented overview-surface pipeline. Surface recipe v5, weather recipe v1, calibrated procedural coverage, projected-size texture LOD, direct 2:1 surface uploads, and the editor controls described below exist. Scientific weather ingest and focused exploration do not. Review this document when the recipe, generator semantics, or focused-viewer boundary changes. **Expires on contact with implementation.**

## Product Boundary

KnowThing renders the best planet model supported by the user's data. It is not a fantasy map generator and does not claim that seeded noise is tectonics, climate, or geography.

The surface system is progressive:

1. With no surface data, the map can show a deterministic illustrative texture derived from the body's broad class and explicit surface settings.
2. A user may disable procedural fallback and keep a flat material.
3. Each uploaded material channel independently replaces its fallback. Supplying one map never creates an obligation to supply the other maps.
4. Complete researched data can replace every generated channel without being altered by the generator.

Every texture choice retains provenance as `uploaded`, `procedural`, `constant`, or `unavailable`. Procedural output is described in the UI as illustrative.

## Current Recipe

The version 5 recipe lives in `celestial_bodies.extra.surface`. It stores authored inputs, not a generator version:

```json
{
  "version": 5,
  "fallback": "procedural",
  "class": "terrestrial",
  "seed": 436,
  "coverage": {
    "surfaceWater": 0.55,
    "vegetation": 0.62,
    "permanentSnowIce": 0.14
  },
  "maps": {
    "albedo": {
      "version": 1,
      "mediaId": 42,
      "filename": "Saxnat albedo.png",
      "contentHash": "<sha256>",
      "interpretation": {
        "projection": "equirectangular",
        "colorSpace": "srgb"
      }
    }
  }
}
```

All channels use the same binding shape. Normal bindings additionally record OpenGL/DirectX Y convention; elevation bindings record relative, metre, or kilometre interpretation. Media bindings remain pinned to the selected content hash. This is separate from procedural generation: a saved recipe deliberately runs through the newest deployed algorithm. Exact reproducibility belongs to a future baked artifact, which can record its producing tool revision and output hash.

All fields are optional in the editor. `fallback: "flat"` is the explicit opt-out. A null class uses the documented rocky illustrative fallback; there is no automatic class inference. A null coverage means “not specified,” while explicit zero requests zero. Version 3 and 4 recipes retain only their explicit surface class, seed, surface coverage, and supported surface map bindings when read as version 5; former inferred/auto results and uploaded cloud masks are discarded.

Coverage values are authored visual targets with measured domains:

- surface water and permanent snow/ice are fractions of total spherical area;
- vegetation is a fraction of eligible exposed terrestrial land after water and snow.

The generator uses temperature, latitude, altitude, and climate scores only to place requested coverage. It never derives the amount from prose, body type, composition, atmosphere, or temperature. Numeric `temperatureK` may produce a non-blocking warning for unusual illustrative placement, but it cannot override the authored target.

## Texture Channels and Upload Handoff

The current runtime expects ordinary images stored in KnowThing Media. A searchable picker supports selection and inline upload, validates image identity and a 2:1 equirectangular aspect, and updates the unsaved preview immediately. The selected content hash is served from the current file or archived Media version, so replacement cannot silently change a body.

| Channel | Meaning | Recommended handoff | Runtime treatment |
|---|---|---|---|
| Albedo | Intrinsic base color, without baked sunlight or labels | PNG, JPEG, or WebP; 2:1; sRGB | `material.map`, sRGB |
| Elevation | Relative or measured surface height | Grayscale PNG; 2:1; document units and vertical datum | Subtle bump in overview; reserved for close-view displacement |
| Normal | Authored tangent-space surface normals | PNG; 2:1; document OpenGL/DirectX Y convention | `normalMap`, non-color; supersedes elevation bump |
| Roughness | Microsurface roughness | Grayscale PNG; 2:1 | `roughnessMap`, non-color (Three samples green) |
| Emissive | Actually luminous features such as lava or city lights | PNG, JPEG, or WebP; 2:1; sRGB | `emissiveMap`, sRGB |

Color and data textures are deliberately separated. Three.js requires color textures such as albedo/emissive to declare sRGB, while normal, roughness, displacement, and opacity maps remain non-color data. See [Three.js color management](https://threejs.org/manual/en/color-management.html) and [MeshStandardMaterial map semantics](https://threejs.org/docs/pages/MeshStandardMaterial.html).

An uploaded normal map is considered more authoritative than generated or uploaded height used as bump. The original uploaded files are never rewritten by procedural generation.

## Weather Appearance Is Not a Surface File

Clouds are stored separately in `celestial_bodies.extra.weather`. The current weather recipe deliberately supports only an illustrative representative state:

```json
{
  "version": 1,
  "clouds": {
    "mode": "procedural",
    "meanCover": 0.48,
    "seed": 91
  }
}
```

`meanCover` is a visual target for the fraction of one representative generated shell whose opacity is at least 0.5. It is not a dated observation, measured climatology, or permanent geography. The renderer still derives a transient alpha texture internally, but the editor no longer presents a cloud-alpha upload as foundational planetary data.

Real products normally provide cloud mask or probability, cloud fraction, optical depth, condensed-water path, cloud-top properties, and time coordinates. These require an atmosphere/weather ingest path that retains their semantics. A single observation may eventually be accepted as an explicitly dated weather layer, but never silently promoted to a timeless surface channel. See [NASA MODIS cloud products](https://atmosphere-imager.gsfc.nasa.gov/faqs/cloud) and the [ESA Mars Express OMEGA water-ice cloud maps](https://esdcdoi.esac.esa.int/doi/html/data/planetary/MARS-EXPRESS/MEX-M-OMEGA-5-DDR-H2OCLOUDS-MAPS.html).

## What the Worldwright Prototype Contributed

The prototype contributed four sound implementation ideas:

- deterministic seeded generation;
- three-dimensional noise sampled on a sphere, avoiding a longitude seam;
- class-specific visual fallbacks for rocky, terrestrial, gas, and ice bodies;
- clouds as a separate generated render layer rather than baked surface color.

The adaptation intentionally removed or constrained claims that the prototype could not justify:

- gravity no longer fabricates mountain amplitude;
- temperature does not fabricate vegetation, life, water, or snow coverage;
- atmosphere text does not automatically fabricate clouds;
- random craters, volcanoes, and tectonics are not treated as canonical data;
- height shading is not baked into albedo, because lighting belongs to the material and scene;
- generated relief, roughness, weather clouds, and color remain independent outputs.

The live procedural fallback uses 256 x 128, 512 x 256, and 1024 x 512 levels. Map bodies begin at 256 and upgrade from the projected physical sphere diameter after camera-settle events; the editor always requests 1024. Three priority-queued workers stop after 30 seconds idle. A 64 MiB byte-budget LRU accounts for in-flight work, and material swaps dispose superseded generated GPU textures without taking ownership of uploads.

The generator calibrates masks on one fixed 256 x 128 spherical grid using `cos(latitude)` area weights, then reuses its thresholds at every LOD so coastlines and coverage do not jump. Its named internal algorithm revision exists only for caches, diagnostics, and tests; it is not part of the recipe contract.

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
- canonical climate zones, seasonal clouds, storms, ice cover, or vegetation;
- city lights, lava, aurorae, or other emissive phenomena;
- exact gas bands, storms, impact sites, or geological units.

Do not block a user who lacks those assets. Leave the channel procedural, flat, or unavailable and say which one it is.

## Next Surface Work

The complete provenance, ingest, publishing, and migration design is maintained in [Celestial Data Provenance and Ingest](./Celestial-Data-Provenance-and-Ingest.md).

The remaining surface work is:

1. Add a proper GeoTIFF/NetCDF/PDS ingest job that creates derived runtime assets while retaining originals and provenance.
2. Generate normal maps from elevation as a derived channel with declared units and strength.
3. Turn the isolated focused-viewer findings into an app-owned navigation and selection adapter.
4. Define time-aware atmosphere and weather ingest before accepting observed cloud products or climatologies.
