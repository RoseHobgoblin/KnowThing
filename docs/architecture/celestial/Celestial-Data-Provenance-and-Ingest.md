# Celestial Data Provenance and Ingest

**Status:** Design intent with a partially implemented direct-image and procedural layer
**Related documents:** [Atlas Architecture](../Atlas-Architecture.md), [Celestial Sector and System Model](./Celestial-Sector-and-System-Model.md), [Celestial Surface Models](./Celestial-Surface-Models.md), [Planetary Data Acquisition Catalogue](../../references/Planetary-Data-Acquisition-Catalogue.md), [Celestial Orrery Roadmap](../../plans/celestial/Celestial-Orrery-Roadmap.md)

> **Maturity:** Surface recipe v5, weather recipe v1, revision-pinned direct surface images, per-channel composition, calibrated procedural fallback, and texture LOD are current implementation. The evidence, immutable asset, derivation, release, GIS, and scientific weather-product sections remain design intent. Review after the first real ingest schema or published derived asset. **Expires on contact with implementation.**

## Decision Summary

KnowThing's procedural planet surface is an illustrative fallback, not a simulation of planetary geology. The long-term product is a surface composition system that can render the best model justified by the user's data while remaining useful when that data is incomplete.

The system must preserve two properties at the same time:

1. A user with no surface assets can still see a stable, clearly labelled overview body.
2. A user with researched, measured, modeled, or carefully authored data can replace any or every illustrative channel without the application degrading or silently reinterpreting it.

The next architectural boundary is not a more ambitious generator. It is an evidence and ingest layer:

```text
Current

body facts + surface recipe + revision-pinned Media bindings
    -> per-channel source plan
    -> procedural gaps
    -> Three.js material and cloud shell

Target

sources + original data products + declared metadata
    -> reproducible derivations
    -> immutable surface release
    -> optimized runtime assets
    -> Three.js material, shape, and scientific overlays
```

Before starlight or more sophisticated procedural surfaces, KnowThing should make uploaded surface data identifiable, traceable, versioned, validated, and safe to transform.

## Product Boundary

KnowThing is not a fantasy world map generator. It must not fabricate canonical continents, tectonic plates, climate, biomes, settlements, or geological history from a handful of physical fields.

It may provide:

- a flat material when no appearance is known;
- a deterministic illustrative texture when the user opts into a fallback;
- derived render products made reproducibly from user-supplied data;
- scientific and authored overlays whose semantics remain distinct from appearance textures;
- an explicit account of what is known, inferred, authored, derived, generated, missing, or broken.

The absence of data is a valid state. A missing channel must not obligate the user to supply every other channel, and must not cause unrelated facts to be invented.

## What Current Worldwrighting Does

The current implementation is best described as an **overview surface-material compositor**.

### Inputs

It uses:

- body identity for a stable fallback seed;
- an explicit nullable surface class, with a documented rocky fallback when absent;
- numeric Kelvin temperature only as a spatial-placement input and warning signal;
- explicit nullable water, vegetation, and permanent snow/ice targets;
- a separate optional illustrative mean-cloud-cover target from the weather recipe;
- the body's existing display color as a restrained tint;
- optional revision-pinned Media assets for individual texture channels.

It does not inspect body type, composition, atmosphere, or free prose to invent class or coverage. It does not use radius, mass, surface gravity, pressure, or temperature to synthesize physical geology. This is intentional: those facts do not uniquely determine a planet's map.

### Generated channels

The fallback samples seeded three-dimensional noise on the unit sphere, producing a seamless 2:1 equirectangular plate. A fixed 256 x 128 calibration pass uses spherical area weights and score quantiles to place explicitly requested coverage. The same thresholds feed 256, 512, and 1024 texture widths so LOD changes do not redefine the masks. Three priority-queued workers and a 64 MiB byte-budget cache serve the editor and map; idle workers terminate after 30 seconds.

| Class | Illustrative behavior |
|---|---|
| Rocky / terrestrial | Relative relief, compatible explicit water and snow targets, terrestrial-only vegetation, and height-correlated roughness |
| Ice | Broad ice coloring with ridged fissure-like detail |
| Gas | Latitude bands warped by spherical noise, with broad warm/cool palettes |
| Representative clouds | Separate opacity noise when illustrative weather explicitly requests mean cover |

