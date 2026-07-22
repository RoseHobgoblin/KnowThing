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
	AU_M, SOLAR_MASS_KG, EARTH_MASS_KG, JUPITER_MASS_KG,
	SOLAR_RADIUS_M, EARTH_RADIUS_M, JUPITER_RADIUS_M, SOLAR_LUMINOSITY,
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

// ---- Constructors: tag a raw SI number as the given quantity ----
export const kg = (n: number): Kilograms => n as Kilograms
export const m = (n: number): Metres => n as Metres
export const au = (n: number): AstronomicalUnits => n as AstronomicalUnits
export const seconds = (n: number): Seconds => n as Seconds
export const days = (n: number): Days => n as Days
export const kelvin = (n: number): Kelvin => n as Kelvin
export const watts = (n: number): Watts => n as Watts

// ---- Human-scale constructors: reference units → SI quantity ----
export const solarMasses = (n: number): Kilograms => (n * SOLAR_MASS_KG) as Kilograms
export const earthMasses = (n: number): Kilograms => (n * EARTH_MASS_KG) as Kilograms
export const jupiterMasses = (n: number): Kilograms => (n * JUPITER_MASS_KG) as Kilograms
export const solarRadii = (n: number): Metres => (n * SOLAR_RADIUS_M) as Metres
export const earthRadii = (n: number): Metres => (n * EARTH_RADIUS_M) as Metres
export const jupiterRadii = (n: number): Metres => (n * JUPITER_RADIUS_M) as Metres
export const solarLuminosities = (n: number): Watts => (n * SOLAR_LUMINOSITY) as Watts

// ---- Conversions between SI quantities ----
export const auToMetres = (a: AstronomicalUnits): Metres => (a * AU_M) as Metres
export const metresToAu = (x: Metres): AstronomicalUnits => (x / AU_M) as AstronomicalUnits
export const daysToSeconds = (d: Days): Seconds => (d * 86_400) as Seconds
export const secondsToDays = (s: Seconds): Days => (s / 86_400) as Days
