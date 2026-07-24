import {
	evaluateBulkDensity,
	evaluateEllipticalState,
	evaluateEscapeVelocity,
	evaluateHillRadius,
	evaluateKeplerPeriod,
	evaluateMeanSpeed,
	evaluateParentBarycenterDistance,
	evaluateRocheLimit,
	evaluateRotationalBreakup,
	evaluateSatelliteStability,
	evaluateSimpleHabitableZone,
	evaluateStefanBoltzmannLuminosity,
	evaluateSurfaceGravity,
	evaluateVisVivaSpeed,
} from './catalogue.js'
import type { ModelId } from './model-registry.js'
import type {
	ModelReference,
	ModelResult,
	QuantityRecord,
	UnitSymbol,
} from './model-types.js'

export type CatalogueInputValues = Readonly<Record<string, number | string | boolean>>

export const CATALOGUE_RUNNER_DIAGNOSTIC_CODES = {
	modelUnknown: 'catalogue.model.unknown',
} as const

/** Evaluate a registered catalogue model from its stable public ID. */
export function evaluateCatalogueModel(
	modelId: ModelId,
	input: CatalogueInputValues,
): ModelResult<unknown> {
	switch (modelId) {
		case 'body.bulk-density': return evaluateBulkDensity(input as never)
		case 'body.surface-gravity': return evaluateSurfaceGravity(input as never)
		case 'body.escape-velocity': return evaluateEscapeVelocity(input as never)
		case 'body.rotational-breakup': return evaluateRotationalBreakup(input as never)
		case 'orbit.kepler-period': return evaluateKeplerPeriod(input as never)
		case 'orbit.vis-viva-speed': return evaluateVisVivaSpeed(input as never)
		case 'orbit.mean-speed': return evaluateMeanSpeed(input as never)
		case 'orbit.elliptical-state': return evaluateEllipticalState(input as never)
		case 'orbit.hill-radius': return evaluateHillRadius(input as never)
		case 'binary.parent-barycenter-distance':
			return evaluateParentBarycenterDistance(input as never)
		case 'satellite.domingos-2006-limit':
			return evaluateSatelliteStability(input as never)
		case 'satellite.roche-limit': return evaluateRocheLimit(input as never)
		case 'star.stefan-boltzmann-luminosity':
			return evaluateStefanBoltzmannLuminosity(input as never)
		case 'star.simple-habitable-zone': return evaluateSimpleHabitableZone(input as never)
		default: {
			const unknownId = String(modelId)
			const model: ModelReference = {
				id: unknownId,
				version: '0.0.0',
				title: 'Unknown catalogue model',
				summary: 'The requested model ID is not registered.',
				kind: 'screening',
				sources: [{
					type: 'documentation',
					citation: 'Tungolcraft catalogue model registry',
				}],
				assumptions: [],
				validity: [],
			}
			return {
				ok: false,
				model,
				inputs: {},
				diagnostics: [{
					code: CATALOGUE_RUNNER_DIAGNOSTIC_CODES.modelUnknown,
					category: 'invalid-input',
					severity: 'error',
					message: `Unknown catalogue model ID ${unknownId}`,
					fields: ['modelId'],
					evidence: { modelId: unknownId },
					modelId: unknownId,
				}],
			}
		}
	}
}

export function isUnitSymbol(value: unknown): value is UnitSymbol {
	return typeof value === 'string' && [
		'1',
		'rad',
		'deg',
		's',
		'd',
		'm',
		'm/s',
		'm/s^2',
		'kg',
		'kg/m^3',
		'W',
		'K',
		'm^3/s^2',
		'AU',
	].includes(value)
}

/**
 * Resolve a scalar catalogue quantity. A dot path selects a member of a
 * composite output, including vector components such as `position.x`.
 */
export function readCatalogueQuantity(
	output: unknown,
	path?: string,
): QuantityRecord | null {
	let value = output
	let parent: unknown
	for (const segment of path?.split('.').filter(Boolean) ?? []) {
		if (value == null || typeof value !== 'object') return null
		parent = value
		value = (value as Record<string, unknown>)[segment]
	}
	if (
		value != null
		&& typeof value === 'object'
		&& typeof (value as Record<string, unknown>).value === 'number'
		&& isUnitSymbol((value as Record<string, unknown>).unit)
	) {
		return {
			value: (value as Record<string, number>).value,
			unit: (value as Record<string, UnitSymbol>).unit,
		}
	}
	if (
		typeof value === 'number'
		&& parent != null
		&& typeof parent === 'object'
		&& isUnitSymbol((parent as Record<string, unknown>).unit)
	) {
		return { value, unit: (parent as Record<string, UnitSymbol>).unit }
	}
	return null
}
