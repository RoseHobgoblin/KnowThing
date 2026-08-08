# ADR 0001: Planetary CRS and focused viewer

- Status: Accepted for implementation direction; production adoption remains gated
- Decision date: 2026-08-08
- Review trigger: first Atlas schema migration or focused-viewer production work
- Maturity: experimental spike evidence

## Decision

Use an application-owned CRS identity (`authority`, stable key, body, frame, latitude type, longitude direction) that is distinct from a database SRID. When Atlas needs spatial storage, use PostGIS geometry scoped to a celestial space and private `KNOWTHING` SRIDs. Never borrow an Earth EPSG identifier for a planet or fictional world.

Choose Cesium for the first focused planetary globe because its globe and coordinate conversion can use a non-Earth ellipsoid. Keep Orrery/Atlas selection, time, and navigation state outside the viewer. The minimum handoff contains body identity, absolute day, selected feature, incoming direction, and return-camera state. MapLibre remains a candidate for a later flat/tile-oriented companion, not the first non-Earth globe.

## Evidence

The disposable PostGIS harness passed custom WKT2 registration, Mars geographic/projected round trips, antimeridian and polar validity/query checks, GiST indexing, MVT generation, cross-body rejection, and dump/restore using `postgis/postgis:16-3.5-alpine`. Mars, a fictional sphere, and a local planar space remained explicitly scoped.

The dual viewer harness used the same Mars and fictional fixtures. Cesium accepted each body's radii for its globe and Cartesian conversion. MapLibre rendered and picked the longitude/latitude fixtures but its globe remained Earth-shaped. Both could keep labels and controls in accessible DOM and could be disposed cleanly; neither owns the application handoff contract.

## Consequences

- The normal development and production database images remain `postgres:16-alpine` until an Atlas implementation requires spatial storage.
- No Atlas tables are introduced by this ADR.
- `geometry` is the default storage type. `geography` is not assumed because its Earth-oriented semantics and spheroid expectations are inappropriate as a universal multi-body abstraction.
- Transformations are allowed only between registered coordinate systems for the same body/frame. Cross-body transformation is an application error.
- Cesium must be dynamically imported and self-hosted before production. Bundle weight, worker assets, imagery policy, and accessible fallback remain explicit delivery work.
- If a future PostGIS/PROJ upgrade breaks a planetary transform, authoritative source coordinates remain stored in their body-fixed space and controlled GDAL/PROJ derivations are rebuilt; assigning a fake EPSG code is never the fallback.
