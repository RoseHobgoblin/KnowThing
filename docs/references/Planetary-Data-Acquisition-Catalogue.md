# Planetary Data Acquisition Catalogue

**Status:** Design intent and acquisition research; only the direct-image lane is publicly supported
**Last updated:** 8 August 2026  
**Related documents:** [Celestial Surface Models](../architecture/celestial/Celestial-Surface-Models.md), [Celestial Data Provenance and Ingest](../architecture/celestial/Celestial-Data-Provenance-and-Ingest.md), [Atlas Architecture](../architecture/Atlas-Architecture.md)

> **Maturity:** The catalogue describes desired product semantics and real acquisition paths. The simple 2:1 image workflow and its Media validation are implemented; Mars is a maintainer-operated reference fixture. Most GIS, PDS, CRS, multidimensional, and multi-channel workflows are not public ingest features. Review each lane when a fixture-backed workflow is promoted. **Expires on contact with implementation.**

## Decision Summary

KnowThing does not support a planetary data type merely because a database field or renderer input can be invented for it. A supported type must have at least one realistic acquisition path and one documented handoff:

- users can download it from a known archive, catalogue, or provider;
- users can export it from an established authoring or scientific tool;
- KnowThing explains what the data means, what a valid product looks like, and what capability it unlocks;
- KnowThing accepts the source in a format users can actually obtain rather than requiring a proprietary intermediate file;
- validation distinguishes the data from visually similar but semantically different files;
- original products, metadata, citations, licenses, and stable external identifiers survive ingest.

The application must not tell a user only to "upload elevation" or "provide tectonic data." It must answer:

1. What is this data?
2. Why would I provide it?
3. What file should I look for?
4. Where can I obtain or create it?
5. How will KnowThing inspect and transform it?
6. What remains unavailable if I do not have it?

This catalogue is the product contract for those answers. It should eventually drive both documentation and contextual help in the editor.

## Product Rule

The following full contract applies only when a data type is promoted to **Supported**. Research notes and maintainer tools may be narrower so that internal work can test architecture without creating a public promise. No type enters the public support matrix until its catalogue entry includes:

- a stable semantic name;
- the body or spatial domains to which it applies;
- supported source formats and product groupings;
- minimum required interpretation metadata;
- at least one valid sample fixture;
- a human-readable good example and bad-lookalike example;
- one or more acquisition or export paths;
- blocking errors, warnings, and informational findings;
- the derivations and runtime artifacts KnowThing may create;
- license, attribution, citation, and redistribution handling;
- a statement of the capability the data does and does not unlock.

Supporting an extension is not sufficient. A `.tif` file may contain elevation, imagery, a categorical map, temperature, or an arbitrary picture. A `.nc` file may contain hundreds of variables, levels, and time steps. Meaning must come from inspected metadata and declared interpretation, not the filename.

## Workflow Maturity

This catalogue uses a maturity label separately from the format-capability levels below:

| Maturity | Product promise |
|---|---|
| Research note | Acquisition and semantic research only; no usable ingest workflow is claimed. |
| Maintainer-assisted | A KnowThing maintainer can prepare or install the data through documented project tooling; ordinary users are not promised self-service ingest. |
| Experimental | A self-service or prototype path exists, but its contract, fixtures, or failure behavior may change. |
| Supported | A public workflow meets the complete Product Rule, is tested, documented, and safe to rely on. |

Current classification:

| Lane | Maturity |
|---|---|
| Ordinary 2:1 equirectangular material-channel images | Supported |
| Built-in Mars acquisition and installation pipeline | Maintainer-assisted |
| GeoTIFF/COG, GeoPackage/GeoJSON, and other GIS ingest | Maintainer-assisted design target; the PostGIS exercise is an isolated architecture spike, not ingest |
| PDS, SPICE, NetCDF, HDF5, GPML, and scientific multi-channel products | Maintainer-assisted or research note, depending on the entry |
| Planet Package | Research note |

## Levels of Support

Use precise support language in the UI and roadmap:

| Level | Meaning |
|---|---|
| Recognized | KnowThing identifies the container or format family and can retain the original safely. |
| Inspectable | KnowThing extracts useful structure, metadata, variables, bands, coordinates, dimensions, and external identifiers. |
| Interpretable | The user can confirm ambiguities and bind the product to a declared semantic role and spatial reference. |
| Derivable | A background job can create recorded, fit-for-purpose preview or runtime artifacts. |
| Publishable | The interpreted layer can be included in an immutable Atlas release with provenance and validation findings. |
| Integrated | KnowThing can search or retrieve the product from a provider by URL or catalogue identifier without losing provider metadata. |

The editor must not describe a format as fully supported when it is only recognized or retained.

## Data Meaning Is Separate from Presentation

Every imported layer has at least three independent properties:

1. **Data shape:** raster, vector, mesh, point cloud, table, multidimensional field, time series, or product bundle.
2. **Semantic meaning:** elevation, reflectance, temperature, cloud fraction, political boundary, settlement, and so on.
3. **Presentation:** base colour, terrain, contour, heat map, marker, cloud opacity, scientific overlay, or hidden analytical input.

