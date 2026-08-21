# ADR 0002: Direct Feature Capability Boundaries

**Status:** Accepted  
**Decision date:** 21 August 2026

KnowThing features expose concrete capability modules from `feature/<name>/public/`. Public files contain the implementation or contract they name; features do not use index barrels, wildcard exports, or forwarding facades.

Dependencies point from routes and composition into public feature capabilities, then into private application/domain and server adapters. Cross-feature imports must target `public/`. Shared platform code—including the parser, renderer, transport, database, utilities, and generic components—must not import features. Composition is the only layer allowed to assemble multiple feature capabilities.

Feature domain and application code is independent of SvelteKit and Drizzle. HTTP translation belongs to routes and transport adapters; persistence belongs to private server adapters. The Drizzle schema manifest and immutable runtime registries are explicit aggregation mechanisms, not general import APIs.