Generated outputs are limited to base color/appearance, relative elevation, roughness, and an optional renderer-internal representative cloud layer. Normal and emissive surface channels are unavailable unless supplied.

Generated vegetation is only an illustrative placement mask for an explicit authored target. The generator does not claim to infer life or to produce tectonics, craters, volcanoes, climate, biomes, or exact atmospheric circulation.

### Composition and rendering

Each uploaded channel independently overrides its fallback:

- an uploaded base color/appearance image replaces generated color;
- uploaded elevation supplies overview bump;
- uploaded normal supersedes bump derived from elevation;
- uploaded roughness controls microsurface response;
- uploaded emissive color supplies genuinely luminous features.

Albedo and emissive textures are treated as sRGB color data. Height, normal, roughness, and opacity are treated as non-color data. The material ownership boundary is already isolated from orbital layout and camera behavior.

### Current provenance

At render time, every channel is classified as one of:

- `uploaded`;
- `procedural`;
- `constant`;
- `unavailable`.

The surface plan records whether the class and every coverage target were explicit or unspecified, plus incompatibilities and impossible-domain findings. There is no inferred class or coverage provenance. This is useful render provenance, but it is not yet durable research provenance.

## Current Media Binding Layer

Surface recipe version 5 stores explicit nullable class and surface-coverage inputs while retaining Media ID, filename snapshot, SHA-256 content hash, and interpretation metadata. The parser reads explicit version 3/4 surface values into version 5, discards former auto/inferred results, and no longer accepts uploaded cloud-alpha maps as surface bindings. Weather recipe version 1 separately stores optional representative procedural cloud appearance. `media_asset_bindings` independently records structured usage by owner and supported surface channel.

The editor now provides search, compatible/all filtering, inline upload, thumbnails, live preview, replacement, and clearing for all six planetary channels and the Starwright photosphere. New selections require an image with known dimensions, a stored content hash, and a 2:1 aspect within a small export tolerance. Normal-map Y convention and elevation value units are explicit choices. Color/data interpretation is assigned by channel.

Media identity and revision are separate:

- rename preserves the numeric identity and cannot break a surface;
- replacement archives the former bytes while the celestial binding continues to request its pinned hash;
- deletion is blocked while any structured binding exists;
- Media search and detail usage include celestial bindings;
- server-side save validation repeats existence, revision, MIME, dimensions, aspect, and hash checks.

### Remaining direct-image gaps

- Browser texture-load failure is not yet stored as a durable broken state.
- Maximum decoded dimensions and per-device GPU budgets need explicit enforcement.
- Elevation datum, range, offset, no-data value, and reference ellipsoid remain unmodeled.
- Source, citation, license, authority, observation time, and derivation lineage remain prose rather than structured evidence.
- General projections and reprojection are not supported; the direct renderer deliberately accepts only 2:1 equirectangular plates.

### Media is not a scientific asset store

The current upload path accepts images and PDF files, normally with a 10 MB limit. It cannot represent a product composed of multiple related files or directly accept important scientific formats such as NetCDF, HDF5, GPML, PDS labels and binary objects, or Shapefile sidecars.

### Metadata is insufficient

A Media description is useful prose, but it cannot replace structured fields for:

- source and citation;
- license and attribution requirements;
- coordinate reference system;
- planetary datum or reference ellipsoid;
- planetocentric versus planetographic latitude;
- positive-east versus positive-west longitude;
- longitude range and prime meridian;
- projection and seam placement;
- pixel registration and spatial resolution;
- units, scale, offset, and no-data value;
- observation epoch, time interval, or reconstruction time;
- band, variable, and time-slice selection;
- transformation history.

## Evidence Model

The internal model should separate evidence from render artifacts. The following are logical entities; exact table names and column types should be settled in an implementation migration.

### 1. Source record

A source record answers **who or what supports this data?**

Suggested fields:

- title;
- creators or responsible organization;
- publication or release date;
- canonical URL;
- DOI, PDS LIDVID, ISBN, or other stable identifier;
- license and required attribution;
- retrieval date;
- citation text and notes.

