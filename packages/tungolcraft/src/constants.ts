/**
 * Physical constants and reference scales, in SI units (kg, m, s).
 *
 * Exported as part of the public API — a worldbuilding engine wants these on
 * hand (e.g. "give me 2.3 solar masses in kg"). The reference-scale values are
 * branded with their unit (see `units`), so `computeDensity(SOLAR_MASS_KG, …)`
 * type-checks while a bare number does not. `G` and the Stefan-Boltzmann
 * constant carry compound units and stay plain numbers.
 */

import type { Kilograms, Metres, Watts, GravitationalParameter } from './units.js'

/** Gravitational constant (m³ kg⁻¹ s⁻²). */
export const G = 6.674_30e-11
/** One astronomical unit in metres. */
export const AU_M = 1.495_978_707e11 as Metres
/** Stefan–Boltzmann constant (W m⁻² K⁻⁴). */
export const STEFAN_BOLTZMANN = 5.670_374_419e-8
/** Solar luminosity (W). */
export const SOLAR_LUMINOSITY = 3.828e26 as Watts

/**
 * IAU 2015 Resolution B3 nominal standard gravitational parameters GM (m³ s⁻²).
 *
 * GM is measured far more precisely than G and a body's mass separately, so these
 * nominal products — not `G × (a rounded mass)` — are the accurate anchors for
 * solar-system-scaled bodies. Feed them (or `muFromMass` for an arbitrary invented
 * mass) as the μ argument to `computeOrbitalPeriodDays`. See the B3 conversion
 * table: https://www.iau.org/static/resolutions/IAU2015_English.pdf
 */
export const NOMINAL_SOLAR_GM = 1.327_124_4e20 as GravitationalParameter
export const NOMINAL_TERRESTRIAL_GM = 3.986_004e14 as GravitationalParameter
export const NOMINAL_JOVIAN_GM = 1.266_865_3e17 as GravitationalParameter

export const EARTH_MASS_KG = 5.972e24 as Kilograms
export const JUPITER_MASS_KG = 1.898e27 as Kilograms
export const SOLAR_MASS_KG = 1.989e30 as Kilograms
export const EARTH_RADIUS_M = 6.371e6 as Metres
export const JUPITER_RADIUS_M = 6.9911e7 as Metres
export const SOLAR_RADIUS_M = 6.9634e8 as Metres
