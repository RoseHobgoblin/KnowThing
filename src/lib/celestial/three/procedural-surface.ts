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

type Sample = { score: number, weight: number }
type SurfacePoint = {
	x: number
	y: number
	z: number
	latitudeSin: number
	weight: number
	height: number
	climate: number
	localTemperatureK: number
	altitude: number
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

function weightedThreshold(samples: Sample[], target: number, highest: boolean): number {
	if (target <= 0 || samples.length === 0) return highest ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
	if (target >= 1) return highest ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
	const ordered = samples.toSorted((left, right) => highest ? right.score - left.score : left.score - right.score)
	const wanted = ordered.reduce((sum, sample) => sum + sample.weight, 0) * target
	let accumulated = 0
	for (const sample of ordered) {
		accumulated += sample.weight
		if (accumulated >= wanted) return sample.score
	}
	return ordered.at(-1)?.score ?? 0
}

function pointAt(
	pixelX: number,
	pixelY: number,
	width: number,
	height: number,
	primaryNoise: Noise3,
	detailNoise: Noise3,
	climateNoise: Noise3,
	meanTemperatureK: number,
): SurfacePoint {
	const latitude = (0.5 - (pixelY + 0.5) / height) * Math.PI
	const latitudeCos = Math.cos(latitude)
	const latitudeSin = Math.sin(latitude)
	const longitude = ((pixelX + 0.5) / width) * Math.PI * 2
	const x = latitudeCos * Math.cos(longitude)
	const y = latitudeSin
	const z = latitudeCos * Math.sin(longitude)
	const terrain = PROFILE.terrain
	const base = fractal(primaryNoise, x * terrain.baseFrequency, y * terrain.baseFrequency, z * terrain.baseFrequency, terrain.baseOctaves)
	const detail = fractal(detailNoise, x * terrain.detailFrequency, y * terrain.detailFrequency, z * terrain.detailFrequency, terrain.detailOctaves) * terrain.detailAmplitude
	const heightValue = clamp(0.5 + (base + detail) * terrain.heightAmplitude, 0, 1)
	const altitude = clamp((heightValue - 0.5) * 2.2, 0, 1)
	const climate = clamp(0.5 + climateNoise(
		x * PROFILE.placement.climateFrequency + 11,
		y * PROFILE.placement.climateFrequency - 7,
		z * PROFILE.placement.climateFrequency + 5,
	) * 0.52, 0, 1)
	const localTemperatureK = meanTemperatureK + PROFILE.climate.equatorialOffsetK
		- PROFILE.climate.latitudeCoolingK * Math.abs(latitudeSin) ** PROFILE.climate.latitudeExponent
		- PROFILE.climate.altitudeCoolingK * altitude
	return { x, y, z, latitudeSin, weight: latitudeCos, height: heightValue, climate, localTemperatureK, altitude }
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
		Math.abs(point.latitudeSin) ** PROFILE.climate.latitudeExponent * PROFILE.placement.snowLatitudeWeight
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
): { thresholds: Thresholds, diagnostics: string[] } {
	const coverage = parameters.coverage
	const meanTemperatureK = parameters.temperatureK ?? 288
	const points: SurfacePoint[] = []
	for (let y = 0; y < COVERAGE_CALIBRATION_HEIGHT; y++) {
		for (let x = 0; x < COVERAGE_CALIBRATION_WIDTH; x++) {
			points.push(pointAt(x, y, COVERAGE_CALIBRATION_WIDTH, COVERAGE_CALIBRATION_HEIGHT, primaryNoise, detailNoise, climateNoise, meanTemperatureK))
		}
	}
	const waterTarget = supportsCoverage(parameters.class, 'water') ? coverage.surfaceWater ?? 0 : 0
	const snowTarget = supportsCoverage(parameters.class, 'snow') ? coverage.permanentSnowIce ?? 0 : 0
	const vegetationTarget = supportsCoverage(parameters.class, 'vegetation') ? coverage.vegetation ?? 0 : 0
	const cloudTarget = parameters.clouds?.meanCover ?? 0
	const water = weightedThreshold(points.map(point => ({ score: point.height, weight: point.weight })), waterTarget, false)
	const snow = weightedThreshold(points.map(point => ({ score: snowScore(point), weight: point.weight })), snowTarget, true)
	const eligible = points.filter(point => !(point.height <= water) && !(snowScore(point) >= snow))
	const vegetation = weightedThreshold(
		eligible.map(point => ({ score: vegetationScore(point), weight: point.weight })),
		vegetationTarget,
		true,
	)
	const clouds = weightedThreshold(
		points.map(point => ({ score: cloudScore(cloudNoise, point), weight: point.weight })),
		cloudTarget,
		true,
	)
	const diagnostics: string[] = []
	if (vegetationTarget > 0 && eligible.length === 0) {
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
	const { thresholds, diagnostics } = calibrate(parameters, primaryNoise, detailNoise, climateNoise, cloudNoise)
	const meanTemperatureK = parameters.temperatureK ?? 288
	let totalWeight = 0
	let waterWeight = 0
	let snowWeight = 0
	let eligibleWeight = 0
	let vegetationWeight = 0
	let cloudWeight = 0

	for (let pixelY = 0; pixelY < safeHeight; pixelY++) {
		for (let pixelX = 0; pixelX < safeWidth; pixelX++) {
			const point = pointAt(pixelX, pixelY, safeWidth, safeHeight, primaryNoise, detailNoise, climateNoise, meanTemperatureK)
			const offset = (pixelY * safeWidth + pixelX) * 4
			const water = supportsCoverage(parameters.class, 'water') && point.height <= thresholds.water
			const snow = supportsCoverage(parameters.class, 'snow') && snowScore(point) >= thresholds.snow
			const eligible = supportsCoverage(parameters.class, 'vegetation') && !water && !snow
			const vegetation = eligible && vegetationScore(point) >= thresholds.vegetation
			const cloudValue = clouds == null ? 0 : cloudScore(cloudNoise, point)
			const cloudOpacity = clouds == null
				? 0
				: ((parameters.clouds?.meanCover ?? 0) >= 1
					? 1
					: smoothstep(
						thresholds.clouds - CLOUD_PROCEDURE_PROFILE.thresholdSoftness,
						thresholds.clouds + CLOUD_PROCEDURE_PROFILE.thresholdSoftness,
						cloudValue,
					))
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