A source can support multiple assets, and an asset can cite multiple sources. Authored data may cite a wiki user or project record without pretending to have an external publication.

### 2. Data asset

A data asset represents a logical data product. It may contain one or more immutable stored files.

Suggested fields:

- stable asset ID;
- title and description;
- format family and detected MIME types;
- current lifecycle state;
- original or derived classification;
- content hashes for every stored file;
- byte sizes and basic dimensions;
- uploader and import time;
- machine-extracted metadata;
- user-confirmed metadata;
- optional external catalog identity.

A one-to-many `data_asset_files` relation is necessary for products such as:

- a PDS4 XML label plus one or more data objects;
- a Shapefile with `.shp`, `.shx`, `.dbf`, and `.prj` components;
- a GPML feature collection plus rotation model;
- an authored package containing color, height, and documentation files.

The original files must be retained unchanged. A viewable Media record may point at an original image or a derived browse image, but Media should not be forced to masquerade as the storage model for every scientific product.

### 3. Surface layer

A surface layer binds one semantic dataset to one celestial body.

Suggested fields:

- body ID;
- semantic role;
- source asset or generation recipe;
- origin, lineage, and authority classifications;
- coordinate metadata;
- measurement metadata;
- time coverage;
- spatial coverage and resolution;
- draft, valid, broken, or superseded state;
- validation findings.

Initial material roles are:

- base color/appearance;
- elevation;
- normal;
- roughness;
- emissive.

The model must also allow non-material layers without baking them into the base color image:

- plate boundaries and faults;
- geological units;
- coastlines and named regions;
- crustal age, heat flow, gravity, or magnetic fields;
- observation footprints;
- time-dependent weather or ice coverage;
- future shape models.

### 4. Derivation

A derivation is an immutable transformation record:

```text
input asset versions
+ program, package, and container versions
+ exact parameters
+ operator and timestamp
-> output asset versions
```

Examples include:

- selecting a NetCDF variable and time slice;
- reprojecting a GeoTIFF to the runtime plate;
- applying scale, offset, and no-data rules;
- mosaicing observation products;
- deriving a tangent-space normal map from measured elevation;
- reconstructing GPML features at a declared geological time;
- creating preview, tiled, or GPU-compressed render assets.

Every derivation should be reproducible without altering its inputs. A new tool version or parameter change creates a new derivation rather than overwriting the old output.

### 5. Surface release

A future surface release is an immutable, published snapshot consumed by the renderer. Live procedural recipes are intentionally unpinned and always use the newest deployed generator. Publishing a reproducible procedural result therefore requires baking it as a derived asset rather than pinning a live recipe to old generator code.

It pins:

- the body;
- a release number or stable ID;
- every included layer and asset version;
- hashes of runtime artifacts;
- hashes of baked procedural artifacts plus the producing tool revision and parameters when generated content is published;
- publication time and publisher;
- validation status.

Editing produces a draft release. Publishing atomically changes the body's active release. Existing releases remain reproducible and can be restored.

## Provenance Vocabulary

No single label adequately describes both epistemic origin and wiki authority. Keep these dimensions separate.

### Origin

- `observation`: measured or remotely sensed data;
- `model`: a scientific simulation, reconstruction, or inferred field;
- `authored`: deliberately created canonical material;
- `generated`: automatic illustrative output.

### Lineage

- `original`: the deposited source product;
- `derived`: transformed from one or more recorded inputs.

### Authority

- `canonical`: the model the wiki intends to assert for this body;
- `supporting`: useful evidence or comparison, but not the active assertion;
- `illustrative`: display assistance that must not be read as geography or measurement.

This permits accurate combinations:

- a calibrated mission mosaic can be `observation / derived / canonical`;
- an author's original continent map can be `authored / original / canonical`;
- a normal map generated from that author's DEM can be `authored / derived / canonical`;
- the seeded fallback is `generated / derived / illustrative`.

Do not collapse these combinations into a confidence percentage. Missing metadata and conflicting evidence should be shown as findings, not hidden behind a score.

## Supporting Different Amounts of Homework

The editor should use progressive disclosure. It must never require every possible layer before accepting one useful layer.

### No surface homework

The user chooses either:

- flat appearance; or
- deterministic illustrative fallback.

