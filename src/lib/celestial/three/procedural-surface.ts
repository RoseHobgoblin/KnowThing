import type { ResolvedSurfaceClass, SurfaceCoverage } from '../surface-model.js'
import { fractalNoise, makeSimplex, type Noise3 } from './procedural-noise.js'
import {
	COVERAGE_CALIBRATION_HEIGHT,
	COVERAGE_CALIBRATION_WIDTH,
	CLOUD_PROCEDURE_PROFILE,
	GAS_DISPLAY_PROFILES,
	PLANET_PROCEDURE_PROFILE as PROFILE,
	PROCEDURAL_ALGORITHM_REVISION,
	supportsCoverage,
	type Rgb,
} from './procedural-profiles.js'

export type ProceduralSurfaceParameters = {
	class: ResolvedSurfaceClass
	seed: number
	temperatureK: number | null
	coverage: SurfaceCoverage
	clouds?: { meanCover: number, seed: number } | null
	tint?: [number, number, number] | null
}

export type MeasuredSurfaceCoverage = {
	surfaceWater: number
	permanentSnowIce: number
	vegetation: number
	vegetationOfSurface: number
	meanCloudCover: number
}

export type GeneratedSurface = {
	width: number
	height: number
	albedo: Uint8Array
	elevation: Uint8Array | null
	roughness: Uint8Array
	clouds: Uint8Array | null
	measuredCoverage: MeasuredSurfaceCoverage
	algorithmRevision: number
	diagnostics: string[]
}

type SurfacePoint = {
	x: number
	y: number
	z: number
	latitudeSin: number
	latitudePow: number
	weight: number
	height: number
	climate: number
	localTemperatureK: number
	altitude: number
}
/** Latitude-only terms shared by every pixel in an equirectangular row. */
type RowContext = {
	latitudeCos: number
	latitudeSin: number
	latitudePow: number
	latitudeTemperatureK: number
}
type Thresholds = { water: number, snow: number, vegetation: number, clouds: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount
const mixRgb = (a: Rgb, b: Rgb, amount: number): Rgb => [
	mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount),
]

function smoothstep(edge0: number, edge1: number, value: number): number {
	const amount = clamp((value - edge0) / Math.max(edge1 - edge0, Number.EPSILON), 0, 1)
	return amount * amount * (3 - 2 * amount)
}

function fractal(noise: Noise3, x: number, y: number, z: number, octaves: number, lacunarity = 2, gain = 0.5): number {
	return fractalNoise(noise, x, y, z, octaves, lacunarity, gain)
}

function ridged(noise: Noise3, x: number, y: number, z: number): number {
	return 1 - Math.abs(fractal(noise, x, y, z, 5, 2.2, 0.53))
}

function setPixel(target: Uint8Array, offset: number, color: Rgb, alpha = 255): void {
	target[offset] = clamp(Math.round(color[0]), 0, 255)
	target[offset + 1] = clamp(Math.round(color[1]), 0, 255)
	target[offset + 2] = clamp(Math.round(color[2]), 0, 255)
	target[offset + 3] = clamp(Math.round(alpha), 0, 255)
}

function weightedThreshold(scores: ArrayLike<number>, weights: ArrayLike<number>, target: number, highest: boolean): number {
	if (target <= 0 || scores.length === 0) return highest ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
	if (target >= 1) return highest ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
	const order = Array.from({ length: scores.length }, (_, index) => index)
	order.sort(highest
		? (left, right) => scores[right] - scores[left]
		: (left, right) => scores[left] - scores[right])
	let wanted = 0
	for (const index of order) wanted += weights[index]
	wanted *= target
	let accumulated = 0
	for (const index of order) {
		accumulated += weights[index]
		if (accumulated >= wanted) return scores[index]
	}
	const lastIndex = order.at(-1)
	return lastIndex == null ? 0 : scores[lastIndex]
}

function rowAt(pixelY: number, height: number, meanTemperatureK: number): RowContext {
	const latitude = (0.5 - (pixelY + 0.5) / height) * Math.PI
	const latitudeSin = Math.sin(latitude)
	const latitudePow = Math.abs(latitudeSin) ** PROFILE.climate.latitudeExponent
	return {
		latitudeCos: Math.cos(latitude),
		latitudeSin,
		latitudePow,
		latitudeTemperatureK: meanTemperatureK + PROFILE.climate.equatorialOffsetK
			- PROFILE.climate.latitudeCoolingK * latitudePow,
	}
}

