# tungolcraft

An explainable astrophysics modelling toolkit for arbitrary celestial systems.

Where a library like [astronomy-engine](https://www.npmjs.com/package/astronomy-engine)
answers *"where is the real Mars in the sky tonight?"*, Tungolcraft answers a
different question: *"I invented this star and these planets — do the numbers
hold together, and what follows from them?"* It works on **arbitrary invented
bodies**, which a real-sky ephemeris structurally cannot.

Zero runtime dependencies. Pure functions. SI units in, SI units out (with an
optional formatting layer).

## Install

```sh
npm install tungolcraft
```

Tungolcraft is an ES module and publishes compiled JavaScript with TypeScript
declarations.

## What's inside

| Module | Purpose |
| --- | --- |
| `physics` | Closed-form derivations: density, surface gravity, escape velocity, rotational break-up period, Kepler-III period, mean orbital speed + vis-viva speed-at-radius, Hill sphere, empirical satellite-stability limits, barycenter geometry, rigid/fluid Roche limit, habitable zone, luminosity. |
| `derive` | Partial-in → complete-out convenience: give what you know, get the rest. |
| `orbit` | Validated two-body propagation: mean anomaly, safeguarded Kepler solver, mean motion, and classical elements → position/velocity state vector at a true anomaly or an epoch. |
| `validate` | The consistency engine: equation-backed warnings on suspicious configs (spin past the density-set break-up period, barycenter outside the parent, orbit past a published empirical satellite-stability limit, radial-band crossings, a "cool O-star", super-Eddington mass). |
| `model-registry` | Stable model IDs, scientific-model versions, provenance, assumptions and validity domains. |
| `catalogue` | Non-throwing, explainable evaluations with runtime units, structured diagnostics, applied defaults and numerical quality. |
| `scenario` | Versioned scientific bodies, explicit time/frames/axis semantics, graph validation and JSON interchange. |
| `binary-coordinates` | Overflow-resistant relative-axis and relative-state conversions into barycentric component coordinates. |
| `benchmarks` | Version-locked scientific fixtures, deterministic tolerance evaluation and machine-readable evidence reports. |
| `uncertainty` | First-order, interval and deterministic seeded Monte Carlo propagation over catalogue models. |
| `model-packs` | Versioned higher-level stellar, energy-balance, climate, tidal and rocky-interior prescriptions. |
| `external-adapters` | Versioned, engine-neutral dynamics and climate handoffs with normalized result validation. |
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

## Explainable results

Use the catalogue when a result will cross an API boundary or appear on a
science website. The low-level functions return convenient branded numbers; the
catalogue returns a complete serialisable scientific record.

```ts
import { evaluateSatelliteStability } from 'tungolcraft'

const result = evaluateSatelliteStability({
  hillRadiusAu: 0.01,
  // Omitted eccentricities and orbit sense are recorded as applied defaults.
})

if (!result.ok) {
  // Match stable codes such as `satellite.hill-radius.invalid`.
  console.error(result.diagnostics)
} else {
  console.log(result.output.limit)               // { value: 0.004895, unit: 'AU' }
  console.log(result.model.id)                    // satellite.domingos-2006-limit
  console.log(result.model.version)               // 1.0.0
  console.log(result.model.sources[0]?.doi)       // 10.1111/j.1365-2966.2006.11104.x
  console.log(result.inputs.orbitSense)           // { value: 'prograde', source: 'default' }
  console.log(result.uncertainty)                 // { kind: 'not-provided' }

  // Includes output, units, model metadata, all evaluated inputs, assumptions,
  // validity rules, diagnostics and uncertainty status.
  const publishableRecord = JSON.stringify(result)
}
```

## Interoperable scenarios

```ts
import {
  SCENARIO_SCHEMA_VERSION,
  parseScenarioJson,
  serializeScenario,
} from 'tungolcraft'

const scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  time: { epoch: 'J2000', scale: 'TDB', secondsPerDay: 86_400 },
  frames: [{
    id: 'star-ecliptic',
    originBodyId: 'star',
    plane: 'ecliptic',
    direction: '+X toward the J2000 mean equinox',
    handedness: 'right',
  }],
  bodies: [{ id: 'star', kind: 'star', mass: { value: 1.989e30, unit: 'kg' } }],
}

const exported = serializeScenario(scenario)
if (exported.ok) {
  const imported = parseScenarioJson(exported.json)
  console.log(imported.ok) // true
}
```

See the [scenario interchange guide](./docs/SCENARIO-INTERCHANGE.md) for body
graphs, frame conventions, binary coordinates and published JSON Schemas.

## External engines

Tungolcraft prepares explicit, unit-bearing requests for external dynamics and
climate engines without embedding those solvers in the core. Adapters own
engine-specific translation and execution; returned samples are checked against
request, engine, frame, body, time-window and provenance contracts.

```ts
import { prepareDynamicsRun, runExternalAdapter } from 'tungolcraft'

const prepared = prepareDynamicsRun({
  scenario,
  requestId: 'nbody-001',
  engine: { id: 'my.engine', version: '1.0.0', kind: 'dynamics', title: 'My engine' },
  frameId: 'system-barycentric',
  states,
  window: {
    startOffset: { value: 0, unit: 's' },
    duration: { value: 31_557_600, unit: 's' },
    outputInterval: { value: 86_400, unit: 's' },
  },
})

if (prepared.ok) {
  const result = await runExternalAdapter(adapter, prepared.value)
  console.log(result.ok, result.provenance)
}
```

The core performs no I/O unless an adapter is explicitly supplied and run. See
the [external adapter guide](./docs/EXTERNAL-ADAPTERS.md) for dynamics and
climate contracts, JSON Schemas, implementation guidance and scientific
non-claims.

## Uncertainty

```ts
import { propagateCatalogueUncertainty } from 'tungolcraft'

const density = propagateCatalogueUncertainty({
  modelId: 'body.bulk-density',
  inputs: {
    massKg: {
      value: 5.972e24, unit: 'kg', source: 'caller',
      uncertainty: { kind: 'standard-deviation', value: 6e20, unit: 'kg' },
    },
    radiusM: {
      value: 6.371e6, unit: 'm', source: 'caller',
      uncertainty: { kind: 'standard-deviation', value: 10, unit: 'm' },
    },
  },
}, { method: 'first-order', assumeIndependent: true })

if (density.ok) console.log(density.uncertainty)
```

Interval propagation evaluates bounded corners. Monte Carlo requires and
reports a seed, sample count and sampling policy. Multi-input probabilistic
propagation refuses to run until the caller explicitly accepts an independence
assumption. See the [uncertainty guide](./docs/UNCERTAINTY.md).

## Scientific evidence

```sh
bun run --filter tungolcraft benchmarks
```

The committed corpus covers all twenty catalogue models with NASA and IAU
reference values, published Eker, Kopparapu, Goldreich–Soter, Domingos and Zeng
prescriptions, and isolated analytic identities. Every fixture declares its
model version, evaluated inputs, expected unit-bearing value, source and
numerical tolerance.

- [Current validation report](./docs/VALIDATION.md)
- [Generated model reference](./docs/MODEL-REFERENCE.md)
- [Machine-readable fixtures](./benchmarks/fixtures.json)

## Status

Early extraction from the
[KnowThing](https://github.com/RoseHobgoblin/KnowThing) celestial engine.
The numeric core is stable and unit-tested. Its twenty-model catalogue provides
explainable, non-throwing results for both foundational calculations and named
higher-level scientific prescriptions. Versioned scenario interchange,
explicit frames and binary coordinate transformations are supported. All
catalogue models have version-locked benchmark evidence. First-order, interval
and deterministic seeded Monte Carlo uncertainty propagation are supported.
N-body and full climate simulation remain external, with a versioned adapter
boundary for preparing requests and validating normalized results.

## Direction

- [Scientific-readiness roadmap](./docs/SCIENTIFIC-READINESS.md)
- [Theoretical-modelling specification](./docs/THEORETICAL-MODELLING-SPEC.md)
- [Scenario interchange guide](./docs/SCENARIO-INTERCHANGE.md)
- [Uncertainty propagation guide](./docs/UNCERTAINTY.md)
- [Scientific model-pack guide](./docs/MODEL-PACKS.md)
- [External engine adapter guide](./docs/EXTERNAL-ADAPTERS.md)
- [Scientific validation](./docs/VALIDATION.md)
- [Model reference](./docs/MODEL-REFERENCE.md)
