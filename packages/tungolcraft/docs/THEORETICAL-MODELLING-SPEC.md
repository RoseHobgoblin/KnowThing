# Tungolcraft theoretical-modelling specification

Status: Draft  
Target: Tungolcraft 0.2  
Audience: package maintainers, science-site integrators and model contributors

## 1. Purpose

This specification defines the contracts required for Tungolcraft to expose
reproducible, explainable calculations for hypothetical celestial systems.

The specification governs:

- model identity and provenance;
- inputs, units, assumptions and validity domains;
- output and diagnostic structure;
- reference-frame and orbital semantics;
- uncertainty representation;
- numerical quality and verification;
- compatibility and release requirements.

It does not require N-body, climate or observational simulation.

The words **MUST**, **MUST NOT**, **SHOULD** and **MAY** are normative.

## 2. Design principles

1. **No hidden repair.** An explicit invalid value MUST NOT be converted into a
   default, circular orbit or other plausible value.
2. **Models are named.** A result MUST identify the equation or algorithm that
   produced it.
3. **Defaults are inputs.** Applied defaults MUST appear in the result record.
4. **Domain is separate from plausibility.** Mathematically invalid,
   model-inapplicable and merely unusual inputs MUST produce different
   diagnostics.
5. **Units cross runtime boundaries.** Branded TypeScript numbers protect
   authors at compile time; serialised records MUST also name their units.
6. **Determinism by default.** Equal inputs and model versions MUST produce equal
   outputs. Stochastic evaluation MUST accept and report a seed.
7. **Direct functions remain small.** Existing pure numerical functions remain
   available. Explainability is an additional public layer.

## 3. Public architecture

The package will have three layers:

| Layer | Responsibility |
| --- | --- |
| Numerical core | Pure branded-unit calculations such as `computeOrbitalPeriodDays` |
| Model catalogue | Metadata, domain validation and evaluation for one named model |
| Scenario layer | Body/system relationships, dependency resolution and multi-result reports |

The numerical core MUST NOT depend on the scenario layer.

## 4. Model identity and provenance

Every catalogue model MUST expose this metadata:

```ts
export interface ModelReference {
  /** Stable namespaced ID, for example `orbit.kepler-period`. */
  id: string
  /** Version of the scientific contract, independent of package version. */
  version: string
  title: string
  summary: string
  kind: 'exact-relation' | 'numerical-solution' | 'approximation' | 'empirical-fit' | 'screening'
  sources: readonly ModelSource[]
  assumptions: readonly string[]
  validity: readonly ValidityRule[]
}

export interface ModelSource {
  type: 'paper' | 'standard' | 'textbook' | 'derivation' | 'documentation'
  citation: string
  doi?: string
  url?: string
}
```

Model IDs MUST remain stable after publication. A change to equations,
coefficients, default behaviour, domain or interpretation MUST increment the
model version. Editorial metadata corrections MAY retain the version.

Primary literature or standards SHOULD be cited where available. A locally
documented derivation is acceptable for elementary identities.

## 5. Quantity and input records

Serialisable scientific values MUST carry explicit units:

```ts
export interface QuantityRecord<U extends string = string> {
  value: number
  unit: U
}

export interface InputRecord {
  value: number | string | boolean
  /** Required for numeric scientific quantities; omitted for categories. */
  unit?: string
  source: 'caller' | 'default' | 'derived'
  uncertainty?: Uncertainty
}
```

`QuantityRecord` is deliberately distinct from Tungolcraft's existing branded
numeric `Quantity<Tag>` type. The former is a runtime/JSON record; the latter is
a compile-time unit guard.

Canonical units SHOULD be SI. Domain-specific display units such as AU and days
MAY be accepted at an authoring boundary, but the normalised input record MUST
state the unit actually evaluated.

Unit strings MUST come from a closed registry. Initial units:

```ts
type Unit =
  | '1'
  | 'rad'
  | 'deg'
  | 's'
  | 'd'
  | 'm'
  | 'm/s'
  | 'm/s^2'
  | 'kg'
  | 'kg/m^3'
  | 'W'
  | 'W/m^2'
  | 'K'
  | 'm^3/s^2'
  | 'AU'
```

`NaN`, infinities and negative zero MUST NOT appear in a serialised result.

## 6. Result envelope

Catalogue evaluation MUST return a discriminated result rather than throw for
ordinary caller input. Units belong to each value, not to the envelope, because
a composite result may contain quantities with different dimensions:

