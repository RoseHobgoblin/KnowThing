# Scenario interchange

Tungolcraft scenarios are versioned JSON scientific records. They make time,
coordinate frames, orbital-axis meaning and body relationships explicit before
any model evaluates them.

## Public contracts

- `ScenarioInput` contains scientific bodies, time, frames and optional
  presentation metadata.
- `ScientificBody` contains only structured scientific quantities.
- `BodyMetadata` contains names, descriptions, classifications and arbitrary
  application fields. It cannot be mistaken for model input.
- `ScenarioReport` contains explainable model results and an explicit dependency
  graph.

Use `validateScenario` for an object already in memory, `parseScenarioJson` at a
JSON boundary and `serializeScenario` before export. Equivalent report
functions validate both result serialization and dependency graphs.

The validators reject unsupported schema versions, unknown fields, wrong units,
non-finite numbers, negative zero, unresolved references, duplicate IDs, orbit
cycles, incompatible frame origins and resource-limit violations.

## Time and frames

Every scenario declares an epoch label, time scale and seconds per day.
Tungolcraft does not silently convert between `UTC`, `TAI`, `TT`, `TDB` and
caller-defined `model-day` time.

Every orbit names a right-handed reference frame. A frame states its origin
body, reference plane and caller-readable positive-axis definition. An orbit's
frame origin must match its `primaryId`.

## Axis meaning

Every elliptical orbit uses exactly one axis meaning:

- `parent-centred`: the component axis measured from its primary;
- `relative-separation`: the centre-to-centre axis of a two-body relative orbit;
- `barycentric-component`: one component's axis about an explicit body of kind
  `barycenter`.

Tungolcraft never infers one meaning from an unlabelled number.

`partitionBinaryRelativeAxis` converts a relative semi-major axis into its two
mass-weighted component axes. `relativeStateToBarycentric` converts a relative
position/velocity vector into component states whose mass-weighted barycenter
is zero. Both helpers use overflow-resistant mass fractions and return
structured validation failures.

## JSON Schemas

The npm package publishes JSON Schema draft 2020-12 documents:

- `tungolcraft/schemas/scenario.schema.json`
- `tungolcraft/schemas/scenario-report.schema.json`

JSON Schema validates the portable record shape. Tungolcraft's runtime
validators additionally enforce cross-record constraints such as unique IDs,
resolved references, compatible frame origins, acyclic graphs and bounded
dependency depth.

The input and report schemas currently use version `1.0.0`. Their schema
versions are independent of the npm package and scientific-model versions.