Examples:

- a temperature GeoTIFF is a raster field presented as an analytical overlay, not albedo;
- a night-side photograph is observed radiance, not automatically an intrinsic emissive map;
- a tangent-space normal image is normally a render input or derivation, not a geological observation;
- a political polygon layer can be styled in many ways without changing its canonical geometry;
- a cloud climatology and a cloud observation at one instant are different layers even if both can produce opacity textures.

The existing albedo, elevation, normal, roughness, and emissive channels remain a useful Three.js surface-material interface. Procedural weather may derive a cloud alpha texture internally, but cloud observations and climatologies are time-aware atmospheric data rather than direct surface-material uploads. Neither interface is the complete planetary data taxonomy.

## Acquisition Lanes

Users should be able to enter through the least demanding lane appropriate to their data.

### Quick appearance — Supported

Attach an ordinary 2:1 image through Media. This is appropriate for an authored global plate or a deliberately simplified overview. KnowThing asks for its meaning and authority but does not require research-grade geodesy.

### Guided GIS import — Maintainer-assisted design target

Upload a GeoTIFF, Cloud-Optimized GeoTIFF, GeoPackage, GeoJSON, complete Shapefile bundle, or CSV. KnowThing inspects the product, asks only about unresolved metadata, previews coverage and seams, and creates a draft layer.

### Scientific product import — Maintainer-assisted design target

Upload or retrieve the original PDS4, NetCDF, HDF5, GPML, SPICE, or comparable product with every associated label and data object. KnowThing retains the product as a logical multi-file asset and derives display products in an isolated worker.

### Planet package — Research note

Accept a small KnowThing manifest that references standard files, sources, coordinate definitions, times, and intended semantic layers. The manifest is not a new scientific raster or geometry format. It packages ordinary interoperable products for repeatable import.

Worldwright, external tools, provider integrations, and advanced users should be able to produce the same package contract.

## Product Maturity

Many archives expose multiple products that appear to be "an image of a planet" but have very different uses:

- raw instrument data;
- calibrated observation;
- geometrically corrected observation;
- map-projected observation;
- regional mosaic;
- global mosaic;
- browse or quick-look image;
- false-colour analytical visualization;
- labelled cartographic publication.

The acquisition UI must show processing level and product type when known. For a casual globe, recommend a map-projected regional or global mosaic. Do not recommend raw observations unless the ingest pipeline can perform the required calibration and geometry. A browse JPEG is useful for selection but is not a substitute for its associated scientific product.

## Catalogue Overview

| Capability | Preferred handoff | Common acquisition or export paths | Primary result |
|---|---|---|---|
| Reference body and frame | PDS4/SPICE metadata or declared body-fixed definition | NASA PDS NAIF, mission archives, manual authored definition | Meaningful coordinates and rotation |
| Global appearance and reflectance | Map-projected PDS product, GeoTIFF/COG, or 2:1 colour image | USGS Astropedia, NASA PDS, ESA PSA, JAXA DARTS, QGIS, Worldwright | Overview globe and imagery layer |
| Elevation and bathymetry | Numeric GeoTIFF/COG or labelled planetary raster | USGS Astropedia, PDS Geosciences, NASA Earthdata, Copernicus, QGIS | Terrain and physical measurement |
| Irregular shape | SPICE DSK/PDS shape model; authored mesh as a lower-authority route | PDS Small Bodies, NAIF, mission archives, Blender | Irregular-body geometry |
| Atmosphere, climate, and ocean fields | CF-NetCDF, HDF5, or provider product bundle | PDS Atmospheres, NASA Earthdata, NOAA, Copernicus, ESA PSA | Time/level-aware physical overlays |
| Geographic and geological vectors | GeoPackage, GeoJSON, complete Shapefile bundle | QGIS, Natural Earth, OpenStreetMap, scientific repositories | Queryable points, lines, and polygons |
| Tectonic reconstruction | GPML feature collection plus rotation model | GPlates/EarthByte or authored in GPlates | Plate features and reconstructed time slices |
| Settlements and infrastructure | GeoPackage, GeoJSON, or coordinate CSV | QGIS, OpenStreetMap, Natural Earth, Worldwright, spreadsheets | Searchable features and wiki links |
| Networks | GeoPackage/GeoJSON with explicit nodes and edges | QGIS, OpenStreetMap, network-analysis tools, authored tables | Roads, transit, shipping, and routing foundations |
| Local plans and interiors | Local projected vectors, rasters, or declared schematic space | QGIS, CAD/vector tools, image editors | City, site, station, and interior navigation |

## 1. Reference Body and Coordinate Frame

### What it represents

The reference on which every surface coordinate and vertical measurement depends. It may be a sphere, ellipsoid, triaxial figure, pressure reference, irregular shape model, or explicitly schematic body.

### Preferred handoff

- PDS4 labels and associated coordinate metadata;
- SPICE PCK, frame, and related kernels when applicable;
- an authored body-fixed definition containing radii, pole/rotation model, prime meridian, longitude convention, latitude type, and epoch.

### A valid product looks like

