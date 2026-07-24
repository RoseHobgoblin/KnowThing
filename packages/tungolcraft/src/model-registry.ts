import type { ModelReference, UnitSymbol, ValidityRule } from './model-types.js'

export const MODEL_IDS = {
	bulkDensity: 'body.bulk-density',
	surfaceGravity: 'body.surface-gravity',
	escapeVelocity: 'body.escape-velocity',
	rotationalBreakup: 'body.rotational-breakup',
	keplerPeriod: 'orbit.kepler-period',
	visVivaSpeed: 'orbit.vis-viva-speed',
	meanSpeed: 'orbit.mean-speed',
	ellipticalState: 'orbit.elliptical-state',
	hillRadius: 'orbit.hill-radius',
	parentBarycenterDistance: 'binary.parent-barycenter-distance',
	satelliteStability: 'satellite.domingos-2006-limit',
	rocheLimit: 'satellite.roche-limit',
	stefanBoltzmannLuminosity: 'star.stefan-boltzmann-luminosity',
	simpleHabitableZone: 'star.simple-habitable-zone',
	ekerMainSequenceScreen: 'star.eker-2018-main-sequence-screen',
	stellarIrradiance: 'orbit.stellar-irradiance',
	blackbodyEquilibriumTemperature: 'planet.blackbody-equilibrium-temperature',
	kopparapuConservativeHabitableZone: 'star.kopparapu-2014-conservative-hz',
	constantQEccentricityDamping: 'satellite.constant-q-eccentricity-damping',
	zengRockyRadius: 'planet.zeng-2016-rocky-radius',
} as const

export type ModelId = typeof MODEL_IDS[keyof typeof MODEL_IDS]

function positive(field: string, unit: UnitSymbol): readonly ValidityRule[] {
	return [
		{ field, operator: 'finite' },
		{ field, operator: 'gt', value: 0, unit },
	]
}

function reference(value: ModelReference): ModelReference {
	return value
}

const SPHERICAL_BODY_ASSUMPTIONS = [
	'the body is represented by a volume-equivalent sphere',
	'mass and radius describe the same body',
] as const

const TWO_BODY_ASSUMPTIONS = [
	'two point masses governed only by Newtonian gravity',
	'the supplied gravitational parameter is the total μ = G(M + m)',
	'no perturbations or relativistic corrections',
] as const

