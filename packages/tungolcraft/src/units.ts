/**
 * Units — branded SI quantity types and the single home for every conversion.
 *
 * Each quantity (Kilograms, Metres, AU, …) is a `number` tagged with a phantom
 * unit, so at runtime it is just a number (arithmetic and Math.* work as normal)
 * but at compile time the wrong unit is a type error: you cannot pass Metres
 * where Kilograms is expected, nor a bare `number` where a quantity is required.
 *
 * A branded value is still assignable *to* a plain `number` — only the reverse
 * is blocked — so results flow into loose formatters and callers without fuss.
 *
 * Use the constructors (`kg`, `m`, `au`, …) to tag a raw SI number, the
 * human-scale helpers (`solarMasses`, `earthRadii`, …) to enter reference units,
 * and the conversions (`auToMetres`, `daysToSeconds`, …) to move between units.
 */

import {
	G, AU_M, SOLAR_MASS_KG, EARTH_MASS_KG, JUPITER_MASS_KG,
	SOLAR_RADIUS_M, EARTH_RADIUS_M, JUPITER_RADIUS_M, SOLAR_LUMINOSITY,
	NOMINAL_SOLAR_GM, NOMINAL_TERRESTRIAL_GM, NOMINAL_JOVIAN_GM,
} from './constants.js'

declare const unit: unique symbol
/** A `number` nominally tagged with a unit — the same at runtime, distinct at compile time. */
export type Quantity<Tag extends string> = number & { readonly [unit]: Tag }

export type Kilograms = Quantity<'kg'>
export type Metres = Quantity<'m'>
export type AstronomicalUnits = Quantity<'AU'>
export type Seconds = Quantity<'s'>
export type Days = Quantity<'day'>
export type Kelvin = Quantity<'K'>
export type Watts = Quantity<'W'>
export type MetresPerSecond = Quantity<'m/s'>
export type MetresPerSecondSquared = Quantity<'m/s^2'>
export type KgPerCubicMetre = Quantity<'kg/m^3'>
/** Standard gravitational parameter μ = GM (m³ s⁻²) — the mass a two-body orbit responds to. */
export type GravitationalParameter = Quantity<'m^3/s^2'>

// ---- Constructors: tag a raw SI number as the given quantity ----
export const kg = (n: number): Kilograms => n as Kilograms
export const m = (n: number): Metres => n as Metres
export const au = (n: number): AstronomicalUnits => n as AstronomicalUnits
export const seconds = (n: number): Seconds => n as Seconds
export const days = (n: number): Days => n as Days
export const kelvin = (n: number): Kelvin => n as Kelvin
export const watts = (n: number): Watts => n as Watts
export const mu = (n: number): GravitationalParameter => n as GravitationalParameter

// ---- Standard gravitational parameter μ = GM ----

/**
 * μ = GM from a mass — the general route for an arbitrary (invented) body. Uses
 * measured G. IAU nominal GM constants are exact conversion factors for values
 * expressed in nominal solar/terrestrial/jovian units; they are not measured
 * present-day body parameters.
 */
export const muFromMass = (massKg: Kilograms): GravitationalParameter => (G * massKg) as GravitationalParameter

/**
 * Total μ of a system — the two-body parameter is μ₁ + μ₂ = G(M + m). Sum every
 * partner's μ (both stars of a pair, a planet and its star, all stars of a
 * barycenter) to get the μ that governs the orbit's period.
 */
export const addMu = (...mus: GravitationalParameter[]): GravitationalParameter =>
	mus.reduce((total, mu) => total + mu, 0) as GravitationalParameter

// ---- Human-scale constructors: reference units → SI quantity ----
export const solarMasses = (n: number): Kilograms => (n * SOLAR_MASS_KG) as Kilograms
export const earthMasses = (n: number): Kilograms => (n * EARTH_MASS_KG) as Kilograms
export const jupiterMasses = (n: number): Kilograms => (n * JUPITER_MASS_KG) as Kilograms
export const solarRadii = (n: number): Metres => (n * SOLAR_RADIUS_M) as Metres
export const earthRadii = (n: number): Metres => (n * EARTH_RADIUS_M) as Metres
export const jupiterRadii = (n: number): Metres => (n * JUPITER_RADIUS_M) as Metres
export const solarLuminosities = (n: number): Watts => (n * SOLAR_LUMINOSITY) as Watts
// μ in exact IAU nominal-unit multiples (conversion factors, not body measurements).
export const solarGm = (n: number): GravitationalParameter => (n * NOMINAL_SOLAR_GM) as GravitationalParameter
export const earthGm = (n: number): GravitationalParameter => (n * NOMINAL_TERRESTRIAL_GM) as GravitationalParameter
export const jupiterGm = (n: number): GravitationalParameter => (n * NOMINAL_JOVIAN_GM) as GravitationalParameter

// ---- Conversions between SI quantities ----
export const auToMetres = (a: AstronomicalUnits): Metres => (a * AU_M) as Metres
export const metresToAu = (x: Metres): AstronomicalUnits => (x / AU_M) as AstronomicalUnits
export const daysToSeconds = (d: Days): Seconds => (d * 86_400) as Seconds
export const secondsToDays = (s: Seconds): Days => (s / 86_400) as Days