```ts
export type ModelResult<T> =
  | ModelSuccess<T>
  | ModelFailure

export interface ModelSuccess<T> {
  ok: true
  output: T
  model: ModelReference
  inputs: Readonly<Record<string, InputRecord>>
  diagnostics: readonly Diagnostic[]
  numerical?: NumericalQuality
  uncertainty: ResultUncertainty
}

export interface ModelFailure {
  ok: false
  model: ModelReference
  inputs: Readonly<Record<string, InputRecord>>
  diagnostics: readonly Diagnostic[]
}

export interface QuantityVector<U extends string> {
  x: number
  y: number
  z: number
  unit: U
}

export interface StateVectorOutput {
  position: QuantityVector<'m'>
  velocity: QuantityVector<'m/s'>
  frameId: string
}
```

Programmer misuse and violated internal invariants MAY throw. Invalid user data,
an unsupported domain and a declared numerical non-convergence MUST be returned
as failures by the catalogue layer.

The low-level numerical core MAY continue to throw `RangeError`,
`OrbitalDomainError` or `KeplerConvergenceError`.

## 7. Diagnostics

```ts
export type DiagnosticCategory =
  | 'invalid-input'
  | 'missing-input'
  | 'outside-domain'
  | 'numerical-failure'
  | 'approximation'
  | 'physical-warning'

export interface Diagnostic {
  /** Stable namespaced code, not derived from the message. */
  code: string
  category: DiagnosticCategory
  severity: 'info' | 'warning' | 'error'
  message: string
  fields: readonly string[]
  evidence?: Readonly<Record<string, number | string | boolean>>
  modelId: string
}
```

Diagnostic codes and their meanings are public API. Messages are not stable API.

Examples:

- `orbit.eccentricity.out-of-range`
- `orbit.kepler.non-convergence`
- `binary.barycenter.outside-primary`
- `satellite.stability.outside-empirical-limit`
- `density.outside-default-screening-envelope`

A failed evaluation MUST contain at least one `error` diagnostic. A success MAY
contain warnings or informational approximation notices.

## 8. Validity rules and assumptions

Validity rules MUST be machine-readable where practical:

```ts
export type ValidityRule =
  | { field: string, operator: 'finite' }
  | { field: string, operator: 'gt' | 'gte' | 'lt' | 'lte', value: number, unit?: string }
  | { field: string, operator: 'one-of', values: readonly string[] }
  | { description: string }
```

Catalogue models MUST validate before evaluation. A model MUST NOT run when a
required validity rule fails.

Assumptions that cannot be mechanically verified MUST still be reported. For
example, the Domingos satellite-stability fit assumes a restricted elliptic
three-body problem and negligible satellite mass.

## 9. Numerical quality

Numerical models MUST report relevant quality information:

```ts
export interface NumericalQuality {
  method: string
  iterations?: number
  residual?: number
  tolerance?: number
  converged: boolean
}
```

For the elliptical Kepler solver:

- the supported eccentricity domain is `0 <= e < 1`;
- all numeric inputs MUST be finite;
- convergence MUST be tested using the equation residual;
- the configured tolerance and iteration cap MUST be documented;
- a failure MUST report residual and iteration count;
- stress benchmarks MUST include values approaching `e = 1` and anomalies near
  periapsis.

Closed-form functions MAY omit `numerical` or report a method without iteration
data.

## 10. Orbital and system semantics

### 10.1 Time

A scenario MUST declare:

```ts
export interface TimeContext {
  epoch: string
  scale: 'model-day' | 'UTC' | 'TAI' | 'TT' | 'TDB'
  secondsPerDay: number
}
```

`model-day` is sufficient for invented systems. A science site using real dates
MUST select an explicit physical time scale. Tungolcraft MUST NOT silently
perform conversions between time scales.

### 10.2 Reference frame

```ts
export interface ReferenceFrame {
  id: string
  originBodyId: string
  plane: 'xy-reference' | 'ecliptic' | 'equatorial' | 'custom'
  direction: string
  handedness: 'right'
}
```

All state vectors MUST identify their frame. Existing orbital propagation uses
a right-handed, parent-centred inertial frame with the reference plane in XY.

### 10.3 Orbit definition

```ts
export interface EllipticalOrbit {
  kind: 'elliptical'
  primaryId: string
  frameId: string
  semiMajorAxis: Quantity<'AU'>
  axisMeaning: 'parent-centred' | 'relative-separation' | 'barycentric-component'
  eccentricity: Quantity<'1'>
  inclination: Quantity<'deg'>
  longitudeAscendingNode: Quantity<'deg'>
  argumentOfPeriapsis: Quantity<'deg'>
  epochPhase: Quantity<'1'>
  mu: Quantity<'m^3/s^2'>
}
```