The UI states that geography and geology are unavailable.

### Appearance assets

The user attaches an existing Media image or uploads a 2:1 plate. KnowThing asks only for the channel and missing essentials, then previews the sphere and seam.

Example status:

> Surface color is authored and canonical. Relief is illustrative. Clouds are unavailable.

### Structured data

The user uploads a GeoTIFF, NetCDF variable, vector layer, or multi-file product. KnowThing extracts metadata, asks the user to confirm ambiguous fields, previews the transformation, and retains both the original and the derived runtime output.

### Research-grade model

The user supplies citations, units, coordinate conventions, epochs, and complete lineage. KnowThing publishes a reproducible surface release with a Sources and data view.

### Prompting rules

Ask the user for data when the missing fact is canonical rather than decorative:

- exact coasts, terrain, named features, or settlements;
- measured elevation or bathymetry;
- plate boundaries, faults, and reconstruction models;
- exact cloud, storm, ice, vegetation, or seasonal state;
- exact gas bands or geological units;
- city lights, lava, aurorae, or other emissive phenomena.

Do not turn these prompts into a completeness game. Prefer capability statements:

- `Illustrative surface color — attach a base color / appearance image to replace it.`
- `Elevation is relative - provide units and datum to use physical displacement.`
- `Projection detected; longitude direction needs confirmation.`
- `Clouds unavailable.`
- `This layer is valid for 50 Ma, not the body's current epoch.`

## Channel Validation

Validation must distinguish blocking errors, warnings, and informational findings.

| Channel | Required interpretation |
|---|---|
| Base color / appearance | Color space; whether the source is intrinsic color, reflectance, radiance, a false-color product, or a cartographic illustration |
| Elevation | Units or explicit `relative`; datum/reference ellipsoid; scale; offset; no-data; positive direction |
| Normal | Tangent-space convention; especially OpenGL versus DirectX Y direction |
| Roughness | Declared value range and meaning; never inferred from base color without recording a modeled derivation |
| Cloud/weather field | Mask, probability, fraction, optical-depth, or other meaning; units and wavelength where applicable; epoch/time interval; vertical coordinate; and whether it is climatology, model output, or a particular observation |
| Emissive | Color space and physical/authored meaning; a night photograph is not automatically intrinsic emission |
| Vector overlays | CRS/body reference, geometry meaning, attributes, valid time, and reconstruction model when applicable |

An unknown unit can be accepted as `relative elevation`, but it must block claims of physical displacement. A false-color science product can be displayed as a scientific overlay, but must not silently become canonical albedo.

## Ingest Architecture

Scientific ingest belongs in background workers, not request handlers or browser code.

```text
upload, URL, or catalog identifier
    -> quarantined immutable files
    -> format detection and safety checks
    -> metadata inspection
    -> ready or needs-user-input
    -> isolated transformation job
    -> validation and preview
    -> immutable derived assets
    -> draft surface release
    -> publish
```

Suggested job states:

- `quarantined`;
- `inspecting`;
- `needs_input`;
- `processing`;
- `ready`;
- `failed`;
- `superseded`.

Each adapter should implement the equivalent of:

```ts
interface DataIngestAdapter {
  probe(files: StoredFile[]): ProbeResult
  inspect(asset: DataAsset): InspectionReport
  validate(asset: DataAsset, interpretation: DeclaredInterpretation): ValidationReport
  derive(asset: DataAsset, request: DerivationRequest): Promise<DerivedAsset[]>
}
```

Provider-specific integrations should feed this same contract. A NASA or catalog connector should not create a second provenance system.

## Formats and Processing Tools

### Ordinary images

PNG, JPEG, WebP, and compatible image maps remain the fastest handoff. The initial improvement is a Media picker with existence, MIME, aspect-ratio, dimensions, GPU-budget, and channel validation.

### GeoTIFF and Cloud-Optimized GeoTIFF