- a stable body identity;
- declared dimensions and units;
- a body-fixed frame and rotation convention;
- a prime meridian or explicit arbitrary authored origin;
- a declared reference level such as solid surface, geoid, sea level, 1-bar pressure surface, or cloud top;
- an epoch where orientation changes with time.

### Bad lookalikes

- a sphere mesh with no scale or frame;
- a texture whose seam is assumed to define zero longitude without saying so;
- Earth EPSG metadata applied to another body only to satisfy a library.

### Where to obtain or create it

- [NASA PDS](https://pds.nasa.gov/) and its [Navigation and Ancillary Information Facility](https://naif.jpl.nasa.gov/naif/data.html) for mission geometry and SPICE products;
- mission documentation in the [ESA Planetary Science Archive](https://archives.esac.esa.int/psa/);
- a guided KnowThing definition for authored worlds.

### What it unlocks

Coordinates, measurements, correct rotation, reprojection, layer alignment, terrain, and reproducible globe/flat transitions. Without it, the body may still render as a schematic sphere, but its locations cannot be described as physically georeferenced.

## 2. Global Appearance, Imagery, and Reflectance

### What it represents

These are distinct meanings that may share a raster container:

- authored base colour;
- natural-colour or approximately natural-colour imagery;
- measured or derived reflectance/albedo;
- observed radiance;
- radar or false-colour imagery;
- a labelled cartographic illustration.

The importer must ask which meaning applies. Only a suitable colour or reflectance product should become canonical material colour without an explicit presentation decision.

### Preferred handoff

- map-projected PDS4 or mission product with its label;
- GeoTIFF or Cloud-Optimized GeoTIFF with coordinate metadata;
- ordinary PNG, JPEG, or WebP for the quick authored lane.

### A valid quick plate looks like

- a global 2:1 equirectangular image, for example 4096 x 2048;
- north at the declared top and a documented longitude direction;
- a seam at the declared prime meridian or a recorded conversion from another seam;
- no UI chrome, legend, labels, grid, or unexplained transparency;
- preferably no baked directional illumination when the image is intended as intrinsic material colour;
- sRGB colour interpretation when it is a display colour image.

Serious ingest must also accept georeferenced partial coverage. It must not force every observation into a global plate before upload.

### Bad lookalikes

- a screenshot of a web globe;
- a shaded relief map submitted as intrinsic albedo;
- a false-colour mineral or temperature product submitted as natural colour;
- a labelled political map used as the physical surface texture;
- a browse thumbnail detached from its higher-value source product.

### Where to obtain or create it

- [USGS Astropedia](https://astrogeology.usgs.gov/search/about) for map-ready planetary geospatial products and metadata;
- [NASA PDS Search](https://pds.nasa.gov/services/search/index.jsp) and the PDS Cartography and Imaging Sciences node for mission products;
- [ESA Planetary Science Archive](https://archives.esac.esa.int/psa/);
- [JAXA DARTS](https://darts.isas.jaxa.jp/en) for Japanese astronomy and planetary mission archives;
- [NASA Earthdata Search](https://search.earthdata.nasa.gov/search) and the [Copernicus Data Space Browser](https://dataspace.copernicus.eu/browser/) for Earth reference and testing products;
- QGIS, an image editor, or Worldwright for authored 2:1 plates.

USGS documents the difference between locating PDS image data and ingesting it into ISIS in its [planetary image-data guide](https://astrogeology.usgs.gov/docs/getting-started/using-isis-first-steps/locating-and-ingesting-image-data/). KnowThing should eventually perform equivalent recorded processing rather than require every user to produce an untraceable PNG.

### What it unlocks

Orrery appearance, focused-globe imagery, raster tiles, and authored visual identity. It does not by itself provide terrain, clickable regions, physical material properties, or named geography.

## 3. Elevation, Topography, and Bathymetry

### What it represents

Numeric height relative to a declared reference, including solid-surface topography, ocean-floor bathymetry, or explicitly relative authored relief.

### Preferred handoff

- single- or multi-band GeoTIFF/COG;
- PDS4-labelled raster or mission-derived digital terrain model;
- a grayscale image only through the quick lane, explicitly classified as relative rather than measured.

### A valid measured product looks like

- numeric samples rather than shaded colours;
- horizontal coordinates and pixel registration;
- metres, kilometres, or another declared vertical unit;
- reference ellipsoid, geoid, mean radius, sea level, pressure level, or other datum;
- scale, offset, and no-data value;
- positive direction;
- horizontal and vertical resolution;
- coverage footprint and uncertainty when known.

### Bad lookalikes

- hillshade;
- contour drawing;
- hypsometric colour map without underlying values;
- a normal map;
- an eight-bit image claimed to contain measured heights without range, unit, or offset.

### Where to obtain or create it

- USGS Astropedia and NASA PDS Geosciences/Cartography products;
- NASA Earthdata for Earth digital elevation products;
- Copernicus DEM through the Copernicus Data Space;
- QGIS/GDAL export for authored or processed GeoTIFFs.

NASA recognizes GeoTIFF as a standard Earth-science distribution format used for imagery and digital elevation products. See the [NASA GeoTIFF standard](https://www.earthdata.nasa.gov/s3fs-public/imported/ESDS-RFC-040v1.1.pdf).

### What it unlocks

Terrain, physical displacement, height readout, slope/aspect derivations, contours, horizon calculations, and normal-map generation. Relative elevation can provide visual relief but must not enable physical distance claims.

## 4. Irregular Shape Models

### What it represents

The shape of an asteroid, comet, small moon, or other body that cannot be adequately represented by an ellipsoid plus height field.

### Preferred handoff

- SPICE Digital Shape Kernel (DSK) with associated frame and body metadata;
- a PDS4 shape-model product;
- OBJ or glTF/GLB for authored geometry when scale, frame, orientation, and authority are declared.

### A valid product looks like

- a complete or explicitly partial surface;
- consistent units and scale;
- a declared body-fixed frame and orientation;
- stated resolution and provenance;
- topology suitable for the intended geometry operations;
- texture-coordinate or surface-location mapping if imagery will be attached.

### Bad lookalikes

- a decorative model with arbitrary scale;
- a smoothed or decimated mesh presented as the untouched observation;
- a mesh with unknown axis orientation;
- a model whose material texture is the only remaining source of surface meaning.

### Where to obtain or create it

- NASA PDS Small Bodies and mission archives;
- NASA NAIF shape kernels;
- Blender or another mesh tool for authored bodies.

The [SPICE DSK subsystem](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/dsk.html) exists specifically to represent detailed shapes of planets, small bodies, local topography, and even artificial objects.

### What it unlocks

Irregular-body rendering, surface intersection, accurate local coordinates, illumination and horizon calculations. It does not automatically supply colour, geology, names, or terrain semantics.

## 5. Atmosphere, Climate, Weather, Ocean, and Ice Fields

### What it represents

Gridded or sampled physical variables that may depend on longitude, latitude, height or pressure, and time. Examples include temperature, pressure, wind, cloud fraction, aerosol optical depth, precipitation, ocean temperature, ice cover, and composition.

### Preferred handoff

- CF-conformant NetCDF;
- HDF5 with sufficient variable and coordinate metadata;
- PDS4 or provider-specific product bundles;
- GeoTIFF/COG for a well-defined two-dimensional snapshot.

### A valid multidimensional product looks like

- named variables with units and meaning;
- explicit longitude, latitude, vertical, and time coordinates where applicable;
- a declared calendar/time reference;
- dimensions and coordinate bounds;
- scale, offset, fill/no-data values, and valid ranges;
- whether values are observations, model output, climatology, or authored canon;
- pressure level, altitude, depth, or another vertical coordinate;
- spatial and temporal coverage.

The [CF metadata conventions](https://cfconventions.org/) are designed to identify physical variables and their spatial and temporal properties in NetCDF files. CF-style metadata should be preferred where it applies, then extended carefully for non-Earth bodies and setting calendars.

### Bad lookalikes

- a colour heat map without its numeric values and legend;
- a single cloud image with no observation time claimed as permanent climatology;
- cloud opacity treated as atmospheric composition;
- Earth-specific calendar or CRS assumptions silently applied to another world;
- a screenshot of a weather application.

### Where to obtain or create it

- NASA PDS Atmospheres and mission archives;
- ESA PSA and JAXA DARTS mission products;
- [NASA Earthdata Search](https://search.earthdata.nasa.gov/search);
- [NOAA NCEI Data Access](https://www.ncei.noaa.gov/access/search/) and its NetCDF/OPeNDAP services;
- [Copernicus Data Space](https://dataspace.copernicus.eu/) for Earth land, ocean, and atmosphere products;
- climate or circulation tools that export CF-NetCDF.

### What it unlocks

Scientific overlays, atmosphere inputs, cloud snapshots, weather/time controls, ocean and ice layers, and derived runtime visualizations. A single global temperature or pressure scalar remains useful body metadata but cannot substitute for a spatial field.

## 6. Geographic, Geological, and Categorical Features

### What it represents

Queryable point, line, and polygon features such as coastlines, rivers, drainage basins, geological units, impact sites, faults, plate boundaries, habitats, biomes, political areas, and named regions.

### Preferred handoff

- GeoPackage as the preferred portable vector container;
- GeoJSON for smaller interoperable layers;
- a complete Shapefile bundle, including `.shp`, `.shx`, `.dbf`, and `.prj` where present;
- a categorical raster mask only when the categories and value mapping are explicitly declared.

The [OGC GeoPackage standard](https://www.ogc.org/standards/geopackage/) defines a portable SQLite container for vector features, raster/imagery tile sets, and non-spatial tables. It is a strong default authored-world handoff without becoming KnowThing's live database.

### A valid vector layer looks like

- a declared body-fixed or local projected coordinate reference;
- stable source feature IDs where available;
- geometries of the expected type;
- meaningful typed attributes;
- antimeridian and polar behavior that can be validated;
- valid time or an explicit timeless/current interpretation;
- origin and authority;
- uncertainty or positional accuracy when known.

### Bad lookalikes

- SVG path strings with no coordinate interpretation;
- fill colours treated as permanent feature identity;
- a raster political map with no categorical legend;
- polygons automatically assumed to be countries;
- labels baked into geometry or imagery rather than retained as attributes.

### Where to obtain or create it

- QGIS and other GIS applications;
- [Natural Earth](https://www.naturalearthdata.com/downloads/) for public global Earth cultural, physical, and raster reference data;
- [OpenStreetMap export](https://www.openstreetmap.org/export) and appropriately licensed regional extracts;
- geological and scientific repositories;
- Worldwright, once it exports actual features rather than only palette-derived pixels.

QGIS reads and writes common GDAL/OGR formats including GeoPackage, Shapefile, GeoTIFF, PNG, and JPEG. See the [QGIS feature overview](https://docs.qgis.org/latest/en/docs/about/features.html).

### What it unlocks

Selection, search, labels, styling, thematic views, spatial queries, entity links, vector tiles, and history. It does not supply terrain or physical appearance unless separately provided.

## 7. Tectonic and Geological Reconstruction

### What it represents

Time-dependent geological features and the rotation/reconstruction model needed to place them at a declared geological time.

### Preferred handoff

- GPML feature collections plus the required rotation model and anchor/reference information;
- GPlates-compatible feature collections;
- GeoPackage/GeoJSON only for a fixed exported snapshot, with its reconstruction time recorded.

### A valid reconstruction product looks like

- stable plate and feature identifiers;
- feature types and geometries;
- valid time intervals;
- finite-rotation data and a declared anchor plate/reference frame;
- reconstruction method and tool/model version;
- linked citations and model authorship.

### Bad lookalikes

- a PNG drawing of plate boundaries claimed as a reconstructable model;
- polygons without a rotation file;
- a present-day snapshot claimed to encode geological history;
- a generated fantasy plate map treated as scientific evidence.

### Where to obtain or create it

- [GPlates and its sample/EarthByte-compatible data](https://www.gplates.org/download/);
- EarthByte published reconstruction models;
- authored work created in GPlates;
- [GPML](https://www.gplates.org/gpml/), the native GPlates plate-tectonics format.

### What it unlocks

Reconstructed plate boundaries and features at selected times, tectonic overlays, and reproducible geological snapshots. It does not automatically generate climate, elevation, coastlines, or canonical fictional geography.

## 8. Settlements, Landmarks, and Infrastructure

### What it represents

Named point, line, or polygon features connected to wiki entities: settlements, districts, facilities, ports, ruins, roads, rail, utilities, and landmarks.

### Preferred handoff

- GeoPackage or GeoJSON;
- CSV for point features with an explicit coordinate contract;
- a Worldwright or Planet Package manifest referencing the feature files.

### A valid settlement CSV looks like

```csv
id,name,longitude,latitude,valid_from,entity_key
capital-01,Aster Vale,142.502,-18.214,57-08-21,settlement:aster-vale
```

At minimum it needs a stable ID, coordinates, coordinate interpretation, and name or entity reference. Additional attributes remain typed fields rather than being encoded in marker colours.

### Bad lookalikes

- markers burned into the base map;
- a list of names with no coordinates;
- coordinates with unknown longitude direction or units;
- a new random feature identity on every import.

### Where to obtain or create it

- QGIS;
- OpenStreetMap and Natural Earth for Earth reference data;
- spreadsheets for simple point sets;
- Worldwright for authored worlds;
- existing wiki entities linked during import rather than duplicated.

### What it unlocks

Search, labels, feature/entity pages, focused views, local-space transitions, and future routing. It does not provide street detail or network connectivity unless those layers are supplied.

## 9. Networks and Routes

### What it represents

Topological systems such as roads, rail, rivers, shipping lanes, utilities, orbital services, or interstellar routes.

### Preferred handoff

- GeoPackage/GeoJSON containing explicit node and edge identities;
- tabular node/edge products with coordinates and stable keys;
- provider-native network extracts retained with their attributes.

### A valid network looks like

- stable node and edge IDs;
- directionality;
- geometry where applicable;
- declared connectivity rather than inferred visual crossings;
- costs, speeds, restrictions, or capacities only when genuinely supplied;
- valid time and owning spatial space;
- typed cross-space transitions where a route changes coordinate domains.

### Bad lookalikes

- unrelated line art treated as a routable graph;
- intersecting lines assumed to connect without a node;
- distances or travel times invented from display scale;
- one LineString pretending to continue through unrelated planetary and interstellar spaces.

### Where to obtain or create it

- QGIS and GIS/network-analysis tools;
- OpenStreetMap for Earth road and path data;
- authored tables or Worldwright exports for fictional settings.

### What it unlocks

Network visualization and, when explicit costs and topology exist, later routing. Initial Atlas work should preserve and validate topology before promising route solving.

## 10. Local Plans, Sites, and Interiors

### What it represents

Spatial data that belongs to a bounded local projected or schematic space rather than global latitude/longitude: cities, facilities, stations, habitats, ships, buildings, and interiors.

### Preferred handoff

- GeoPackage/GeoJSON in a declared local projected space;
- georeferenced raster plans;
- SVG or image plans only with explicit bounds and coordinate interpretation;
- later CAD/vector adapters where a stable open exchange path is justified.

### A valid local product looks like

- a declared planar extent, units, axes, and origin;
- an attachment to a parent surface feature or other Atlas space;
- known or explicitly approximate transformation to its parent;
- stable feature identities and scale;
- levels/floors represented explicitly when relevant.

### Bad lookalikes

- a floor-plan image presented as globally georeferenced;
- pixel coordinates silently treated as metres;
- a city schematic whose decorative scale is used for distance calculations.

### Where to obtain or create it

- QGIS for projected local maps;
- vector and image editors for declared schematic plans;
- authored Planet Packages and future Worldwright/local-space exports.

### What it unlocks

Region-to-city-to-site navigation and detailed local maps without forcing every space into planetary longitude and latitude.

## Authoring and Export Guidance

KnowThing should teach export from established tools rather than require a proprietary editor.

### QGIS

Recommended exports:

- GeoPackage for vector layers and portable feature tables;
- GeoJSON for small/simple vector exchanges;
- GeoTIFF/COG for georeferenced imagery and numeric rasters;
- CSV for point features only when the coordinate columns and reference are documented.

The guide should show how to inspect the CRS, choose a body-appropriate or explicitly custom coordinate definition, retain stable IDs, and avoid rasterizing semantic vectors.

### GPlates

Recommended exports:

- GPML feature collections and rotation models for reconstructable tectonics;
- GeoJSON/Shapefile/rasters only as recorded time-slice derivatives.

Do not ask users to flatten a reconstruction model into a single current image unless they explicitly need a non-reconstructable snapshot.

### Blender and mesh tools

Recommended exports:

- glTF/GLB or OBJ for authored shape geometry;
- a sidecar/manifest defining units, axes, origin, scale, and intended body-fixed orientation.

### Spreadsheets

Provide downloadable CSV templates for settlements, landmarks, observations, and simple network nodes/edges. Every template must use stable IDs and show coordinate/time fields.

### Worldwright

Worldwright should eventually export:

- the current 2:1 appearance plate;
- optional categorical masks with an explicit legend;
- actual vector features for regions and settlements;
- optional elevation as a declared relative or measured raster;
- a Planet Package manifest tying the products to one reference body and source lineage.

Worldwright output remains authored data. KnowThing does not relabel it as observation or scientific simulation.

## Provider Catalogue

Provider information belongs in structured application configuration so links, authentication requirements, native formats, supported targets, licenses, and integration capabilities can be maintained without changing every help page.

### Planetary and space-science providers

| Provider | Useful holdings | Integration notes |
|---|---|---|
| [NASA Planetary Data System](https://pds.nasa.gov/) | Mission imagery, geoscience, atmospheres, plasma, rings/moons, small bodies, SPICE products | Preserve PDS4 product grouping, XML labels, LID/LIDVID, processing level, and citation. PDS search also includes some internationally curated holdings. |
| [USGS Astropedia](https://astrogeology.usgs.gov/search/about) | Map-ready lunar and planetary geospatial products, mosaics, terrain, metadata, web services | Prefer for users seeking ready-to-map products; retain its source/product lineage. |
| [USGS ISIS](https://isis.astrogeology.usgs.gov/) | Calibration, sensor geometry, map projection, and processing for planetary mission data | Processing dependency in isolated workers, not a browser file format. Record ISIS and kernel versions and every parameter. |
| [ESA Planetary Science Archive](https://archives.esac.esa.int/psa/) | ESA planetary mission products | Preserve archive identifiers, product labels, mission/instrument metadata, and citations. |
| [JAXA DARTS](https://darts.isas.jaxa.jp/en) | Astronomy, lunar, and planetary mission data | Add provider adapters only through the generic asset contract. |
| [NASA NAIF](https://naif.jpl.nasa.gov/naif/data.html) | SPICE geometry, orientation, ephemeris, and shape kernels | Kernels are evidence/geometry inputs, not textures. Preserve kernel sets and versions together. |

PDS4 products consist of data objects and associated XML labels, grouped into products, collections, and bundles with stable identifiers. See [PDS4 training](https://pds.nasa.gov/datastandards/training/). An importer must not detach the convenient image from the metadata that makes it understandable.

### Earth reference and interoperability providers

Earth sources are valuable for testing the full Atlas workflow and for wikis that actually describe Earth. They must not make the internal model Earth-only.

| Provider | Useful holdings | Integration notes |
|---|---|---|
| [NASA Earthdata Search](https://search.earthdata.nasa.gov/search) | Imagery, elevation, atmosphere, ocean, land, cryosphere, and multidimensional products | Preserve collection/granule identity, temporal/spatial coverage, processing level, and original format. |
| [Copernicus Data Space](https://dataspace.copernicus.eu/) | Sentinel and contributing-mission land, ocean, and atmosphere products | The Browser provides visual search/download; APIs include catalogue, STAC, product download, and processing services. Account and license requirements must be shown. |
| [NOAA NCEI](https://www.ncei.noaa.gov/access/search/) | Historical weather, climate, oceanographic, geophysical, satellite, radar, and model data | Support NetCDF/OPeNDAP and documented CSV/GIS products through the generic variable/layer contract. |
| [Natural Earth](https://www.naturalearthdata.com/downloads/) | Public global physical, cultural, and raster reference layers at several map scales | Useful test and starter data; preserve scale and theme rather than treating it as street-level truth. |
| [OpenStreetMap](https://www.openstreetmap.org/export) | Collaborative settlements, roads, paths, land use, and other geographic features | Preserve source IDs, tags, attribution, and ODbL obligations; do not treat rendered map tiles as the underlying data. |
| [GPlates/EarthByte](https://www.gplates.org/download/) | Plate reconstruction software, sample data, and compatible published models | Import feature collections and rotation models together; record reconstruction time and tool/model versions. |

## In-Editor Guidance Contract

Each capability picker or import step should expose a compact help card generated from this catalogue.

Example:

```text
ELEVATION

Provides
Terrain, contours, and physical height measurements.

Best source
GeoTIFF/COG or a PDS-labelled digital terrain model.

Must identify
Units, vertical datum/reference level, no-data, scale and offset.

Good
Numeric height samples.

Not elevation
Hillshade, contour drawing, normal map, or coloured relief image.

Get or create it
USGS Astropedia | NASA PDS | Export from QGIS

Examples
Download valid sample | View common mistakes
```

The card must state what happens when the data is omitted. For elevation:

> The planet can still use a flat or illustrative overview. Physical terrain and height measurements remain unavailable.

## Inspection and Preview

Before publication, previews should help users verify meaning rather than merely admire appearance.

### Raster preview

- raw band/variable summary;
- histogram and numeric range;
- no-data coverage;
- spatial footprint;
- projection and seam;
- globe and flat views;
- nearest/bilinear/cubic resampling preview where relevant;
- colour-space or palette interpretation;
- time and level selection for multidimensional inputs.

### Vector preview

- feature count and geometry types;
- attribute schema and stable-ID candidate;
- invalid/self-intersecting geometry findings;
- poles and antimeridian behavior;
- sample labels/entity matches;
- time coverage and reconstruction state.

### Mesh preview

- bounding dimensions and units;
- axes, orientation, and origin;
- topology findings;
- declared versus detected scale;
- coverage and resolution;
- body/frame attachment.

## Validation Language

Validation must be actionable and lead to an acquisition or correction path.

Prefer:

- `This is a 2:1 image, but its longitude direction is unknown. Choose east-positive or west-positive.`
- `This GeoTIFF contains numeric elevation in metres but does not identify a vertical datum. It can be published as relative relief or held until a datum is supplied.`
- `This file appears to be hillshade. Attach it as cartographic imagery, or provide the underlying DEM for terrain.`
- `This NetCDF contains 18 variables and 240 time steps. Select the variable, vertical level, and time policy.`
- `This PDS XML label references two missing data objects. Upload the complete product.`
- `These GPML features require the referenced rotation model.`

Avoid:

- `Invalid file.`
- `Unsupported texture.`
- `Upload better data.`
- silently selecting the first band, variable, time, or coordinate convention.

## Provider Integrations

The first provider experience may be curated links and body/type-aware search guidance. Later integrations may accept a URL, DOI, PDS LIDVID, STAC item, or provider product identifier.

All provider imports must enter the same pipeline:

```text
provider record or authored upload
    -> immutable original asset/files
    -> inspected metadata
    -> declared interpretation
    -> semantic layer version
    -> recorded derivation
    -> runtime artifacts
    -> draft Atlas release
```

Provider adapters must not:

- create provider-specific layer tables;
- bypass license, provenance, validation, or review;
- retain only a browse image when the original product is accessible;
- assume the newest provider revision should silently replace a published release;
- scrape an interactive website when an official download/API/catalogue path exists.

## Licensing, Citation, and Access

The catalogue entry for every acquisition source must record:

- access URL and whether an account or API credential is required;
- provider, mission, instrument, dataset, collection, and product identifiers;
- license or terms URL;
- required attribution/citation;
- redistribution restrictions on originals and derivatives;
- retrieval date and provider revision;
- whether public runtime artifacts may expose source pixels or metadata.

Do not assume that free download means unrestricted redistribution. Do not copy provider attribution only into prose; bind it to the asset and published release.

## Fixtures and Templates

Every **Supported** catalogue entry must ship with:

- the smallest useful valid fixture;
- a realistic provider-derived fixture where licensing permits repository storage;
- one missing-metadata fixture;
- one misleading lookalike;
- one corrupt or incomplete multi-file product;
- an expected inspection report;
- an expected derivation manifest;
- screenshots of flat/globe preview where visual review matters.

Downloadable author templates should initially include:

- 2:1 appearance plate;
- relative elevation plate plus sidecar interpretation;
- settlement CSV;
- region GeoPackage or GeoJSON;
- categorical mask and legend;
- Planet Package manifest.

## Implemented Reference Fixture: Mars

The built-in Solar System preset now uses Mars as the first provider-derived acquisition fixture. Its machine-readable package is served from `/seed-data/rodder/mars/manifest.json`, and `npm run seed:assets:mars` reproducibly fetches and validates the upstream products before rebuilding the runtime plates.

The fixture deliberately separates three products that all resemble “a map of Mars”:

| Product | Meaning | Current handoff |
|---|---|---|
| USGS Viking MDIM 2.1 colorized mosaic | Controlled global surface appearance; not calibrated intrinsic reflectance | Installed as the 4096 × 2048 sRGB appearance channel |
| NASA PDS MGS MOLA MEGDR | Measured median topography in metres above the GMM3 areoid | Installed as a 4096 × 2048 linear overview elevation channel; the PDS label and physical sample encoding are retained |
| USGS MGS TES bolometric albedo | Measured Lambert albedo over the TES visible/near-IR bolometer range | Catalogued with a 16-bit analytical derivative, but not bound as sRGB appearance because doing so would make Mars falsely grey |

The package also retains the IAU Mars frame and triaxial radii from the NASA NAIF `pck00011.tpc` kernel, JPL physical parameters, JPL J2000 approximate orbital orientation, source URLs, source and derivative hashes, coordinate conventions, measurement ranges, licenses, and derivation notes. The preset does not apply J2000 mean anomaly to KnowThing day zero because the wiki calendar epoch is not J2000.

Only appearance and elevation enter the authored material bindings. Roughness stays constant; the renderer now derives a normal channel from procedural or supplied overview elevation rather than treating a normal map as authored evidence. Clouds and dust remain unavailable rather than becoming a timeless fake opacity map; TES remains analytical data; geology and nomenclature remain future Atlas vector layers. This is the expected pattern for homework-aware ingest: install what the current product can interpret honestly, retain the evidence needed to improve it, and name every unavailable capability.

This fixture is not yet the general scientific ingest system. The large upstream image products remain provider-hosted and hash-pinned rather than being stored as first-class immutable source assets. That limitation should be removed by the source/asset/derivation/release work described in the delivery sequence below.

## Delivery Sequence

### Phase 0: Catalogue foundation

- Store catalogue entries as structured application definitions rather than prose only.
- Add user-facing capability, format, metadata, example, source, and omission guidance.
- Mark current direct images as the quick lane.
- Add valid and misleading fixtures for each current material channel.

### Phase 1: Body reference and direct-image guidance

- Define body-fixed reference and reference-level vocabulary.
- Add seam/orientation examples and previews.
- Distinguish authored colour, reflectance, radiance, false colour, and cartographic imagery.
- Link provider search guidance by body and capability.

### Phase 2: GIS vertical slice

- Support GeoTIFF/COG elevation and imagery inspection.
- Support GeoPackage/GeoJSON boundaries and settlement CSV.
- Add QGIS export guides and downloadable templates.
- Publish one body with appearance, elevation, a boundary, and settlements.

### Phase 3: Planetary archive products

- Group PDS4 labels and data objects as one asset.
- Preserve LIDVID, mission, instrument, processing level, and citations.
- Add ISIS/GDAL derivations in isolated workers.
- Add body/type-aware PDS and Astropedia acquisition guidance, followed by catalogue integration.

### Phase 4: Multidimensional and dynamic data

- Add CF-NetCDF/HDF5 inspection.
- Add variable, level, time, calendar, and aggregation selection.
- Add atmosphere, cloud, ocean, ice, and physical-field layer types.

### Phase 5: Shapes, tectonics, and broader integrations

- Add SPICE DSK/PDS shape-model import.
- Add GPML plus rotation-model ingest and reconstruction.
- Add STAC/provider adapters through the common asset contract.
- Add authored Planet Package import/export.

## Acceptance Criteria

The acquisition system is successful when:

- every public data capability says what it means, what it unlocks, and what remains unavailable without it;
- every Supported data type has a realistic download or export path and the complete fixture/documentation contract;
- the user can view a valid example before uploading;
- common misleading files are recognized and redirected to the correct semantic role;
- original provider products remain byte-for-byte recoverable with their metadata and stable identifiers;
- multi-file products cannot be silently accepted with missing components;
- provider integrations and manual uploads create the same asset/layer/release records;
- a QGIS user can export ordinary files without learning a proprietary KnowThing geometry format;
- a PDS user can provide an original labelled product without first flattening it into PNG;
- a casual author can stop at one appearance image without being forced into GIS;
- an advanced author can supply higher-quality or more complete data without it being simplified into the quick lane;
- guidance states account, license, citation, and redistribution requirements before import;
- fixtures verify inspection, ambiguity, validation, derivation, and publication for each Supported family; narrower maintainer tools remain explicitly labelled.

## Explicit Non-Goals

This catalogue does not promise:

- that every file advertised by a provider can be rendered directly;
- automatic scientific interpretation of unlabeled or ambiguous data;
- a browser replacement for QGIS, ISIS, GPlates, or climate-analysis software;
- automatic generation of missing geography, geology, climate, settlements, or history;
- that Earth formats and EPSG identifiers apply unchanged to every body;
- that a visually attractive image is physically or cartographically meaningful;
- immediate direct integrations with every listed provider.

The successful outcome is that users know what useful planetary data looks like, can realistically obtain or export it, can give it to KnowThing without destructive pre-processing, and can see exactly what it contributes to the resulting planet and Atlas.
