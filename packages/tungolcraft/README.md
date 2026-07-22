# tungolcraft

A generative astrophysics engine for **worldbuilding** — not an ephemeris.

Where a library like [astronomy-engine](https://www.npmjs.com/package/astronomy-engine)
answers *"where is the real Mars in the sky tonight?"*, Tungolcraft answers a
different question: *"I invented this star and these planets — do the numbers
hold together, and what follows from them?"* It works on **arbitrary invented
bodies**, which a real-sky ephemeris structurally cannot.

Zero runtime dependencies. Pure functions. SI units in, SI units out (with an
optional formatting layer).

## What's inside

| Module | Purpose |
| --- | --- |
| `physics` | Closed-form derivations: density, surface gravity, escape velocity, Kepler-III period, orbital velocity, Hill sphere, Roche limit, habitable zone, luminosity. |
| `derive` | Partial-in → complete-out convenience: give what you know, get the rest. |
| `orbit` | Two-body position over time — mean anomaly + Newton–Raphson Kepler solver. |
| `validate` | The consistency engine: warns on impossible/suspicious configs (moon beyond its Hill sphere, crossing orbits, a "cool O-star", super-Eddington mass). |
| `format` | Human-readable strings (g/cm³, M☉, km/s, …) over the pure numbers. |
| `constants` | SI reference constants and scales. |

## Example

```ts
import { computeOrbitalPeriodDays, validateBodyPhysics, SOLAR_MASS_KG } from 'tungolcraft'

// Kepler III: an Earth-distance planet around a Sun-mass star
computeOrbitalPeriodDays(1, SOLAR_MASS_KG) // ≈ 365 days

// Is this invented moon physically bound to its planet?
validateBodyPhysics({
  massKg: null, radiusM: null, orbitalPeriodDays: null,
  semiMajorAxisAu: 0.05, eccentricity: null, rotationPeriodS: null,
  axialTilt: null, bodyType: 'moon', isSatellite: true, parentHillAu: 0.01,
})
// → [{ field: 'semiMajorAxisAu', severity: 'warning', message: '…beyond the parent's Hill sphere…' }]
```

## Status

Early extraction from the [KnowThing](https://github.com/) celestial engine.
The numeric core is stable and unit-tested; procedural system generation,
calendar synthesis, and 3D Keplerian elements are on the roadmap.
