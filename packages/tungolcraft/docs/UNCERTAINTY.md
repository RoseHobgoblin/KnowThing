# Uncertainty propagation

Tungolcraft keeps uncertainty propagation separate from its low-level equations.
`propagateCatalogueUncertainty` evaluates a named catalogue model, preserves its
nominal output and attaches a serialisable uncertainty record to the ordinary
result envelope.

## Input records

Numeric `InputRecord` values may declare one of three uncertainty shapes:

```ts
type Uncertainty =
  | { kind: 'standard-deviation', value: number, unit: UnitSymbol }
  | {
      kind: 'interval'
      lower: number
      upper: number
      unit: UnitSymbol
      confidence?: number
    }
  | { kind: 'samples', values: readonly number[], unit: UnitSymbol }
```

The uncertainty unit must equal the input unit. An interval must contain the
nominal input. A result with no supplied uncertainty remains
`{ kind: 'not-provided' }`; Tungolcraft does not turn absence into false
precision.

## First-order propagation

```ts
import { propagateCatalogueUncertainty } from 'tungolcraft'

const result = propagateCatalogueUncertainty({
  modelId: 'body.bulk-density',
  inputs: {
    massKg: {
      value: 5.972e24,
      unit: 'kg',
      source: 'caller',
      uncertainty: {
        kind: 'standard-deviation',
        value: 6e20,
        unit: 'kg',
      },
    },
    radiusM: {
      value: 6.371e6,
      unit: 'm',
      source: 'caller',
      uncertainty: {
        kind: 'standard-deviation',
        value: 10,
        unit: 'm',
      },
    },
  },
}, {
  method: 'first-order',
  assumeIndependent: true,
})
```

First-order propagation estimates a central-difference Jacobian at the nominal
input and combines standard deviations in quadrature. It is appropriate for
smooth models and small uncertainties. When two or more inputs are uncertain,
the caller must explicitly set `assumeIndependent: true`; covariance is not
silently discarded.

## Interval propagation

Use `{ method: 'interval' }` with interval inputs. The utility evaluates every
lower/upper corner and returns the minimum and maximum scalar output it
observes. This is bounds propagation, not a confidence calculation, so the
result reports `dependence: 'bounds-only'`.

Corner enumeration is conservative for monotonic functions. For a non-monotonic
function, extrema may occur inside the box, so the returned range is not a
formal interval-arithmetic proof. Domain failures at any corner produce a
structured failure.

For composite catalogue outputs, select one scalar using `outputPath`, for
example `inner`, `position.x` or `velocity.z`.

## Seeded Monte Carlo

Monte Carlo calls must state:

- a uint32 `seed`;
- an integer `sampleCount`;
- a `samplingPolicy`;
- `assumeIndependent: true` when more than one input is uncertain.

Policies intentionally match one input representation:

| Policy | Required input uncertainty | Sampling |
| --- | --- | --- |
| `normal` | `standard-deviation` | Gaussian about the nominal input |
| `uniform` | `interval` | Uniform between the bounds |
| `empirical` | `samples` | Bootstrap draw from the supplied values |

The result contains all output samples, the output unit, seed, sample count,
policy, dependence treatment and total model evaluation count. Equal requests
produce equal samples across runs. Tungolcraft does not claim the pseudo-random
sequence is suitable for cryptography.

## Limits and failure behaviour

The zero-dependency core enforces:

- at most 16 uncertain inputs;
- at most 65,536 interval corners;
- at most 10,000 Monte Carlo output samples;
- at most 10,000 empirical samples on one input.

Invalid uncertainty, incompatible methods, unit mismatches, undeclared
dependence, resource excess and sampled model-domain failures return stable
`uncertainty.*` diagnostics rather than throwing. These limits also keep
scenario reports bounded and practical to serialize.

Correlation matrices, covariance propagation, quasi-random sampling and formal
interval arithmetic are future extensions. Until covariance is supported, use
this API only when independence is scientifically defensible or use
`interval` bounds without a probabilistic independence claim.
