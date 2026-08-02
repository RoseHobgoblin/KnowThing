# Tungolcraft scientific-readiness roadmap

## The decision

Tungolcraft should become an **explainable theoretical-modelling kernel**, not a
general astronomy package and not an N-body simulator.

Its useful niche is evaluating hypothetical celestial systems from partial or
invented inputs:

- derive quantities that follow from a stated model;
- identify contradictions and values outside that model's domain;
- propagate ideal two-body orbits;
- return enough provenance for a science website to explain and reproduce the
  result.

The recent orbital hardening establishes a credible numerical core: public
orbital inputs are validated, the Kepler solver is safeguarded at high
eccentricity, binary separation has an explicit meaning, barycenter diagnostics
use geometry, and satellite stability uses a cited empirical model. What remains
is mostly about turning correct functions into accountable scientific results.

## What is ready now

The following are suitable as low-level, closed-form building blocks:

- branded SI quantities at the TypeScript boundary;
- two-body period, speed, state-vector, apsis, Hill, Roche and barycenter
  calculations;
- bound elliptical propagation with an explicit numerical failure mode;
- advisory diagnostics for invalid or suspicious configurations;
- an empirical prograde/retrograde satellite-stability estimate carrying its
  citation and assumptions;
- isolated package tests with no application runtime dependency.

These functions are not an ephemeris and do not claim observational precision.
They model ideal or screening cases from caller-supplied parameters.

## What blocks adoption by a science website

### 1. Results are numbers, not scientific records

A scalar such as `0.4895` is not enough for publication. A consumer needs:

- the quantity and canonical unit;
- the model and version;
- the exact inputs used, including defaults;
- assumptions and validity domain;
- a source or derivation identifier;
- diagnostics and numerical quality;
- uncertainty, or an explicit statement that none was supplied.

The existing direct functions should remain convenient. A new explainable layer
should wrap them without changing their mathematics.

### 2. Diagnostics are written for humans but unstable for software

`PhysicsWarning` currently exposes a field, prose message and two severities.
Websites need stable diagnostic codes, structured evidence and a distinction
between:

- invalid input;
- outside a model's validity domain;
- numerical failure;
- physically suspicious but permitted;
- missing information;
- an approximation or screening result.

Messages can then be localised or rewritten without breaking integrations.

### 3. Model provenance is inconsistent

The satellite-stability result carries a model ID and citation, but most other
functions document provenance only in comments. Every public scientific model
needs a registry entry with:

- stable ID and version;
- equation or algorithm summary;
- primary source where one exists;
- assumptions;
- input and output units;
- validity limits;
- expected numerical tolerance.

### 4. System and reference-frame semantics need a public contract

The package correctly distinguishes a binary's relative semi-major axis from a
component's barycentric radius, but this must become part of a serialisable
system schema. The schema must state:

- what each body orbits;
- whether an axis is relative, parent-centred or barycentric;
- reference plane and direction;
- epoch and time scale;
- angle conventions;
- the gravitational parameter used for propagation.

Without this, two websites can feed the same numbers into different implied
geometries.

### 5. There is no uncertainty model

Theoretical inputs may be exact assumptions, measured estimates, ranges or
distributions. Tungolcraft must distinguish those cases. The first useful step
is deterministic interval/first-order propagation for smooth closed-form
models, followed by reproducible seeded Monte Carlo for nonlinear models.

Uncertainty must be optional. A result without supplied uncertainty should say
`not-provided`, not imply zero uncertainty.

### 6. Verification is internal rather than publishable

Unit tests establish regressions, but scientific consumers need benchmark
fixtures with sources and documented tolerances. The benchmark suite should
cover:

- analytic identities and limiting cases;
- Solar System examples used only as reference fixtures;
- high-eccentricity numerical stress cases;
- binary equal- and unequal-mass cases;
- Pluto-Charon-style barycenter geometry;
- prograde and retrograde satellite limits;
- rejected values at every model boundary.

Benchmark output should be machine-readable and suitable for CI artifacts.

### 7. Package release engineering is unfinished

Before an npm release intended for third parties:

- publish compiled JavaScript and declarations rather than source-only entry
  points;
- define supported Node, TypeScript and module-system versions;
- generate API documentation;
- add changelog, contribution and citation files;
- establish semantic-versioning rules for models as well as TypeScript APIs;
- test the packed tarball in a clean consumer project;
- run tests, typecheck, benchmarks and package validation in CI.

## Recommended sequence

### Milestone A — trustworthy results

Implement the result envelope, model registry and structured diagnostics from
the theoretical-modelling specification.

