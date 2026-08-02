# External engine adapters

Milestone F gives Tungolcraft a versioned handoff boundary for calculations that
do not belong in its zero-dependency core. Tungolcraft prepares and validates
scientific inputs, an explicitly selected engine performs the integration, and
an adapter returns normalized output for Tungolcraft to validate and interpret.

The boundary currently covers N-body dynamics and climate tools. It does not
bundle, recommend or silently invoke an external engine.

## What the contract guarantees

- Every request has a stable request ID and the `1.0.0` schema version.
- Engine identity, engine version and engine kind are explicit.
- Epoch, time scale, seconds per day, run window and output cadence are explicit.
- Dynamics inputs use Cartesian metres and metres per second in one named frame.
- Every dynamics body has an explicit positive mass and initial state.
- Climate boundary conditions and numeric engine parameters always carry units.
- Engine-specific parameter names remain visible; Tungolcraft never guesses
  their meaning or defaults.
- Results repeat request identity and record both engine and adapter provenance.
- Result samples are finite, bounded, strictly ordered, inside the requested time window
  and checked for the requested bodies and frame.
- Transport errors and malformed engine output become structured failed results.

The runtime validators reject unknown fields, duplicate identifiers, negative
zero, non-finite values and resource-limit violations. The JSON Schemas provide
the same structural vocabulary for services written in other languages;
cross-field and finite-number checks remain the responsibility of the runtime
validator or an equivalent implementation.

## Preparing a dynamics request

```ts
import {
  prepareDynamicsRun,
  type ExternalStateVector,
  type ScenarioInput,
} from 'tungolcraft'

declare const scenario: ScenarioInput
declare const states: Readonly<Record<string, ExternalStateVector>>

const prepared = prepareDynamicsRun({
  scenario,
  requestId: 'stability-run-001',
  engine: {
    id: 'example.symplectic',
    version: '4.2.0',
    kind: 'dynamics',
    title: 'Example symplectic engine',
  },
  frameId: 'system-barycentric',
  states,
  window: {
    startOffset: { value: 0, unit: 's' },
    duration: { value: 31_557_600, unit: 's' },
    outputInterval: { value: 86_400, unit: 's' },
  },
  parameters: [
    { id: 'relativeTolerance', value: 1e-12, unit: '1' },
    { id: 'integrator', value: 'engine-specific-name' },
  ],
})
```

Initial states are deliberately explicit. Tungolcraft does not silently turn a
parent-centred, relative-separation or barycentric-component semi-major axis
into a common-frame N-body state. Callers may obtain states from a catalogue
model, an observational source or their own binary-coordinate conversion, but
must label the resulting frame themselves.

`bodyIds` can select a subset. Every selected body must exist in the validated
scenario and have both mass and a supplied Cartesian state. Scenario metadata
is not copied into the solver request.

## Preparing a climate request

```ts
import { prepareClimateRun } from 'tungolcraft'

const prepared = prepareClimateRun({
  scenario,
  requestId: 'climate-run-001',
  engine: {
    id: 'example.ebm',
    version: '2.1.0',
    kind: 'climate',
    title: 'Example energy-balance engine',
  },
  bodyId: 'planet-a',
  window: {
    startOffset: { value: 0, unit: 's' },
    duration: { value: 31_557_600, unit: 's' },
    outputInterval: { value: 86_400, unit: 's' },
  },
  boundaryConditions: [
    { id: 'topOfAtmosphereFlux', quantity: { value: 1361, unit: 'W/m^2' } },
    { id: 'surfaceGravity', quantity: { value: 9.81, unit: 'm/s^2' } },
  ],
  parameters: [{ id: 'cloudScheme', value: 'engine-default-v2' }],
})
```

Boundary-condition IDs are semantic names agreed with the chosen adapter. This
keeps the protocol able to represent one-dimensional energy-balance models,
radiative-convective columns and larger climate services without pretending
their inputs are interchangeable.

## Implementing and running an adapter

An adapter implements three deliberately separate operations:

1. `prepare` translates the validated public request into the engine's format;
2. `execute` owns all I/O, subprocess or service interaction;
3. `interpret` maps the raw response to an `ExternalRunResult`.

```ts
import { runExternalAdapter, type ExternalEngineAdapter } from 'tungolcraft'

declare const adapter: ExternalEngineAdapter

if (prepared.ok) {
  const result = await runExternalAdapter(adapter, prepared.value)
  if (!result.ok) console.error(result.diagnostics)
}
```

The core performs no network, filesystem or subprocess operation unless the
caller supplies an adapter and calls `runExternalAdapter`. Thrown transport
errors and invalid interpreted results are converted to
`external.adapter.failure` diagnostics.

Dynamics results are normalized to time samples containing all requested body
states in the requested frame. Climate results are named, unit-bearing scalar
channels. This is an interchange shape, not a claim that every engine computes
the same observables.

## Direct JSON interchange

The package exports runtime helpers:

- `validateExternalRunRequest` and `validateExternalRunResult`;
- `parseExternalRunRequestJson` and `parseExternalRunResultJson`;
- `serializeExternalRunRequest` and `serializeExternalRunResult`.

Standalone schemas are published at:

- `tungolcraft/schemas/external-run-request.schema.json`;
- `tungolcraft/schemas/external-run-result.schema.json`.

The protocol limits requests to 10,000 bodies and 1,000 parameters. Results are
limited to 100,000 time samples, 1,000 climate channels and 50 million JSON
characters. These are safety ceilings, not performance promises.

## Interpretation and non-claims

A successfully validated result proves only that an identified adapter returned
a structurally coherent result for the identified request. It does not prove:

- numerical convergence, conservation or long-term orbital stability;
- correctness of an engine, its configuration or its physical assumptions;
- climate equilibrium, habitability or agreement with a real planet;
- equivalence between two engines that use similarly named parameters;
- observational accuracy.

Engine-specific diagnostics, convergence statistics and conservation channels
should be preserved as explicit normalized channels or diagnostics. A science
site should display engine and adapter versions alongside material conclusions
and retain the original request and result as reproducibility artifacts.

## Versioning policy

`EXTERNAL_RUN_SCHEMA_VERSION` versions the serialized request and result shape.
`EXTERNAL_ADAPTER_API_VERSION` versions the default adapter protocol version.
An adapter has its own ID and version, independent of the external engine.

Adding optional engine parameters or new channel IDs does not change this
schema. Renaming fields, changing units or semantics, relaxing identity checks,
or changing required result coverage requires a new schema version. Existing
versions remain explicit rather than being silently upgraded.
