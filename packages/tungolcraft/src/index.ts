/**
 * Tungolcraft — a generative astrophysics engine for worldbuilding.
 *
 * Where an ephemeris library describes the sky that exists, Tungolcraft builds
 * skies that don't: derive a body's full physical/orbital profile from partial
 * inputs, validate whether an invented system would physically hold together,
 * and place bodies along their orbits over time.
 *
 * Public surface:
 *   constants — SI reference constants and scales
 *   physics   — closed-form derivations (numbers in, numbers out)
 *   format    — human-readable formatters over those numbers
 *   derive    — partial-in → complete-out convenience derivations
 *   models    — whole-body models (deriveBody / deriveStar)
 *   orbit     — two-body position (mean anomaly + Kepler solver)
 *   validate  — plausibility/consistency checks
 */

export * from './constants.js'
export * from './physics.js'
export * from './format.js'
export * from './derive.js'
export * from './models.js'
export * from './orbit.js'
export * from './validate.js'
