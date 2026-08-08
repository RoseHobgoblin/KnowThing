import type { ResolvedStellarMorphology } from '../stellar-surface-model.js'
import type { ResolvedSurfaceClass } from '../surface-model.js'

export const PROCEDURAL_ALGORITHM_REVISION = 5 as const
export const COVERAGE_CALIBRATION_WIDTH = 256
export const COVERAGE_CALIBRATION_HEIGHT = 128

export type Rgb = [number, number, number]

export type PlanetProcedureProfile = {
	terrain: {
		baseFrequency: number
		detailFrequency: number
		baseOctaves: number
		detailOctaves: number
		detailAmplitude: number
		heightAmplitude: number
	}
	climate: {
		equatorialOffsetK: number
		latitudeCoolingK: number
		latitudeExponent: number
		altitudeCoolingK: number
		vegetationCoolEdgeK: [number, number]
		vegetationWarmEdgeK: [number, number]
	}
	placement: {
		climateFrequency: number
		vegetationClimateWeight: number
		vegetationAltitudePenalty: number
		snowLatitudeWeight: number
		snowAltitudeWeight: number
		snowColdWeight: number
		snowClimateWeight: number
	}
	display: {
		waterShallow: Rgb
		waterDeep: Rgb
		lowland: Rgb
		highland: Rgb
		vegetationDry: Rgb
		vegetationWet: Rgb
		landSnow: [Rgb, Rgb]
		seaIce: [Rgb, Rgb]
		tintStrength: number
	}
}

/**
 * Internal illustrative profile. Climate values rank plausible placement;
 * authored coverage targets remain authoritative and are calibrated separately.
 */
export const PLANET_PROCEDURE_PROFILE: PlanetProcedureProfile = {
	terrain: {
		baseFrequency: 1.45,
		detailFrequency: 5.2,
		baseOctaves: 5,
		detailOctaves: 3,
		detailAmplitude: 0.24,
		heightAmplitude: 0.48,
	},
	climate: {
		equatorialOffsetK: 14,
		latitudeCoolingK: 45,
		latitudeExponent: 1.35,
		altitudeCoolingK: 24,
		vegetationCoolEdgeK: [252, 272],
		vegetationWarmEdgeK: [307, 327],
	},
	placement: {
		climateFrequency: 3.1,
		vegetationClimateWeight: 0.66,
		vegetationAltitudePenalty: 0.58,
		snowLatitudeWeight: 0.62,
		snowAltitudeWeight: 0.48,
		snowColdWeight: 0.38,
		snowClimateWeight: 0.08,
	},
	display: {
		waterShallow: [62, 111, 151],
		waterDeep: [14, 37, 72],
		lowland: [132, 115, 88],
		highland: [102, 92, 82],
		vegetationDry: [111, 137, 55],
		vegetationWet: [28, 83, 40],
		landSnow: [[211, 220, 224], [242, 242, 237]],
		seaIce: [[198, 216, 228], [231, 237, 239]],
		tintStrength: 0.18,
	},
}

export const GAS_DISPLAY_PROFILES: Record<'warm' | 'cool', Rgb[]> = {
	warm: [[213, 194, 164], [166, 130, 91], [235, 222, 198], [137, 98, 78]],
	cool: [[139, 156, 174], [79, 101, 130], [186, 197, 207], [69, 80, 102]],
}

/** Purely illustrative placement and edge softness for a representative cloud state. */
export const CLOUD_PROCEDURE_PROFILE = {
	frequencyXz: 2.7,
	frequencyY: 4.1,
	octaves: 5,
	thresholdSoftness: 0.08,
} as const

export type StellarProcedureProfile = {
	granulationScale: Record<ResolvedStellarMorphology, number>
	granulationAmplitude: Record<ResolvedStellarMorphology, number>
	convectionTemperatureRangeK: [number, number]
	localTemperatureExponent: number
	bolometricDisplayExponent: number
	outputExposure: number
	colorContrast: number
	faculaMaximum: number
}

/** Scientific approximations, display transfer, and aesthetic controls are named separately here. */
export const STELLAR_PROCEDURE_PROFILE: StellarProcedureProfile = {
	granulationScale: { main_sequence: 15, giant: 2.2, white_dwarf: 15 },
	granulationAmplitude: { main_sequence: 0.05, giant: 0.3, white_dwarf: 0.008 },
	convectionTemperatureRangeK: [4_000, 7_200],
	// T scales as the fourth root of relative brightness (Stefan-Boltzmann approximation).
	localTemperatureExponent: 0.25,
	// Compresses the physical T^4 relation for a display-referred texture.
	bolometricDisplayExponent: 2.2,
	outputExposure: 0.94,
	// Aesthetic linear-space contrast around the mean photosphere color.
	colorContrast: 1.08,
	faculaMaximum: 0.1,
}

export function supportsCoverage(surfaceClass: ResolvedSurfaceClass, kind: 'water' | 'vegetation' | 'snow'): boolean {
	if (kind === 'vegetation') return surfaceClass === 'terrestrial'
	return surfaceClass === 'rocky' || surfaceClass === 'terrestrial'
}