function pointAt(
	pixelX: number,
	width: number,
	row: RowContext,
	primaryNoise: Noise3,
	detailNoise: Noise3,
	climateNoise: Noise3,
	warpNoise: Noise3,
): SurfacePoint {
	const longitude = ((pixelX + 0.5) / width) * Math.PI * 2
	const x = row.latitudeCos * Math.cos(longitude)
	const y = row.latitudeSin
	const z = row.latitudeCos * Math.sin(longitude)
	const terrain = PROFILE.terrain
	// Domain warp bends only the terrain sampling so continents gain anisotropic
	// structure; climate, clouds, and the returned sphere point stay unwarped.
	const warpX = x * terrain.warpFrequency
	const warpY = y * terrain.warpFrequency
	const warpZ = z * terrain.warpFrequency
	const wx = x + fractal(warpNoise, warpX + 31.4, warpY + 8.2, warpZ - 12.7, terrain.warpOctaves) * terrain.warpAmplitude
	const wy = y + fractal(warpNoise, warpX - 5.9, warpY + 44.1, warpZ + 21.3, terrain.warpOctaves) * terrain.warpAmplitude
	const wz = z + fractal(warpNoise, warpX + 17.8, warpY - 27.5, warpZ + 3.6, terrain.warpOctaves) * terrain.warpAmplitude
	const base = fractal(primaryNoise, wx * terrain.baseFrequency, wy * terrain.baseFrequency, wz * terrain.baseFrequency, terrain.baseOctaves)
	const detail = fractal(detailNoise, wx * terrain.detailFrequency, wy * terrain.detailFrequency, wz * terrain.detailFrequency, terrain.detailOctaves) * terrain.detailAmplitude
	const heightValue = clamp(0.5 + (base + detail) * terrain.heightAmplitude, 0, 1)
	const altitude = clamp((heightValue - 0.5) * 2.2, 0, 1)
	const climate = clamp(0.5 + climateNoise(
		x * PROFILE.placement.climateFrequency + 11,
		y * PROFILE.placement.climateFrequency - 7,
		z * PROFILE.placement.climateFrequency + 5,
	) * 0.52, 0, 1)
	const localTemperatureK = row.latitudeTemperatureK - PROFILE.climate.altitudeCoolingK * altitude
	return {
		x, y, z,
		latitudeSin: row.latitudeSin,
		latitudePow: row.latitudePow,
		weight: row.latitudeCos,
		height: heightValue,
		climate,
		localTemperatureK,
		altitude,
	}
}

function vegetationScore(point: SurfacePoint): number {
	const [coolStart, coolEnd] = PROFILE.climate.vegetationCoolEdgeK
	const [warmStart, warmEnd] = PROFILE.climate.vegetationWarmEdgeK
	const thermal = smoothstep(coolStart, coolEnd, point.localTemperatureK)
		* (1 - smoothstep(warmStart, warmEnd, point.localTemperatureK))
	return thermal
		* ((1 - PROFILE.placement.vegetationClimateWeight) + point.climate * PROFILE.placement.vegetationClimateWeight)
		* (1 - point.altitude * PROFILE.placement.vegetationAltitudePenalty)
}

function snowScore(point: SurfacePoint): number {
	const coldness = 1 - smoothstep(250, 281, point.localTemperatureK)
	return clamp(
		point.latitudePow * PROFILE.placement.snowLatitudeWeight
		+ point.altitude * PROFILE.placement.snowAltitudeWeight
		+ coldness * PROFILE.placement.snowColdWeight
		+ (point.climate - 0.5) * PROFILE.placement.snowClimateWeight,
		0,
		1,
	)
}

function cloudScore(noise: Noise3, point: SurfacePoint): number {
	return fractal(
		noise,
		point.x * CLOUD_PROCEDURE_PROFILE.frequencyXz,
		point.y * CLOUD_PROCEDURE_PROFILE.frequencyY,
		point.z * CLOUD_PROCEDURE_PROFILE.frequencyXz,
		CLOUD_PROCEDURE_PROFILE.octaves,
	) * 0.5 + 0.5
}