This is the highest-leverage milestone: a science website can adopt existing
physics once every answer is explainable.

Status: **complete**. Every existing numerical model in the 0.2 initial
catalogue now uses the result, registry, provenance, validity, diagnostic,
default-reporting and uncertainty-absence contracts. Boundary and analytic
identity tests cover all catalogue entries, and every tested result is checked
for finite JSON serialization.

### Milestone B — interoperable systems

Add the serialisable body/system schema, explicit frames and binary coordinate
helpers. Provide import/export validation and JSON Schema.

Status: **complete**. Versioned scenario and report records now separate
scientific bodies from presentation metadata, require explicit time, frame and
axis semantics, validate graph and dependency integrity, and provide safe JSON
import/export. Relative binary axes and states have mass-weighted barycentric
helpers. Draft 2020-12 input and report schemas ship in the npm package.

### Milestone C — evidence

Build the sourced benchmark corpus, tolerance policy and generated model
reference pages. Make benchmarks part of CI and release artifacts.

Status: **complete**. A version-locked machine-readable corpus covers all
twenty catalogue models with primary-source fixtures or isolated analytic
identities. The deterministic runner enforces declared absolute/relative
tolerances, generated validation and model-reference pages are checked for
drift, and package CI uploads the benchmark report and documentation as release
evidence.

### Milestone D — uncertainty

Add interval/first-order propagation and seeded Monte Carlo as separate
utilities. Do not bake probabilistic behaviour into every low-level function.

Status: **complete**. Catalogue inputs now accept validated standard-deviation,
interval or empirical-sample uncertainty. A separate non-throwing propagation
utility supports central-difference first-order propagation, bounded corner
enumeration and deterministic seeded Monte Carlo. Every propagated result
records its scalar output path, dependence treatment and evaluation count;
Monte Carlo additionally records its seed, sample count and sampling policy.
Multi-input probabilistic methods require an explicit independence assumption,
and hard limits bound uncertain inputs, interval corners and samples.

### Milestone E — model packs

Add higher-level science only as named, replaceable models:

- stellar luminosity and main-sequence screening;
- equilibrium temperature and irradiation;
- published habitable-zone prescriptions;
- tidal timescale screening;
- class-specific mass-radius or density relations.

Each model pack must satisfy the same provenance, domain and benchmark contract.

Status: **complete**. Five independently versioned packs expose six new named
catalogue models: the Eker 2018 main-sequence luminosity screen, isotropic
stellar irradiance, globally redistributed blackbody equilibrium temperature,
the Kopparapu 2014 conservative habitable zone, constant-Q eccentricity damping
and the Zeng 2016 rocky-planet mass–radius relation. Every model has explicit
assumptions and domain diagnostics, supports the Milestone D propagation
boundary, and has a version-locked primary-source or isolated-equation fixture.

### Milestone F — external dynamics adapters

Define an adapter boundary for N-body integrations and climate tools rather than
implementing them in the zero-dependency core. Tungolcraft should prepare,
validate and interpret scenarios; specialised engines can perform expensive
integration.

Status: **complete**. The versioned external-run protocol now covers explicit
dynamics and climate handoffs, strict runtime validation, standalone JSON
Schemas, normalized result validation and an injected three-stage adapter
interface (`prepare`, `execute`, `interpret`). Dynamics requests require
common-frame Cartesian SI states and masses; climate requests require named,
unit-bearing boundary conditions. Engine and adapter versions, request identity,
time semantics, resource limits and failure diagnostics survive the round trip.
The core performs no external I/O and makes no claim that a structurally valid
engine result is converged, physically correct or observationally accurate.

## Explicit non-goals for the core

- predicting the real night sky;
- replacing JPL or another ephemeris;
- claiming long-term stability from radial orbit overlap;
- treating a Hill-sphere or empirical satellite limit as an N-body proof;
- full stellar evolution, atmospheric circulation or geophysics;
- silently selecting a physical model from insufficient inputs;
- presenting model output as measured fact.

## Definition of “science-site ready”

Tungolcraft is ready for a public theoretical-modelling feature when:

1. every displayed result has a stable model ID, units, assumptions, domain and
   source metadata;
2. invalid and out-of-domain cases are machine-readable and never silently
   repaired;
3. system geometry and time/reference-frame conventions are serialisable;
4. uncertainty is represented honestly;
5. sourced benchmarks run in CI with declared tolerances;
6. a packed npm artifact passes a clean-room consumer test;
7. documentation clearly separates derivation, screening, approximation and
   simulation.
