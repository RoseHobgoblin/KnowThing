/**
 * Tungolcraft — a generative astrophysics engine for worldbuilding.
 *
 * Where an ephemeris library describes the sky that exists, Tungolcraft builds
 * skies that don't: derive a body's full physical/orbital profile from partial
 * inputs, validate whether an invented system would physically hold together,
 * and place bodies along their orbits over time.
 *
 * Public surface:
 *   units     — branded SI quantity types, constructors, and conversions
 *   constants — SI reference constants and scales
 *   physics   — closed-form derivations (branded quantities in and out)
 *   format    — human-readable formatters over those numbers
 *   derive    — partial-in → complete-out convenience derivations
 *   models          — whole-body models from raw-SI rows (deriveBody / deriveStar)
 *   build           — friendly, unit-safe authoring API (body / star)
 *   effective-orbits — fill missing orbital periods across a system's rows
 *   orbit           — two-body position (mean anomaly + Kepler solver)
 *   validate        — plausibility/consistency checks
 */

export * from './units.js'
export * from './constants.js'
export * from './physics.js'
export * from './format.js'
export * from './derive.js'
export * from './models.js'
export * from './build.js'
export * from './effective-orbits.js'
export * from './orbit.js'
export * from './validate.js'
export * from './model-types.js'
export * from './model-registry.js'
export * from './catalogue.js'
export * from './catalogue-runner.js'
export * from './scenario-types.js'
export * from './scenario.js'
export * from './binary-coordinates.js'
export * from './benchmarks.js'
export * from './uncertainty.js'
export * from './model-packs.js'
export * from './external-adapter-types.js'
export * from './external-adapters.js'