function calibrate(
	parameters: ProceduralSurfaceParameters,
	primaryNoise: Noise3,
	detailNoise: Noise3,
	climateNoise: Noise3,
	cloudNoise: Noise3,
	warpNoise: Noise3,
): { thresholds: Thresholds, diagnostics: string[] } {
	const coverage = parameters.coverage
	const meanTemperatureK = parameters.temperatureK ?? 288
	const count = COVERAGE_CALIBRATION_WIDTH * COVERAGE_CALIBRATION_HEIGHT
	const heights = new Float64Array(count)
	const snowScores = new Float64Array(count)
	const vegetationScores = new Float64Array(count)
	const cloudScores = new Float64Array(count)
	const weights = new Float64Array(count)
	let cursor = 0
	for (let y = 0; y < COVERAGE_CALIBRATION_HEIGHT; y++) {
		const row = rowAt(y, COVERAGE_CALIBRATION_HEIGHT, meanTemperatureK)
		for (let x = 0; x < COVERAGE_CALIBRATION_WIDTH; x++, cursor++) {
			const point = pointAt(x, COVERAGE_CALIBRATION_WIDTH, row, primaryNoise, detailNoise, climateNoise, warpNoise)
			heights[cursor] = point.height
			snowScores[cursor] = snowScore(point)
			vegetationScores[cursor] = vegetationScore(point)
			cloudScores[cursor] = cloudScore(cloudNoise, point)
			weights[cursor] = point.weight
		}
	}
	const waterTarget = supportsCoverage(parameters.class, 'water') ? coverage.surfaceWater ?? 0 : 0
	const snowTarget = supportsCoverage(parameters.class, 'snow') ? coverage.permanentSnowIce ?? 0 : 0
	const vegetationTarget = supportsCoverage(parameters.class, 'vegetation') ? coverage.vegetation ?? 0 : 0
	const cloudTarget = parameters.clouds?.meanCover ?? 0
	const water = weightedThreshold(heights, weights, waterTarget, false)
	const snow = weightedThreshold(snowScores, weights, snowTarget, true)
	const eligibleScores: number[] = []
	const eligibleWeights: number[] = []
	for (let index = 0; index < count; index++) {
		if (!(heights[index] <= water) && !(snowScores[index] >= snow)) {
			eligibleScores.push(vegetationScores[index])
			eligibleWeights.push(weights[index])
		}
	}
	const vegetation = weightedThreshold(eligibleScores, eligibleWeights, vegetationTarget, true)
	const clouds = weightedThreshold(cloudScores, weights, cloudTarget, true)
	const diagnostics: string[] = []
	if (vegetationTarget > 0 && eligibleScores.length === 0) {
		diagnostics.push('Vegetation target could not be placed because no exposed non-snow land remains.')
	}
	return { thresholds: { water, snow, vegetation, clouds }, diagnostics }
}

function terrainColor(height: number, water: boolean, seaLevel: number): { color: Rgb, roughness: number } {
	if (water) {
		const depth = clamp((seaLevel - height) * 4, 0, 1)
		return { color: mixRgb(PROFILE.display.waterShallow, PROFILE.display.waterDeep, depth), roughness: 0.16 }
	}
	const altitude = clamp((height - seaLevel) * 2.2, 0, 1)
	return {
		color: mixRgb(PROFILE.display.lowland, PROFILE.display.highland, altitude),
		roughness: mix(0.82, 0.96, altitude),
	}
}

function gasColor(latitudeSin: number, warp: number, temperatureK: number | null): Rgb {
	const position = latitudeSin * 11 + warp * 1.7
	const fraction = position - Math.floor(position)
	const palette = temperatureK != null && temperatureK < 250 ? GAS_DISPLAY_PROFILES.cool : GAS_DISPLAY_PROFILES.warm
	const index = ((Math.floor(position) % palette.length) + palette.length) % palette.length
	const edge = Math.min(1, Math.min(fraction, 1 - fraction) * 8)
	return mixRgb(palette[(index + 1) % palette.length], palette[index], edge)
}