Bound elliptical APIs MUST reject `e >= 1`. Parabolic and hyperbolic models, if
added, MUST use different discriminants and equations.

For a binary:

- Kepler's two-body period uses the relative axis `a_rel = a1 + a2` and total
  gravitational parameter;
- a component's barycentric axis MUST be labelled
  `barycentric-component`;
- adapters MUST NOT infer one meaning from an unlabelled number.

### 10.4 Body graph

Body IDs MUST be unique. Parent references MUST resolve. The graph MUST be
acyclic. A scenario validator MUST report duplicate IDs, missing parents,
cycles, incompatible axis meanings and missing mass required for a derivation.

### 10.5 Scientific and presentation records

`ScientificBody` MUST contain only structured scientific quantities and orbit
records. Names, prose descriptions, classifications and arbitrary application
fields belong to a separate `BodyMetadata` record keyed by body ID. Metadata
MUST NOT be interpreted as numerical model input.

The implemented scenario validator additionally rejects unknown fields,
non-finite values, negative zero, wrong runtime units, duplicate frame IDs,
missing frame origins and orbit frames whose origin does not match the orbit
primary.

## 11. Uncertainty

```ts
export type Uncertainty =
  | { kind: 'standard-deviation', value: number, unit: string }
  | { kind: 'interval', lower: number, upper: number, unit: string, confidence?: number }
  | { kind: 'samples', values: readonly number[], unit: string }

export type ResultUncertainty =
  | { kind: 'not-provided' }
  | {
      kind: 'propagated'
      method: 'first-order' | 'interval' | 'monte-carlo'
      value: Uncertainty
      outputPath?: string
      dependence: 'single-input' | 'independent' | 'bounds-only'
      evaluations: number
    }
```

Absence of input uncertainty MUST yield `not-provided`, not a zero-width
interval.

Monte Carlo evaluation MUST accept a seed, sample count and sampling policy and
MUST report all three. Correlated inputs MUST NOT be treated as independent
unless the caller selects that assumption.

Uncertainty propagation SHOULD be implemented as a utility over catalogue
models, not duplicated inside every numerical function.

Implemented by `propagateCatalogueUncertainty`. First-order propagation accepts
standard deviations and estimates a central-difference Jacobian. Interval
propagation accepts enclosing intervals and enumerates all corners. Monte Carlo
accepts normal, uniform or empirical policies matched to the corresponding
input uncertainty kind and returns the output samples.

Monte Carlo results additionally record `seed`, `sampleCount` and
`samplingPolicy`. Multi-input first-order and Monte Carlo evaluation require
`assumeIndependent: true`; covariance is not inferred. The implementation caps
uncertain inputs at 16, interval corners at 65,536, Monte Carlo samples at
10,000 and empirical input samples at 10,000. These propagation methods estimate
uncertainty through a model; they do not quantify model-form error.

## 12. Initial model catalogue

The 0.2 catalogue SHOULD expose existing calculations under these IDs:

All twenty current models are implemented through the catalogue result
contract. Each has a stable ID, versioned metadata, assumptions, validity
rules, provenance, structured diagnostics and finite serialization tests.

| Model ID | Kind | Existing implementation |
| --- | --- | --- |
| `body.bulk-density` | exact relation | `computeDensity` |
| `body.surface-gravity` | exact relation | `computeSurfaceGravity` |
| `body.escape-velocity` | exact relation | `computeEscapeVelocity` |
| `body.rotational-breakup` | screening | `computeRotationalBreakupPeriodS` |
| `orbit.kepler-period` | exact two-body relation | `computeOrbitalPeriodDays` |
| `orbit.vis-viva-speed` | exact two-body relation | `computeOrbitalSpeedAtRadius` |
| `orbit.mean-speed` | approximation | `computeMeanOrbitalSpeed` |
| `orbit.elliptical-state` | numerical solution | `stateVectorAtEpoch` |
| `orbit.hill-radius` | approximation | `computeHillSphereAu` |
| `binary.parent-barycenter-distance` | exact two-body geometry | `computeParentBarycenterDistanceM` |
| `satellite.domingos-2006-limit` | empirical fit | `estimateSatelliteStabilityLimitAu` |
| `satellite.roche-limit` | idealised screening | `computeRocheLimitM` |
| `star.stefan-boltzmann-luminosity` | exact relation within assumptions | `computeLuminosity` |
| `star.simple-habitable-zone` | approximation | `computeHabitableZoneAu` |
| `star.eker-2018-main-sequence-screen` | screening | Eker et al. (2018) six-piece MLR |
| `orbit.stellar-irradiance` | exact relation | inverse-square bolometric flux |
| `planet.blackbody-equilibrium-temperature` | exact relation within assumptions | global blackbody energy balance |
| `star.kopparapu-2014-conservative-hz` | approximation | Kopparapu et al. (2014) equations 4–5 |
| `satellite.constant-q-eccentricity-damping` | screening | low-e constant-Q tidal timescale |
| `planet.zeng-2016-rocky-radius` | empirical fit | Zeng et al. (2016) PREM relation |

