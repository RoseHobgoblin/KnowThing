import type { ModelReference } from './model-types.js'

export const MODEL_IDS = {
	bulkDensity: 'body.bulk-density',
	ellipticalState: 'orbit.elliptical-state',
	satelliteStability: 'satellite.domingos-2006-limit',
} as const

export type ModelId = typeof MODEL_IDS[keyof typeof MODEL_IDS]

const BULK_DENSITY_MODEL = {
	id: MODEL_IDS.bulkDensity,
	version: '1.0.0',
	title: 'Spherical bulk density',
	summary: 'Mean density from mass divided by the volume of a sphere.',
	kind: 'exact-relation',
	sources: [{ type: 'derivation', citation: 'ρ = M / ((4/3)πr³)' }],
	assumptions: [
		'the supplied radius represents a volume-equivalent spherical radius',
		'mass and radius describe the same body',
	],
	validity: [
		{ field: 'massKg', operator: 'finite' },
		{ field: 'massKg', operator: 'gt', value: 0, unit: 'kg' },
		{ field: 'radiusM', operator: 'finite' },
		{ field: 'radiusM', operator: 'gt', value: 0, unit: 'm' },
	],
} as const satisfies ModelReference

const ELLIPTICAL_STATE_MODEL = {
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
		'two point masses with constant total gravitational parameter',
		'no perturbations, relativistic corrections or light-time correction',
		'bound elliptical orbit',
		'right-handed parent-centred inertial frame with reference plane in XY',
	],
	validity: [
		{ field: 'semiMajorAxisAu', operator: 'finite' },
		{ field: 'semiMajorAxisAu', operator: 'gt', value: 0, unit: 'AU' },
		{ field: 'eccentricity', operator: 'finite' },
		{ field: 'eccentricity', operator: 'gte', value: 0, unit: '1' },
		{ field: 'eccentricity', operator: 'lt', value: 1, unit: '1' },
		{ field: 'muM3S2', operator: 'finite' },
		{ field: 'muM3S2', operator: 'gt', value: 0, unit: 'm^3/s^2' },
		{ field: 'epochPhase', operator: 'finite' },
		{ field: 'epochPhase', operator: 'gte', value: 0, unit: '1' },
		{ field: 'epochPhase', operator: 'lte', value: 1, unit: '1' },
		{ description: 'all angles and the evaluation day must be finite' },
	],
} as const satisfies ModelReference

const SATELLITE_STABILITY_MODEL = {
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
		{ field: 'hillRadiusAu', operator: 'finite' },
		{ field: 'hillRadiusAu', operator: 'gt', value: 0, unit: 'AU' },
		{ field: 'parentEccentricity', operator: 'finite' },
		{ field: 'parentEccentricity', operator: 'gte', value: 0, unit: '1' },
		{ field: 'parentEccentricity', operator: 'lt', value: 1, unit: '1' },
		{ field: 'satelliteEccentricity', operator: 'finite' },
		{ field: 'satelliteEccentricity', operator: 'gte', value: 0, unit: '1' },
		{ field: 'satelliteEccentricity', operator: 'lt', value: 1, unit: '1' },
		{ field: 'orbitSense', operator: 'one-of', values: ['prograde', 'retrograde'] },
	],
} as const satisfies ModelReference

export const MODEL_REFERENCES: Readonly<Record<ModelId, ModelReference>> = Object.freeze({
	[MODEL_IDS.bulkDensity]: BULK_DENSITY_MODEL,
	[MODEL_IDS.ellipticalState]: ELLIPTICAL_STATE_MODEL,
	[MODEL_IDS.satelliteStability]: SATELLITE_STABILITY_MODEL,
})

export function getModelReference(id: ModelId): ModelReference {
	return MODEL_REFERENCES[id]
}

export function listModelReferences(): readonly ModelReference[] {
	return Object.values(MODEL_REFERENCES)
}