const MODEL_REFERENCE_LIST = [
	reference({
		id: MODEL_IDS.bulkDensity,
		version: '1.0.0',
		title: 'Spherical bulk density',
		summary: 'Mean density from mass divided by the volume of a sphere.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'ρ = M / ((4/3)πr³)' }],
		assumptions: SPHERICAL_BODY_ASSUMPTIONS,
		validity: [...positive('massKg', 'kg'), ...positive('radiusM', 'm')],
	}),
	reference({
		id: MODEL_IDS.surfaceGravity,
		version: '1.0.0',
		title: 'Spherical surface gravity',
		summary: 'Newtonian gravitational acceleration at a spherical body surface.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'g = GM/r²' }],
		assumptions: [
			...SPHERICAL_BODY_ASSUMPTIONS,
			'rotation and external tidal acceleration are excluded',
		],
		validity: [...positive('massKg', 'kg'), ...positive('radiusM', 'm')],
	}),
	reference({
		id: MODEL_IDS.escapeVelocity,
		version: '1.0.0',
		title: 'Spherical escape velocity',
		summary: 'Newtonian surface escape speed for a spherical isolated body.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'vₑ = √(2GM/r)' }],
		assumptions: [
			...SPHERICAL_BODY_ASSUMPTIONS,
			'escape ends at infinite distance with zero residual speed',
			'atmospheric drag, rotation and external gravitating bodies are excluded',
		],
		validity: [...positive('massKg', 'kg'), ...positive('radiusM', 'm')],
	}),
	reference({
		id: MODEL_IDS.rotationalBreakup,
		version: '1.0.0',
		title: 'Gravity-only rotational breakup period',
		summary: 'Critical spin period where equatorial centrifugal acceleration equals spherical surface gravity.',
		kind: 'screening',
		sources: [{ type: 'derivation', citation: 'Pcrit = √(3π/(Gρ))' }],
		assumptions: [
			'uniform spherical bulk density',
			'gravity is the only force resisting disruption',
			'material strength, deformation and internal differentiation are excluded',
		],
		validity: positive('densityKgM3', 'kg/m^3'),
	}),
	reference({
		id: MODEL_IDS.keplerPeriod,
		version: '1.0.0',
		title: 'Keplerian two-body period',
		summary: 'Orbital period from relative-orbit semi-major axis and total gravitational parameter.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'T = 2π√(a³/μ)' }],
		assumptions: TWO_BODY_ASSUMPTIONS,
		validity: [...positive('semiMajorAxisAu', 'AU'), ...positive('muM3S2', 'm^3/s^2')],
	}),
	reference({
		id: MODEL_IDS.visVivaSpeed,
		version: '1.0.0',
		title: 'Vis-viva orbital speed',
		summary: 'Instantaneous two-body speed from orbital radius, semi-major axis and total gravitational parameter.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'v = √(μ(2/r − 1/a))' }],
		assumptions: TWO_BODY_ASSUMPTIONS,
		validity: [
			...positive('muM3S2', 'm^3/s^2'),
			...positive('radiusAu', 'AU'),
			...positive('semiMajorAxisAu', 'AU'),
			{ description: 'radiusAu must satisfy radiusAu < 2 × semiMajorAxisAu for a positive bound-orbit speed' },
		],
	}),
	reference({
		id: MODEL_IDS.meanSpeed,
		version: '1.0.0',
		title: 'Mean elliptical orbital speed',
		summary: 'Ramanujan ellipse perimeter divided by orbital period.',
		kind: 'approximation',
		sources: [{
			type: 'derivation',
			citation: 'Ramanujan second approximation for ellipse circumference divided by period',
		}],
		assumptions: [
			'the path is a fixed bound Keplerian ellipse',
			'the result is the time-average of speed magnitude over one complete orbit',
		],
		validity: [
			...positive('semiMajorAxisAu', 'AU'),
			...positive('orbitalPeriodDays', 'd'),
			{ field: 'eccentricity', operator: 'finite' },
			{ field: 'eccentricity', operator: 'gte', value: 0, unit: '1' },
			{ field: 'eccentricity', operator: 'lt', value: 1, unit: '1' },
		],
	}),
	reference({
		id: MODEL_IDS.ellipticalState,
		version: '1.0.0',
		title: 'Elliptical two-body state vector',
		summary: 'Propagates classical orbital elements to parent-centred inertial position and velocity.',
		kind: 'numerical-solution',
		sources: [{
			type: 'derivation',
			citation: 'Keplerian two-body propagation from classical orbital elements',
		}],
		assumptions: [
			...TWO_BODY_ASSUMPTIONS,
			'bound elliptical orbit',
			'right-handed parent-centred inertial frame with reference plane in XY',
		],
		validity: [
			...positive('semiMajorAxisAu', 'AU'),
			{ field: 'eccentricity', operator: 'finite' },
			{ field: 'eccentricity', operator: 'gte', value: 0, unit: '1' },
			{ field: 'eccentricity', operator: 'lt', value: 1, unit: '1' },
			...positive('muM3S2', 'm^3/s^2'),
			{ field: 'epochPhase', operator: 'finite' },
			{ field: 'epochPhase', operator: 'gte', value: 0, unit: '1' },
			{ field: 'epochPhase', operator: 'lte', value: 1, unit: '1' },
			{ description: 'all angles and the evaluation day must be finite' },
		],
	}),
	reference({
		id: MODEL_IDS.hillRadius,
		version: '1.0.0',
		title: 'Periapsis-scaled Hill radius',
		summary: 'Approximate Hill radius for a secondary on a bound eccentric orbit.',
		kind: 'approximation',
		sources: [{ type: 'derivation', citation: 'rH ≈ a(1 − e)(m/(3M))^(1/3)' }],
		assumptions: [
			'restricted three-body approximation',
			'the secondary mass is small relative to the parent mass',
			'the eccentric correction evaluates the tightest radius at periapsis',
		],
		validity: [
			...positive('semiMajorAxisAu', 'AU'),
			...positive('bodyMassKg', 'kg'),
			...positive('parentMassKg', 'kg'),
			{ field: 'eccentricity', operator: 'finite' },
			{ field: 'eccentricity', operator: 'gte', value: 0, unit: '1' },
			{ field: 'eccentricity', operator: 'lt', value: 1, unit: '1' },
		],
	}),
	reference({
		id: MODEL_IDS.parentBarycenterDistance,
		version: '1.0.0',
		title: 'Parent-to-barycenter distance',
		summary: 'Distance from the parent centre to the barycenter of a two-body pair.',
		kind: 'exact-relation',
		sources: [{ type: 'derivation', citation: 'r₁ = a m₂/(m₁ + m₂)' }],
		assumptions: [
			'separationAu is the relative centre-to-centre semi-major axis or instantaneous separation being partitioned',
			'both bodies are represented by their centres of mass',
		],
		validity: [
			...positive('separationAu', 'AU'),
			...positive('parentMassKg', 'kg'),
			...positive('companionMassKg', 'kg'),
		],
	}),
	reference({
		id: MODEL_IDS.satelliteStability,
		version: '1.0.0',
		title: 'Domingos 2006 satellite outer-stability limit',
		summary: 'Empirical prograde or retrograde satellite limit in the restricted elliptic three-body problem.',
		kind: 'empirical-fit',
		sources: [{
			type: 'paper',
			citation: 'Domingos, Winter & Yokoyama (2006), Stable satellites around extrasolar giant planets',
			doi: '10.1111/j.1365-2966.2006.11104.x',
			url: 'https://doi.org/10.1111/j.1365-2966.2006.11104.x',
		}],
		assumptions: [
			'restricted elliptic three-body problem',
			'satellite mass is negligible compared with parent and star',
			'outer empirical screening boundary, not an N-body stability guarantee',
			'hillRadiusAu is the conventional Hill radius at the parent semi-major axis',
		],
		validity: [
			...positive('hillRadiusAu', 'AU'),
			{ field: 'parentEccentricity', operator: 'finite' },
			{ field: 'parentEccentricity', operator: 'gte', value: 0, unit: '1' },
			{ field: 'parentEccentricity', operator: 'lt', value: 1, unit: '1' },
			{ field: 'satelliteEccentricity', operator: 'finite' },
			{ field: 'satelliteEccentricity', operator: 'gte', value: 0, unit: '1' },
			{ field: 'satelliteEccentricity', operator: 'lt', value: 1, unit: '1' },
			{ field: 'orbitSense', operator: 'one-of', values: ['prograde', 'retrograde'] },
		],
	}),
	reference({
		id: MODEL_IDS.rocheLimit,
		version: '1.0.0',
		title: 'Idealised Roche limit',
		summary: 'Rigid or fluid gravity-only tidal disruption screening distance.',
		kind: 'screening',
		sources: [{
			type: 'derivation',
			citation: 'd = C Rparent (ρparent/ρsatellite)^(1/3), C = 2^(1/3) rigid or 2.44 fluid',
		}],
		assumptions: [
			'spherical parent and satellite with represented mean densities',
			'the rigid case does not model material tensile strength',
			'the fluid case assumes a synchronously rotating deformable satellite',
		],
		validity: [
			...positive('parentRadiusM', 'm'),
			...positive('parentDensityKgM3', 'kg/m^3'),
			...positive('satelliteDensityKgM3', 'kg/m^3'),
			{ field: 'rigidity', operator: 'one-of', values: ['rigid', 'fluid'] },
		],
	}),
	reference({
		id: MODEL_IDS.stefanBoltzmannLuminosity,
		version: '1.0.0',
		title: 'Stefan–Boltzmann luminosity',
		summary: 'Bolometric luminosity of a spherical blackbody from radius and effective temperature.',
		kind: 'exact-relation',
		sources: [{ type: 'standard', citation: 'L = 4πR²σT⁴ using the SI Stefan–Boltzmann constant' }],
		assumptions: [
			'the source is spherical',
			'temperatureK is the effective blackbody temperature over the full surface',
			'radiusM is the radiating photospheric radius',
		],
		validity: [...positive('radiusM', 'm'), ...positive('temperatureK', 'K')],
	}),
	reference({
		id: MODEL_IDS.simpleHabitableZone,
		version: '1.0.0',
		title: 'Simple luminosity-scaled habitable zone',
		summary: 'Screening annulus from fixed effective stellar-flux limits scaled by luminosity.',
		kind: 'approximation',
		sources: [{
			type: 'documentation',
			citation: 'Tungolcraft simple prescription: inner = √((L/L☉)/1.1), outer = √((L/L☉)/0.53) AU',
		}],
		assumptions: [
			'fixed effective-flux limits of 1.1 and 0.53 times the solar constant',
			'stellar spectral energy distribution and planetary atmosphere are ignored',
			'the result is a preliminary screening range, not a habitability prediction',
		],
		validity: positive('luminosityW', 'W'),
	}),
	reference({
		id: MODEL_IDS.ekerMainSequenceScreen,
		version: '1.0.0',
		title: 'Eker 2018 main-sequence luminosity screen',
		summary: 'Compares a supplied stellar luminosity with the six-piece empirical mass–luminosity relation.',
		kind: 'screening',
		sources: [{
			type: 'paper',
			citation: 'Eker et al. (2018), MNRAS 479, 5491–5511, Table 4',
			doi: '10.1093/mnras/sty1834',
			url: 'https://arxiv.org/abs/1807.02568',
		}],
		assumptions: [
			'the object is a main-sequence star drawn from the Solar-neighbourhood Galactic-disc population',
			'the relation represents a population mean; age and metallicity are not independently modelled',
			'the reported one-sigma classification uses the paper’s intrinsic log-luminosity scatter',
		],
		validity: [
			{ field: 'massKg', operator: 'finite' },
			{ description: 'massKg must lie between 0.179 and 31 exported solar-mass reference units' },
			...positive('luminosityW', 'W'),
		],
	}),
	reference({
		id: MODEL_IDS.stellarIrradiance,
		version: '1.0.0',
		title: 'Isotropic stellar irradiance',
		summary: 'Bolometric flux at an orbital distance from an isotropically radiating source.',
		kind: 'exact-relation',
		sources: [{
			type: 'derivation',
			citation: 'Inverse-square energy conservation: F = L/(4πd²)',
		}],
		assumptions: [
			'luminosity is bolometric and emitted isotropically',
			'distance is centre-to-centre and large compared with the radiating source',
			'attenuation, eclipses and other luminous sources are excluded',
		],
		validity: [
			...positive('luminosityW', 'W'),
			...positive('distanceAu', 'AU'),
		],
	}),
	reference({
		id: MODEL_IDS.blackbodyEquilibriumTemperature,
		version: '1.0.0',
		title: 'Globally redistributed blackbody equilibrium temperature',
		summary: 'Radiative-equilibrium temperature from stellar luminosity, distance and Bond albedo.',
		kind: 'exact-relation',
		sources: [{
			type: 'derivation',
			citation: 'Absorbed πR²F(1−A) equals emitted 4πR²σT⁴',
		}],
		assumptions: [
			'the body is a spherical blackbody in steady radiative equilibrium',
			'absorbed energy is uniformly redistributed over the entire surface',
			'Bond albedo is bolometric and internal heating and greenhouse warming are excluded',
		],
		validity: [
			...positive('luminosityW', 'W'),
			...positive('distanceAu', 'AU'),
			{ field: 'bondAlbedo', operator: 'gte', value: 0, unit: '1' },
			{ field: 'bondAlbedo', operator: 'lt', value: 1, unit: '1' },
		],
	}),
	reference({
		id: MODEL_IDS.kopparapuConservativeHabitableZone,
		version: '1.0.0',
		title: 'Kopparapu 2014 conservative habitable zone',
		summary: 'Runaway-greenhouse inner and maximum-greenhouse outer limits for terrestrial mass classes.',
		kind: 'approximation',
		sources: [{
			type: 'paper',
			citation: 'Kopparapu et al. (2014), ApJ Letters 787 L29, equations 4–5 and Table 1',
			doi: '10.1088/2041-8205/787/2/L29',
			url: 'https://arxiv.org/abs/1404.5292',
		}],
		assumptions: [
			'the host is a main-sequence star',
			'the inner edge uses the runaway-greenhouse prescription and the outer edge maximum greenhouse',
			'the one-dimensional cloud-free H2O/CO2 climate assumptions of the paper apply',
			'planet mass is one of the paper’s discrete 0.1, 1 or 5 Earth-mass coefficient sets',
		],
		validity: [
			...positive('luminosityW', 'W'),
			{ field: 'effectiveTemperatureK', operator: 'gte', value: 2600, unit: 'K' },
			{ field: 'effectiveTemperatureK', operator: 'lte', value: 7200, unit: 'K' },
			{ field: 'planetMassClass', operator: 'one-of', values: ['0.1-earth', '1-earth', '5-earth'] },
		],
	}),
	reference({
		id: MODEL_IDS.constantQEccentricityDamping,
		version: '1.0.0',
		title: 'Constant-Q eccentricity damping timescale',
		summary: 'Screening e-folding time for eccentricity tides dissipated inside a synchronous secondary.',
		kind: 'screening',
		sources: [{
			type: 'paper',
			citation: 'Goldreich & Soter (1966), Icarus 5, 375–389; standard low-e constant-Q form',
			doi: '10.1016/0019-1035(66)90051-0',
			url: 'https://ntrs.nasa.gov/citations/19660058733',
		}, {
			type: 'textbook',
			citation: 'Murray & Dermott (1999), Solar System Dynamics, equation 4.198',
		}],
		assumptions: [
			'the secondary is synchronously rotating with low eccentricity and zero obliquity',
			'tides dissipated inside the secondary dominate',
			'Q and degree-two Love number k2 are constant',
			'the timescale is a local screening estimate, not an integrated tidal history',
		],
		validity: [
			...positive('semiMajorAxisAu', 'AU'),
			...positive('satelliteRadiusM', 'm'),
			...positive('satelliteMassKg', 'kg'),
			...positive('parentMassKg', 'kg'),
			...positive('tidalQualityFactor', '1'),
			...positive('loveNumberK2', '1'),
		],
	}),
	reference({
		id: MODEL_IDS.zengRockyRadius,
		version: '1.0.0',
		title: 'Zeng 2016 two-layer rocky-planet radius',
		summary: 'PREM-based semi-empirical radius for differentiated iron-core and silicate-mantle planets.',
		kind: 'empirical-fit',
		sources: [{
			type: 'paper',
			citation: 'Zeng, Sasselov & Jacobsen (2016), ApJ 819 127',
			doi: '10.3847/0004-637X/819/2/127',
			url: 'https://arxiv.org/abs/1512.08827',
		}],
		assumptions: [
			'the planet is fully differentiated into an iron core and silicate mantle',
			'the PREM-based semi-empirical relation represents a solid rocky planet without a volatile envelope',
			'thermal and compositional variations beyond core mass fraction are excluded',
		],
		validity: [
			{ field: 'massKg', operator: 'finite' },
			{ description: 'massKg must lie between 1 and 8 exported Earth-mass reference units' },
			{ field: 'coreMassFraction', operator: 'gte', value: 0, unit: '1' },
			{ field: 'coreMassFraction', operator: 'lte', value: 0.4, unit: '1' },
		],
	}),
] as const

export const MODEL_REFERENCES: Readonly<Record<ModelId, ModelReference>> = Object.freeze(
	Object.fromEntries(MODEL_REFERENCE_LIST.map(model => [model.id, model])) as Record<ModelId, ModelReference>,
)

export function getModelReference(id: ModelId): ModelReference {
	return MODEL_REFERENCES[id]
}

export function listModelReferences(): readonly ModelReference[] {
	return MODEL_REFERENCE_LIST
}