The model metadata MUST make clear that “exact relation” means exact within the
declared idealised model, not exact knowledge of a real object.

## 13. External engine adapter protocol

Expensive N-body and climate integrations MUST remain outside the
zero-dependency core. Tungolcraft MAY prepare, validate, serialize and interpret
their inputs and outputs through the versioned external-run protocol.

### 13.1 Common request semantics

Every request MUST declare:

- schema version and a caller-controlled request ID;
- external engine ID, version, kind and title;
- the scenario epoch, time scale and `secondsPerDay` convention;
- a non-negative start offset, positive duration and positive output interval,
  all in seconds;
- all engine-specific parameters as named scalar values.

Numeric engine parameters MUST include a non-empty unit. Categorical parameters
MUST NOT carry a unit. Parameter names and values MUST NOT be inferred, renamed
or silently defaulted by the generic protocol.

Requests MUST reject unknown fields, duplicate identifiers, non-finite numbers,
negative zero and values beyond the documented resource limits. The
`outputInterval` MUST NOT exceed the run duration.

### 13.2 Dynamics handoff

A dynamics request MUST contain one or more bodies. Every body MUST have a
unique ID, a positive mass in kilograms and an explicit Cartesian initial state
in metres and metres per second. All states MUST name and use the request's
single common frame.

The preparer MUST validate the source scenario and body IDs. Every selected body
MUST have mass and a supplied state. Presentation metadata MUST NOT be copied to
the engine request.

Tungolcraft MUST NOT silently convert labelled orbital axes into a common-frame
state. In particular, a `parent-centred`, `relative-separation` or
`barycentric-component` orbit MUST be converted deliberately by the caller or a
named model before it crosses the adapter boundary.

### 13.3 Climate handoff

A climate request MUST identify one body in the validated scenario and provide
one or more uniquely named boundary conditions. Every boundary-condition value
MUST be finite and carry a non-empty unit.

Boundary-condition IDs are adapter semantics. The protocol MUST NOT treat two
engines as physically equivalent merely because they accept similarly named
quantities. It MUST NOT infer atmospheric composition, albedo, redistribution,
cloud prescription or equilibrium state from an underspecified scenario.

### 13.4 Adapter lifecycle

An `ExternalEngineAdapter` MUST expose three stages:

1. `prepare`, which translates a validated public request to engine input;
2. `execute`, which owns transport and external execution;
3. `interpret`, which produces a normalized public result.

The Tungolcraft core MUST perform no external I/O until a caller supplies an
adapter and explicitly invokes it. A thrown stage or a malformed interpreted
result MUST become a structured failed result with the stable
`external.adapter.failure` diagnostic.

### 13.5 Normalized result semantics

Every result MUST repeat the request ID and kind and MUST record exact engine
and adapter identities and versions. A result interpreted against a request
MUST match its request, engine and scenario identity.

A successful dynamics result MUST contain strictly increasing time samples in the requested
window. Each sample MUST contain every requested body exactly once in the
requested frame, with finite SI Cartesian state vectors.

A successful climate result MUST contain uniquely named, explicitly unit-bearing
scalar channels. Channel sample times MUST be ordered, finite and within the
requested window. No normalized channel name implies a physical guarantee.

Successful results MUST NOT contain error diagnostics. Failed results MUST
contain at least one error diagnostic and MUST NOT contain output. Structural
success MUST NOT be presented as proof of convergence, conservation, dynamical
stability, climate equilibrium, habitability or observational accuracy.

### 13.6 Limits and versioning

