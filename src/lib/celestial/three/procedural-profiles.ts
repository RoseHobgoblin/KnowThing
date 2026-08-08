import type { ResolvedStellarMorphology } from '../stellar-surface-model.js'
import type { ResolvedSurfaceClass } from '../surface-model.js'

export const PROCEDURAL_ALGORITHM_REVISION = 6 as const
export const COVERAGE_CALIBRATION_WIDTH = 256
export const COVERAGE_CALIBRATION_HEIGHT = 128

export type Rgb = [number, number, number]

/** A gradient stop at an ascending position in an arbitrary domain (0..1, Kelvin, ...). */
export type ColorStop = [number, Rgb]

/** Linear multi-stop gradient sample, clamped to the first/last stop. */
export function sampleRamp(stops: readonly ColorStop[], position: number): Rgb {
	const first = stops[0]
	if (position <= first[0]) return [...first[1]]
	const last = stops[stops.length - 1]
	if (position >= last[0]) return [...last[1]]
	for (let index = 1; index < stops.length; index++) {
		const [end, endColor] = stops[index]
		if (position > end) continue
		const [start, startColor] = stops[index - 1]
		const amount = (position - start) / (end - start)
		return [
			startColor[0] + (endColor[0] - startColor[0]) * amount,
			startColor[1] + (endColor[1] - startColor[1]) * amount,
			startColor[2] + (endColor[2] - startColor[2]) * amount,
		]
	}
	return [...last[1]]
}

export type PlanetProcedureProfile = {
	terrain: {
		baseFrequency: number
		detailFrequency: number
		baseOctaves: number
		detailOctaves: number
		detailAmplitude: number
		heightAmplitude: number
		warpFrequency: number
		warpAmplitude: number
		warpOctaves: number
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
		waterRamp: ColorStop[]
		landRamp: ColorStop[]
		iceRamp: ColorStop[]
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
		warpFrequency: 0.9,
		warpAmplitude: 0.55,
		warpOctaves: 3,
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
		// Depth 0..1 (shore -> abyss); old two-stop colors remain interior stops.
		waterRamp: [
			[0, [96, 148, 172]],
			[0.15, [62, 111, 151]],
			[0.45, [28, 66, 105]],
			[0.75, [14, 37, 72]],
			[1, [7, 20, 44]],
		],
		// Altitude 0..1 (plain -> peak scree).
		landRamp: [
			[0, [128, 118, 86]],
			[0.3, [141, 125, 93]],
			[0.55, [114, 100, 82]],
			[0.8, [98, 90, 82]],
			[1, [139, 133, 126]],
		],
		// Ice-sheet height 0..1.
		iceRamp: [
			[0, [186, 205, 220]],
			[0.35, [203, 219, 230]],
			[0.6, [222, 231, 238]],
			[0.85, [236, 241, 243]],
			[1, [245, 246, 244]],
		],
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
