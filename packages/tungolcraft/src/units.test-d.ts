/**
 * Compile-time unit-safety assertions. Not run by Vitest — validated by
 * `npm run typecheck` (tsc). Each `@ts-expect-error` line asserts that a unit
 * mixup is REJECTED; if the compiler ever stops catching one, tsc fails on the
 * now-unused directive. Keep this file green to keep the unit system honest.
 */

import {
	kg, m, au, kelvin, watts, solarMasses,
	computeDensity, computeOrbitalPeriodDays, computeLuminosity, computeHabitableZoneAu,
	star,
} from './index.js'

// ---- Correct usage type-checks ----
computeDensity(kg(5.972e24), m(6.371e6))
computeOrbitalPeriodDays(au(1), kg(1.989e30))
computeLuminosity(m(6.9634e8), kelvin(5778))
computeHabitableZoneAu(watts(3.828e26))

// ---- Mixups are rejected at compile time ----

// @ts-expect-error mass and radius swapped (Kilograms vs Metres)
computeDensity(m(6.371e6), kg(5.972e24))

// @ts-expect-error bare numbers are not accepted where a quantity is required
computeDensity(5.972e24, 6.371e6)

// @ts-expect-error AU passed where Kelvin is expected
computeLuminosity(m(6.9634e8), au(1))

// @ts-expect-error semi-major axis and parent mass swapped (AU vs Kilograms)
computeOrbitalPeriodDays(kg(1.989e30), au(1))

// @ts-expect-error a raw luminosity number is not Watts
computeHabitableZoneAu(3.828e26)

// ---- The builder API's friendly fields are unit-safe too ----

// Correct: reference-unit constructors satisfy the branded input fields.
star({ name: 'Sol', mass: solarMasses(1), temperature: kelvin(5778) })

// @ts-expect-error a bare number is not accepted for `mass`
star({ name: 'Sol', mass: 1.989e30 })

// @ts-expect-error AU passed where the star's mass (Kilograms) is expected
star({ name: 'Sol', mass: au(1) })