/** Illustrative, seamless overview plates with area-calibrated authored coverage. */
export function generateProceduralSurface(
	parameters: ProceduralSurfaceParameters,
	width = 256,
	height = Math.round(width / 2),
): GeneratedSurface {
	const safeWidth = Math.max(8, Math.trunc(width))
	const safeHeight = Math.max(4, Math.trunc(height))
	const albedo = new Uint8Array(safeWidth * safeHeight * 4)
	const roughness = new Uint8Array(albedo.length)
	const elevation = parameters.class === 'gas' ? null : new Uint8Array(albedo.length)
	const clouds = (parameters.clouds?.meanCover ?? 0) > 0 ? new Uint8Array(albedo.length) : null
	const primaryNoise = makeSimplex(parameters.seed)
	const detailNoise = makeSimplex(parameters.seed ^ 0x9E3779B9)
	const cloudNoise = makeSimplex(parameters.clouds?.seed ?? (parameters.seed ^ 0x51AB3F))
	const climateNoise = makeSimplex(parameters.seed ^ 0xC1A4E7)
	const warpNoise = makeSimplex(parameters.seed ^ 0x7F4A7C15)
	const { thresholds, diagnostics } = calibrate(parameters, primaryNoise, detailNoise, climateNoise, cloudNoise, warpNoise)
	const meanTemperatureK = parameters.temperatureK ?? 288
	const supportsWater = supportsCoverage(parameters.class, 'water')
	const supportsSnow = supportsCoverage(parameters.class, 'snow')
	const supportsVegetation = supportsCoverage(parameters.class, 'vegetation')
	const fullCloudCover = (parameters.clouds?.meanCover ?? 0) >= 1
	const cloudEdgeLow = thresholds.clouds - CLOUD_PROCEDURE_PROFILE.thresholdSoftness
	const cloudEdgeHigh = thresholds.clouds + CLOUD_PROCEDURE_PROFILE.thresholdSoftness
	let totalWeight = 0
	let waterWeight = 0
	let snowWeight = 0
	let eligibleWeight = 0
	let vegetationWeight = 0
	let cloudWeight = 0

	for (let pixelY = 0; pixelY < safeHeight; pixelY++) {
		const row = rowAt(pixelY, safeHeight, meanTemperatureK)
		for (let pixelX = 0; pixelX < safeWidth; pixelX++) {
			const point = pointAt(pixelX, safeWidth, row, primaryNoise, detailNoise, climateNoise, warpNoise)
			const offset = (pixelY * safeWidth + pixelX) * 4
			const water = supportsWater && point.height <= thresholds.water
			const snow = supportsSnow && snowScore(point) >= thresholds.snow
			const eligible = supportsVegetation && !water && !snow
			const vegetation = eligible && vegetationScore(point) >= thresholds.vegetation
			const cloudValue = clouds == null ? 0 : cloudScore(cloudNoise, point)
			const cloudOpacity = clouds == null
				? 0
				: (fullCloudCover
					? 1
					: smoothstep(cloudEdgeLow, cloudEdgeHigh, cloudValue))
			const cloudy = cloudOpacity >= 0.5
			let color: Rgb
			let roughnessValue: number

			if (parameters.class === 'gas') {
				const warp = fractal(primaryNoise, point.x * 2.4, point.y * 2.4, point.z * 2.4, 4)
				color = gasColor(point.latitudeSin, warp, parameters.temperatureK)
				roughnessValue = 0.68
			} else if (parameters.class === 'ice') {
				const crack = ridged(detailNoise, point.x * 6.5, point.y * 6.5, point.z * 6.5)
				color = crack > 0.81
					? mixRgb([216, 230, 239], [73, 119, 157], clamp((crack - 0.81) * 5.2, 0, 0.9))
					: mixRgb([198, 216, 229], [233, 239, 242], point.height)
				roughnessValue = mix(0.38, 0.62, point.height)
			} else {
				const terrain = terrainColor(point.height, water, thresholds.water)
				color = terrain.color
				roughnessValue = terrain.roughness
				if (vegetation) {
					color = mixRgb(color, mixRgb(PROFILE.display.vegetationDry, PROFILE.display.vegetationWet, point.climate), 0.94)
					roughnessValue = mix(roughnessValue, 0.86, 0.94)
				}
				if (snow) {
					const snowPalette = water ? PROFILE.display.seaIce : PROFILE.display.landSnow
					color = mixRgb(color, mixRgb(snowPalette[0], snowPalette[1], point.climate), 0.96)
					roughnessValue = water ? 0.43 : 0.66
				}
			}

			if (parameters.tint) color = mixRgb(color, parameters.tint, parameters.class === 'gas' ? 0.3 : PROFILE.display.tintStrength)
			setPixel(albedo, offset, color)
			const roughnessByte = roughnessValue * 255
			setPixel(roughness, offset, [roughnessByte, roughnessByte, roughnessByte])
			if (elevation) {
				const elevationByte = point.height * 255
				setPixel(elevation, offset, [elevationByte, elevationByte, elevationByte])
			}
			if (clouds) {
				const alpha = cloudOpacity * 255
				setPixel(clouds, offset, [alpha, alpha, alpha])
			}

			totalWeight += point.weight
			if (water) waterWeight += point.weight
			if (snow) snowWeight += point.weight
			if (eligible) eligibleWeight += point.weight
			if (vegetation) vegetationWeight += point.weight
			if (cloudy) cloudWeight += point.weight
		}
	}

	return {
		width: safeWidth,
		height: safeHeight,
		albedo,
		elevation,
		roughness,
		clouds,
		measuredCoverage: {
			surfaceWater: totalWeight ? waterWeight / totalWeight : 0,
			permanentSnowIce: totalWeight ? snowWeight / totalWeight : 0,
			vegetation: eligibleWeight ? vegetationWeight / eligibleWeight : 0,
			vegetationOfSurface: totalWeight ? vegetationWeight / totalWeight : 0,
			meanCloudCover: totalWeight ? cloudWeight / totalWeight : 0,
		},
		algorithmRevision: PROCEDURAL_ALGORITHM_REVISION,
		diagnostics,
	}
}
