# Scientific model packs

Milestone E adds higher-level scientific prescriptions as named, versioned
model packs. Each model still runs through the ordinary catalogue result
contract: stable model ID, independent model version, evaluated inputs,
provenance, assumptions, validity rules, diagnostics and uncertainty support.

Use `listModelPacks()` to discover packs and `getModelPack(id)` to retrieve one.
A pack is an index over public catalogue models, not a hidden mode switch.
Applications choose the model ID they intend to use.

## Stellar screening

The `stellar-screening` pack contains:

- `star.stefan-boltzmann-luminosity`;
- `star.eker-2018-main-sequence-screen`.

The Eker screen implements the six piecewise log-mass/log-luminosity relations
and intrinsic scatter in Table 4 of Eker et al. (2018). It covers
0.179–31 solar masses. The output includes the expected luminosity, supplied to
expected luminosity ratio, logarithmic residual, intrinsic scatter, mass domain
and whether the residual lies within one intrinsic standard deviation.

An outlier produces a warning, not a failed evaluation. It is evidence that the
object is atypical for that population relation; it does not by itself prove
that the star is off the main sequence. Age, metallicity, multiplicity,
extinction and measurement error can all matter.

## Planetary energy balance

The `planetary-energy-balance` pack contains:

- `orbit.stellar-irradiance`, using `F = L/(4πd²)`;
- `planet.blackbody-equilibrium-temperature`, using globally redistributed
  absorbed and emitted power balance.

The temperature model requires a bolometric Bond albedo and assumes uniform
full-surface redistribution. It excludes greenhouse warming, internal heating,
spectral absorption and day/night contrast. It is an equilibrium-temperature
baseline, not a surface-temperature prediction.

## Kopparapu conservative habitable zone

`star.kopparapu-2014-conservative-hz` implements equations 4–5 and the
coefficient sets from Kopparapu et al. (2014). It returns the
runaway-greenhouse inner boundary, maximum-greenhouse outer boundary and both
effective stellar fluxes.

The prescription is valid for main-sequence effective temperatures from
2600–7200 K. The paper publishes discrete inner-edge coefficient sets for
`0.1-earth`, `1-earth` and `5-earth` planet mass classes; Tungolcraft requires
one of those named classes and does not silently interpolate. `1-earth` is the
recorded default.

These are one-dimensional cloud-free climate screening boundaries. Being
inside them is not a prediction of habitability.

## Constant-Q tides

`satellite.constant-q-eccentricity-damping` reports the local eccentricity
e-folding time

```text
τe = (2/21)(Q/k2)(ms/mp)(a/Rs)^5 / n
```

for tides dissipated inside a low-eccentricity, synchronously rotating
secondary. The caller supplies `Q` and the degree-two Love number `k2`; neither
is guessed. Both can vary strongly with composition, forcing frequency and
thermal state, so this is a screening timescale rather than an integrated tidal
history.

## Rocky interiors

`planet.zeng-2016-rocky-radius` implements the PREM-based relation

```text
R/R⊕ = (1.07 − 0.21 CMF)(M/M⊕)^(1/3.7)
```

for differentiated two-layer rocky planets. Its published domain is 1–8 Earth
masses and core mass fraction `0–0.4`. It excludes volatile envelopes and does
not infer composition from mass alone.

The SI conversion uses Tungolcraft’s exported Earth mass and mean-radius
reference scales. The dimensionless `massEarth` and `radiusEarth` values are
also returned so consumers can retain the relation in its published units.

## Replacement and versioning

Model-pack IDs and versions describe the grouping. Scientific equations remain
versioned by model ID. A future climate, tide or interior prescription should
be added under a new model ID rather than silently changing which equation an
existing ID means.

All six Milestone E models have version-locked fixtures in
[`benchmarks/fixtures.json`](../benchmarks/fixtures.json) and appear in the
generated [model reference](./MODEL-REFERENCE.md) and
[validation report](./VALIDATION.md).
