import type { ResolvedStellarMorphology } from '../stellar-surface-model.js'
import { fractalNoise, makeRandom, makeSimplex } from './procedural-noise.js'
import {
	PROCEDURAL_ALGORITHM_REVISION,
	STELLAR_PROCEDURE_PROFILE as PROFILE,
} from './procedural-profiles.js'

type Rgb = [number, number, number]

export type ProceduralStellarSurfaceParameters = {
	temperatureK: number
	morphology: ResolvedStellarMorphology
	rotationDays: number
	activity: number
	seed: number
}

export type GeneratedStellarSurface = {
	width: number
	height: number
	/** Display-referred sRGB photosphere pixels, not calibrated stellar radiance. */
	photosphere: Uint8Array
	spotCoverageEstimate: number
	algorithmRevision: number
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

/**
 * Approximate correlated-color-temperature display color in sRGB. This is a
 * useful visualization fit, not a spectral integration or a radiance model.
 */
export function temperatureDisplayRgb(temperatureK: number): Rgb {
	const temperature = clamp(temperatureK, 1_000, 40_000) / 100
	const red = temperature <= 66
		? 255
		: 329.698727446 * Math.pow(temperature - 60, -0.1332047592)
	const green = temperature <= 66
		? 99.4708025861 * Math.log(temperature) - 161.1195681661
		: 288.1221695283 * Math.pow(temperature - 60, -0.0755148492)
	const blue = temperature >= 66
		? 255
		: (temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307)
	return [clamp(red, 0, 255), clamp(green, 0, 255), clamp(blue, 0, 255)]
}

export function srgbChannelToLinear(value: number): number {
	const channel = clamp(value, 0, 1)
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

export function linearChannelToSrgb(value: number): number {
	const channel = Math.max(0, value)
	return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

function linearTemperatureColor(temperatureK: number): [number, number, number] {
	return temperatureDisplayRgb(temperatureK).map(channel => srgbChannelToLinear(channel / 255)) as [number, number, number]
}

/**
 * Allocation-free variant of linearTemperatureColor for the per-pixel loop.
 * Must stay operation-for-operation identical so plates remain byte-stable.
 */
function writeLinearTemperatureColor(temperatureK: number, target: Float64Array): void {
	const temperature = clamp(temperatureK, 1_000, 40_000) / 100
	const red = temperature <= 66
		? 255
		: 329.698727446 * Math.pow(temperature - 60, -0.1332047592)
	const green = temperature <= 66
		? 99.4708025861 * Math.log(temperature) - 161.1195681661
		: 288.1221695283 * Math.pow(temperature - 60, -0.0755148492)
	const blue = temperature >= 66
		? 255
		: (temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307)
	target[0] = srgbChannelToLinear(clamp(red, 0, 255) / 255)
	target[1] = srgbChannelToLinear(clamp(green, 0, 255) / 255)
	target[2] = srgbChannelToLinear(clamp(blue, 0, 255) / 255)
}

/**
 * Starwright's seeded photosphere fallback. It creates a seamless 2:1 plate by
 * sampling three-dimensional noise on a unit sphere. Granulation, spots, and
 * faculae are illustrative morphology, never observational surface data.
 */
export function generateProceduralStellarSurface(
	parameters: ProceduralStellarSurfaceParameters,
	width = 256,
	height = Math.round(width / 2),
): GeneratedStellarSurface {
	const safeWidth = Math.max(8, Math.trunc(width))
	const safeHeight = Math.max(4, Math.trunc(height))
	const photosphere = new Uint8Array(safeWidth * safeHeight * 4)
	const temperatureK = clamp(parameters.temperatureK, 1_000, 40_000)
	const activity = clamp(parameters.activity, 0, 1)
	const rotationDays = Math.max(parameters.rotationDays, 1 / 86_400)
	const primaryNoise = makeSimplex(parameters.seed)
	const detailNoise = makeSimplex(parameters.seed ^ 0x9E3779B9)
	const activityNoise = makeSimplex(parameters.seed ^ 0x51AB3F)
	const [convectionMinimumK, convectionMaximumK] = PROFILE.convectionTemperatureRangeK
	const convection = clamp(
		(convectionMaximumK - temperatureK) / (convectionMaximumK - convectionMinimumK),
		0,
		1,
	)
	const granulationScale = PROFILE.granulationScale[parameters.morphology]
	const baseGranulationAmplitude = PROFILE.granulationAmplitude[parameters.morphology]
	const granulationAmplitude = parameters.morphology === 'main_sequence'
		? baseGranulationAmplitude + convection * 0.16
		: baseGranulationAmplitude

	type Spot = { longitude: number, latitude: number, radius: number, coolingK: number }
	const spots: Spot[] = []
	if (parameters.morphology !== 'white_dwarf' && convection > 0.05) {
		const random = makeRandom(parameters.seed ^ 0xCAFE)
		const spin = clamp(28 / Math.max(rotationDays, 0.5), 0.4, 6)
		const groupCount = Math.round(activity * spin * convection * (parameters.morphology === 'giant' ? 3 : 8))
		for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
			const latitude = (0.12 + 0.42 * random()) * (random() > 0.5 ? 1 : -1)
			const longitude = random() * Math.PI * 2
			const memberCount = 1 + Math.floor(random() * 3.2)
			for (let memberIndex = 0; memberIndex < memberCount; memberIndex++) {
				spots.push({
					longitude: longitude + (random() - 0.5) * 0.22,
					latitude: latitude + (random() - 0.5) * 0.1,
					radius: (0.02 + random() * random() * 0.075) * (parameters.morphology === 'giant' ? 2.4 : 1),
					coolingK: 1_000 + random() * 800,
				})
			}
		}
	}
	// Spherical-cap coverage summed without attempting to de-overlap spot groups.
	const spotCoverageEstimate = clamp(
		spots.reduce((sum, spot) => sum + (1 - Math.cos(spot.radius)) / 2, 0),
		0,
		1,
	)
	const faculaStrength = convection * activity * PROFILE.faculaMaximum
	const meanLinearColor = linearTemperatureColor(temperatureK)
	const localLinearColor = new Float64Array(3)

	for (let pixelY = 0; pixelY < safeHeight; pixelY++) {
		const latitude = (0.5 - (pixelY + 0.5) / safeHeight) * Math.PI
		const latitudeSin = Math.sin(latitude)
		const latitudeCos = Math.cos(latitude)
		for (let pixelX = 0; pixelX < safeWidth; pixelX++) {
			const longitude = ((pixelX + 0.5) / safeWidth) * Math.PI * 2
			const x = latitudeCos * Math.cos(longitude)
			const y = latitudeSin
			const z = latitudeCos * Math.sin(longitude)
			const granulation = primaryNoise(
				x * granulationScale,
				y * granulationScale,
				z * granulationScale,
			)
			const detail = fractalNoise(
				detailNoise,
				x * granulationScale * 2.7,
				y * granulationScale * 2.7,
				z * granulationScale * 2.7,
				3,
				2.2,
				0.5,
			)
			let brightness = 1 + granulationAmplitude * (
				(Math.abs(granulation) < 0.2 ? -1.5 : 0.55) + detail * 0.9
			) + fractalNoise(detailNoise, x * 3.5, y * 3.5, z * 3.5, 2) * 0.035

			if (rotationDays < 8 && parameters.morphology === 'main_sequence') {
				brightness += fractalNoise(activityNoise, x * 3, y * 14, z * 3, 2)
					* 0.02 * (8 - rotationDays) / 8
			}

			let localTemperatureK = temperatureK * Math.pow(
				clamp(brightness, 0.6, 1.4),
				PROFILE.localTemperatureExponent,
			)
			if (faculaStrength > 0.005) {
				const facula = fractalNoise(
					activityNoise,
					x * granulationScale * 1.4,
					y * granulationScale * 1.4,
					z * granulationScale * 1.4,
					3,
					2.3,
					0.5,
				)
				if (Math.abs(facula) < 0.06) {
					localTemperatureK += temperatureK * faculaStrength * (1 - Math.abs(facula) / 0.06)
				}
			}

			for (const spot of spots) {
				// Great-circle distance is at least the latitude separation, so a
				// pixel outside the spot's latitude band can never be inside it.
				const latitudeDifference = latitude - spot.latitude
				if (latitudeDifference >= spot.radius || -latitudeDifference >= spot.radius) continue
				let longitudeDifference = longitude - spot.longitude
				if (longitudeDifference > Math.PI) longitudeDifference -= Math.PI * 2
				if (longitudeDifference < -Math.PI) longitudeDifference += Math.PI * 2
				const distance = Math.hypot(
					longitudeDifference * latitudeCos,
					latitudeDifference,
				)
				if (distance >= spot.radius) continue
				const radiusFraction = distance / spot.radius
				const cooling = radiusFraction < 0.55
					? spot.coolingK
					: spot.coolingK * (1 - (radiusFraction - 0.55) / 0.45) * 0.45
				localTemperatureK -= cooling
			}

			writeLinearTemperatureColor(localTemperatureK, localLinearColor)
			const intensity = Math.pow(
				localTemperatureK / temperatureK,
				PROFILE.bolometricDisplayExponent,
			) * PROFILE.outputExposure
			const offset = (pixelY * safeWidth + pixelX) * 4
			for (let channel = 0; channel < 3; channel++) {
				const contrasted = meanLinearColor[channel]
					+ (localLinearColor[channel] - meanLinearColor[channel]) * PROFILE.colorContrast
				photosphere[offset + channel] = clamp(
					Math.round(linearChannelToSrgb(contrasted * intensity) * 255),
					0,
					255,
				)
			}
			photosphere[offset + 3] = 255
		}
	}

	return {
		width: safeWidth,
		height: safeHeight,
		photosphere,
		spotCoverageEstimate,
		algorithmRevision: PROCEDURAL_ALGORITHM_REVISION,
	}
}
