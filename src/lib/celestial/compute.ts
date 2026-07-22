/**
 * Re-export shim: the celestial physics/formatting core now lives in the
 * `tungolcraft` package (packages/tungolcraft). This file keeps existing
 * `./compute.js` imports working while the package is dogfooded in place.
 *
 * New code should import from `tungolcraft` directly; this shim will be removed
 * once the remaining import sites are repointed.
 */
export * from 'tungolcraft'