Version `1.0.0` caps a request at 10,000 dynamics bodies and 1,000 parameters.
Results are capped at 100,000 time samples and 1,000 climate channels. Parsed or
serialized JSON is capped at 50 million characters.

The external-run schema version and adapter version are independent of the
external engine version. A change to required fields, units, identity checks or
field semantics MUST increment the external-run schema version. New
engine-specific parameter or output-channel IDs do not by themselves change the
generic schema.

Implemented by `prepareDynamicsRun`, `prepareClimateRun`,
`validateExternalRunRequest`, `validateExternalRunResult` and
`runExternalAdapter`, with standalone request and result JSON Schemas.

## 14. Scenario report

The scenario layer SHOULD provide:

```ts
export interface ScenarioReport {
  schemaVersion: string
  scenarioId?: string
  time: TimeContext
  frames: readonly ReferenceFrame[]
  results: Readonly<Record<string, ModelResult<unknown>>>
  diagnostics: readonly Diagnostic[]
  dependencyGraph: Readonly<Record<string, readonly string[]>>
}
```

Every derived result MUST list its input dependencies. If an upstream result
fails, dependants MUST return `missing-input` diagnostics rather than calculate
from fabricated substitutes.

`ScenarioInput` and `ScenarioReport` use independent schema version `1.0.0`.
Runtime object validation, safe JSON parse/serialization and report dependency
validation are implemented. JSON Schema draft 2020-12 documents are published
as `tungolcraft/schemas/scenario.schema.json` and
`tungolcraft/schemas/scenario-report.schema.json`.

## 15. Verification requirements

Every model MUST include:

1. domain-boundary tests;
2. dimensional/unit tests;
3. one analytic identity or independently calculated fixture;
4. a sourced reference fixture where suitable;
5. declared relative and absolute tolerances;
6. property tests for invariants where practical;
7. a test that serialised results contain only finite JSON values.

The catalogue MUST include a machine-readable benchmark command. Benchmark
fixtures MUST record:

```ts
interface BenchmarkFixture {
  id: string
  modelId: string
  modelVersion: string
  inputs: Record<string, InputRecord>
  expected: QuantityRecord
  tolerance: { absolute?: number, relative?: number }
  source?: ModelSource
  notes?: string
}
```

Changes that move a benchmark outside tolerance MUST require either a bug-fix
explanation or a model-version increment.

The initial evidence corpus is implemented in `benchmarks/fixtures.json` and
covers every model in section 12. Tolerances combine as
`absolute + relative * abs(expected)`. `npm run benchmarks` fails on numerical
drift, model-version mismatch, invalid units or failed evaluation. Generated
`VALIDATION.md` and `MODEL-REFERENCE.md` pages are checked in CI, while the
machine-readable report is retained as a workflow artifact.

## 16. Package and compatibility requirements

Before publishing 0.2:

- `exports` MUST point to compiled JavaScript and declaration files;
- the npm tarball MUST exclude application and generated Svelte artifacts;
- `npm pack` MUST be tested from a clean temporary consumer;
- package CI MUST run tests, typecheck, build, benchmarks and tarball smoke tests;
- public model IDs, diagnostic codes and serialised schemas MUST follow semantic
  versioning;
- a JSON Schema MUST be published for scenario input and report output;
- a changelog and machine-readable package version MUST identify breaking
  scientific-model changes.

## 17. Security and resource limits

Scenario evaluation MUST bound:

- body count;
- dependency depth;
- Monte Carlo sample count;
- numerical iteration count;
- serialised report size.

The core MUST not execute caller-supplied equations or code. Custom models are
registered by trusted application code, not deserialised from public input.

## 18. Acceptance criteria for 0.2

Tungolcraft 0.2 satisfies this specification when:

- the initial catalogue wraps every model in section 12;
- every result conforms to the result envelope;
- every model has versioned metadata, assumptions, validity and provenance;
- diagnostics use stable codes and categories;
- scenario input expresses time, frame and axis meaning explicitly;
- uncertainty absence is represented honestly and at least first-order or
  interval propagation is supported;
- benchmark fixtures and package smoke tests run in CI;
- the README includes one complete explainable-result example;
- no application schema is required to keep package APIs inside their declared
  domains.

## 19. Deferred work

The following may be specified later and are not 0.2 blockers:

- hyperbolic and parabolic propagation;
- osculating-element conversion from state vectors;
- N-body integration;
- resonance search and chaos indicators;
- atmospheric and climate models;
- observational coordinates, light-time and relativistic corrections;
- stellar evolution tracks;
- remote model execution.
