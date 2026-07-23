/**
 * Compile-time unit-safety assertions. Not run by Vitest — validated by
 * `npm run typecheck` (tsc). Each `@ts-expect-error` line asserts that a unit
 * mixup is REJECTED; if the compiler ever stops catching one, tsc fails on the
 * now-unused directive. Keep this file green to keep the unit system honest.
 */

import {
	kg, m, au, days, kelvin, watts, solarMasses, muFromMass, solarGm,
	computeDensity, computeOrbitalPeriodDays, computeMeanOrbitalSpeed, computeOrbitalSpeedAtRadius,
	computeCircularOrbitSpeed, computeLuminosity, computeHabitableZoneAu,
	star,
} from './index.js'

// ---- Correct usage type-checks ----
computeDensity(kg(5.972e24), m(6.371e6))
computeOrbitalPeriodDays(au(1), muFromMass(kg(1.989e30)))
computeOrbitalPeriodDays(au(1), solarGm(1))
computeMeanOrbitalSpeed(au(1), days(365.25))
computeMeanOrbitalSpeed(au(1), days(365.25), 0.1)
computeOrbitalSpeedAtRadius(solarGm(1), au(0.9), au(1))
computeCircularOrbitSpeed(solarGm(1), au(1))
computeLuminosity(m(6.9634e8), kelvin(5778))
computeHabitableZoneAu(watts(3.828e26))

// ---- Mixups are rejected at compile time ----

// @ts-expect-error mass and radius swapped (Kilograms vs Metres)
computeDensity(m(6.371e6), kg(5.972e24))

// @ts-expect-error bare numbers are not accepted where a quantity is required
computeDensity(5.972e24, 6.371e6)

// @ts-expect-error AU passed where Kelvin is expected
computeLuminosity(m(6.9634e8), au(1))

// @ts-expect-error semi-major axis and μ swapped (AU vs GravitationalParameter)
computeOrbitalPeriodDays(muFromMass(kg(1.989e30)), au(1))

// @ts-expect-error a raw mass is not a gravitational parameter — must go through muFromMass
computeOrbitalPeriodDays(au(1), kg(1.989e30))

// @ts-expect-error mean orbital speed takes (AU, Days) — a and T must not be swapped
computeMeanOrbitalSpeed(days(365.25), au(1))

// @ts-expect-error vis-viva needs μ first, not an AU where the gravitational parameter belongs
computeOrbitalSpeedAtRadius(au(1), au(1), au(1))

// @ts-expect-error circular speed needs μ first, not an AU
computeCircularOrbitSpeed(au(1), au(1))

// @ts-expect-error a raw luminosity number is not Watts
computeHabitableZoneAu(3.828e26)

// ---- The builder API's friendly fields are unit-safe too ----

// Correct: reference-unit constructors satisfy the branded input fields.
star({ name: 'Sol', mass: solarMasses(1), temperature: kelvin(5778) })

// @ts-expect-error a bare number is not accepted for `mass`
star({ name: 'Sol', mass: 1.989e30 })

// @ts-expect-error AU passed where the star's mass (Kilograms) is expected
star({ name: 'Sol', mass: au(1) })
