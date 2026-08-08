# Focused planetary viewer spike

Run from the repository root with `npx vite spikes/planetary-viewers` and open the printed local URL.

This harness is intentionally outside the application bundle. It presents the same Mars and fictional-sphere fixtures through Cesium and MapLibre, exercises selection and teardown, and exposes the proposed Orrery return state as JSON. It uses pinned CDN builds only to make the disposable comparison repeatable; these versions are not an application dependency decision.

The spike confirmed the decisive difference: Cesium accepts a custom ellipsoid for the actual globe, camera, and Cartesian conversion. MapLibre can display the same longitude/latitude features and tiles, but its globe/projection remains Earth-shaped. The accompanying ADR chooses Cesium for the first focused globe while retaining application-owned handoff state and leaving a future flat 2D view free to use MapLibre.
