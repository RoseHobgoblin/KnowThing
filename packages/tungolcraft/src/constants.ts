/**
 * Physical constants and reference scales, in SI units (kg, m, s).
 *
 * Exported as part of the public API — a worldbuilding engine wants these on
 * hand (e.g. "give me 2.3 solar masses in kg"). All physics in this package is
 * computed in SI internally; the `format` module scales to human units.
 */

/** Gravitational constant (m³ kg⁻¹ s⁻²). */
export const G = 6.674_30e-11
/** One astronomical unit in metres. */
export const AU_M = 1.495_978_707e11
/** Stefan–Boltzmann constant (W m⁻² K⁻⁴). */
export const STEFAN_BOLTZMANN = 5.670_374_419e-8
/** Solar luminosity (W). */
export const SOLAR_LUMINOSITY = 3.828e26

export const EARTH_MASS_KG = 5.972e24
export const JUPITER_MASS_KG = 1.898e27
export const SOLAR_MASS_KG = 1.989e30
export const EARTH_RADIUS_M = 6.371e6
export const JUPITER_RADIUS_M = 6.9911e7
export const SOLAR_RADIUS_M = 6.9634e8
