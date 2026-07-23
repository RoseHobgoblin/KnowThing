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
| `physics` | Closed-form derivations: density, surface gravity, escape velocity, rotational break-up period, Kepler-III period, mean orbital speed + vis-viva speed-at-radius, Hill sphere, empirical satellite-stability limits, barycenter geometry, rigid/fluid Roche limit, habitable zone, luminosity. |
| `derive` | Partial-in → complete-out convenience: give what you know, get the rest. |
| `orbit` | Validated two-body propagation: mean anomaly, safeguarded Kepler solver, mean motion, and classical elements → position/velocity state vector at a true anomaly or an epoch. |
| `validate` | The consistency engine: equation-backed warnings on suspicious configs (spin past the density-set break-up period, barycenter outside the parent, orbit past a published empirical satellite-stability limit, radial-band crossings, a "cool O-star", super-Eddington mass). |
| `format` | Human-readable strings (g/cm³, M☉, km/s, …) over the pure numbers. |
| `constants` | SI reference constants and scales. |

## Example

```ts
import {
  au,
  computeOrbitalPeriodDays,
  NOMINAL_SOLAR_GM,
  validateBodyPhysics,
} from 'tungolcraft'

// Kepler III: an Earth-distance planet around a Sun-mass star
computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM) // ≈ 365 days

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
calendar synthesis, and N-body dynamics are outside its current model.

## Direction

- [Scientific-readiness roadmap](./docs/SCIENTIFIC-READINESS.md)
- [Theoretical-modelling specification](./docs/THEORETICAL-MODELLING-SPEC.md)