Use GDAL to inspect and transform georeferenced rasters. The GDAL data model exposes raster dimensions, coordinate systems, metadata, bands, and subdatasets; reprojection must record its target CRS, resolution, resampling method, and coordinate operation. See [GDAL's raster data model](https://gdal.org/en/stable/user/raster_data_model.html) and [`gdalwarp`](https://gdal.org/en/stable/programs/gdalwarp.html).

### NetCDF and HDF5

These often contain many variables, dimensions, levels, and time steps. The user must select the semantic variable and slice rather than having KnowThing guess. GDAL's multidimensional model includes dimensions, direction, CRS, units, no-data, scale, offset, and overviews and is inspired by NetCDF and HDF5. See [GDAL's multidimensional raster model](https://gdal.org/en/stable/user/multidim_raster_data_model.html).

### Planetary Data System products

Treat a PDS product's label and data objects as one logical asset. Preserve its LIDVID and citation rather than extracting only a display image. PDS4 associates every product with an XML label containing searchable metadata and a stable logical identifier. See [NASA PDS4 training](https://pds.nasa.gov/datastandards/training/) and [PDS citation guidance](https://pds.nasa.gov/datastandards/citing/).

USGS ISIS should be available in the isolated processing environment for mission products that need calibration, sensor geometry, or extraterrestrial cartography. ISIS is specifically designed to turn archival planetary observations into cartographically located and analysis-ready products. See [USGS ISIS](https://isis.astrogeology.usgs.gov/7.0.0/).

### Vector and tectonic data

Accept GeoJSON and GeoPackage directly; accept Shapefile only as a complete bundle. Preserve features as queryable overlays instead of baking them irreversibly into albedo.

GPML feature collections and rotation models should use GPlates/pyGPlates for time reconstruction. A published time slice records the rotation model, anchor plate, reconstruction time, tool version, and exported geometry. See [pyGPlates reconstruction](https://www.gplates.org/docs/pygplates/generated/pygplates.reconstruct) and the [GPlates raster import model](https://www.gplates.org/docs/user-manual/import/).

### Catalog interoperability

Support STAC import and export where useful, but do not make the internal model Earth-only. STAC provides a minimal, extensible model for cataloging spatiotemporal assets such as imagery, DEMs, vectors, point clouds, and composites. KnowThing will need planetary-coordinate and authored-world extensions. See the [OGC STAC standard](https://www.ogc.org/standards/stac/).

### Runtime products

The renderer should never parse scientific source formats. Derivations should create fit-for-purpose assets:

- small system-map previews;
- full-resolution focused-body plates;
- level-of-detail tiles where necessary;
- optional KTX2/Basis GPU-compressed textures;
- vector overlay tiles or simplified geometry;
- a release manifest tying every artifact back to its layer and derivation.

Three.js provides `KTX2Loader` for GPU texture containers and Basis Universal transcoding. See [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

## Coordinate Contract

Every spatial layer must ultimately resolve to a declared body-fixed reference. At minimum, retain:

- body/reference frame identity;
- reference sphere, ellipsoid, or shape model;
- semi-major and semi-minor radii where relevant;
- latitude type: planetocentric or planetographic;
- longitude direction: positive east or positive west;
- longitude range: `-180..180` or `0..360`;
- prime meridian definition;
- source projection and serialized CRS definition where available;
- pixel-is-area versus pixel-is-point registration;
- seam placement;
- horizontal and vertical units;
- coordinate epoch or valid time.

The default Three.js interchange plate may remain 2:1 equirectangular, positive-east, with the current sphere UV orientation, but a derivation must explicitly document how the source became that plate. Do not assume terrestrial EPSG codes adequately describe other worlds.

## Sources and Data UI

Every celestial body with structured assets should expose a Sources and data view containing:

- the active surface release;
- channel and overlay status;
- origin, lineage, and authority labels;
- source citations and licenses;
- original asset links subject to permissions;
- coordinate and measurement metadata;
- derivation summaries;
- validation warnings;
- older releases and comparison/restoration actions.

Article footnotes can link to these records, but must not be the only storage for structured-data provenance. The data relationship must survive prose edits and continue to support machine validation.

## Security and Operations

Scientific imports expand the attack and resource surface. The ingest service must account for:

- very large decompressed rasters despite small compressed uploads;
- archive bombs and malicious multi-file packages;
- path traversal and duplicate/colliding component names;
- XML external entities in label formats;
- parser and native-library vulnerabilities;
- server-side request forgery in URL imports;
- unbounded remote downloads and redirect chains;
- unsafe or unexpected CRS transformation grids;
- licensing and redistribution restrictions;
- denial of service through expensive reprojection or texture compression.

Workers should run with explicit CPU, memory, time, and disk limits; restricted filesystem access; no ambient credentials; and no network access unless a specific import job requires an allowlisted fetch phase. Original objects and derived products should use separate storage prefixes and immutable hashes.

## Migration to Surface Recipe Version 5

Migration `0051_media_asset_bindings.sql` backfills structured usage for resolvable legacy filenames. The version 5 parser carries forward explicit version 3/4 class, seed, surface coverage, and supported surface map bindings; it intentionally discards auto/inferred results and old uploaded cloud-alpha bindings. Explicit legacy procedural cloud coverage is migrated into weather recipe v1 on the next celestial save. The next server-validated save resolves retained Media references to Media ID/current hash or reports the broken reference. Immutable scientific surface and weather releases remain a later layer above these direct-image bindings.

## Delivery Sequence

### Phase 0: Repair the current filename contract — complete

- Add celestial surface usage lookup.
- Validate referenced Media records and channel compatibility.
- Keep texture-load failures visible in the live editor/runtime.
- Replace filename identity with stable Media ID and pinned hash.
- Block or explicitly detach referenced assets on delete.

### Phase 1: Evidence and immutable releases

- Add source, asset, asset-file, surface-layer, derivation, and release records.
- Add origin, lineage, authority, coordinate, measurement, and time metadata.
- Add draft/publish/history behavior.
- Migrate version 1 recipes.
- Add the Sources and data view.

### Phase 2: Direct image workflow — initial workflow complete

- Replace exact-filename text inputs with search, upload, preview, and validation.
- Extend per-channel interpretation beyond normal Y/elevation units into complete coordinate and measurement metadata.
- Derive overview assets and normal maps where explicitly requested.
- Use projected physical-sphere texture LOD in the orrery and a fixed high-resolution editor preview. A focused tile viewer remains separate work.

### Phase 3: General raster ingest

- Introduce the isolated job system and object storage boundary.
- Add GeoTIFF/COG inspection and reprojection.
- Preserve originals and exact GDAL derivation parameters.
- Add preview, seam, no-data, and range validation.

### Phase 4: Multidimensional and planetary products

- Add NetCDF/HDF5 variable and time-slice selection.
- Add PDS4 product grouping, labels, identifiers, and ISIS processing.
- Add time-dependent layer releases.

### Phase 5: Vector, tectonic, and catalog integrations

- Add GeoJSON, GeoPackage, bundled Shapefile, and GPML assets.
- Add GPlates reconstruction jobs and time-slice publication.
- Add STAC import/export.
- Add provider-specific catalog connectors only through the common asset contract.

## Acceptance Criteria

The foundation is ready when:

- a body with no surface data still renders flat or explicitly illustrative;
- one uploaded channel works without requiring any other channel;
- an asset's use by a celestial body is visible in Media usage;
- referenced assets cannot be silently renamed, deleted, or replaced beneath a published release;
- a broken or undecodable binding is reported as broken rather than uploaded;
- every published layer identifies its origin, lineage, authority, and pinned asset version;
- an original imported file can be downloaded byte-for-byte with the same hash;
- every derived runtime artifact identifies its inputs, tool version, and parameters;
- relative elevation cannot be presented as measured displacement without units and datum;
- a false-color or analytical raster remains an overlay unless deliberately published as authored albedo;
- partial models clearly distinguish supplied, derived, illustrative, and unavailable channels;
- a previous surface release can be reproduced and restored;
- large or hostile inputs cannot execute in the application process or consume unbounded resources.

## Explicit Non-Goals

This work does not include:

- generating fantasy geography from physical statistics;
- pretending seeded noise is plate tectonics or climate;
- general N-body or geophysical simulation;
- automatically assigning truth from a file merely because it was uploaded;
- destructive conversion that discards original scientific products;
- requiring research-grade metadata for an intentionally illustrative body;
- implementing every external provider before the generic ingest contract exists.

The successful result is not that every planet has every layer. It is that KnowThing can always say what each visible part is, why it is present, where it came from, how it was transformed, and whether the wiki means to assert it.
