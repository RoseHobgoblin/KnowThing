import type { ResolvedSurfaceClass } from '../surface-model.js'

export type ProceduralSurfaceParameters = {
	class: ResolvedSurfaceClass
	seed: number
	temperatureK: number | null
	hydrosphereFraction: number | null
	cloudCoverage: number | null
	tint?: [number, number, number] | null
}

export type GeneratedSurface = {
	width: number
	height: number
	albedo: Uint8Array
	elevation: Uint8Array | null
	roughness: Uint8Array
	clouds: Uint8Array | null
}

type Noise3 = (x: number, y: number, z: number) => number
type Rgb = [number, number, number]

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount
const mixRgb = (a: Rgb, b: Rgb, amount: number): Rgb => [
	mix(a[0], b[0], amount),
	mix(a[1], b[1], amount),
	mix(a[2], b[2], amount),
]

function makeRandom(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6D2B79F5) >>> 0
		let value = Math.imul(state ^ state >>> 15, 1 | state)
		value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
		return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
	}
}

/** Seeded 3D simplex noise adapted from the Worldwright prototype. */
function makeSimplex(seed: number): Noise3 {
	const random = makeRandom(seed)
	const source = new Uint8Array(256)
	for (let index = 0; index < source.length; index++) source[index] = index
	for (let index = source.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1))
		const value = source[index]
		source[index] = source[swapIndex]
		source[swapIndex] = value
	}
	const permutation = new Uint8Array(512)
	const gradientIndex = new Uint8Array(512)
	for (let index = 0; index < permutation.length; index++) {
		permutation[index] = source[index & 255]
		gradientIndex[index] = permutation[index] % 12
	}
	const gradients = new Float32Array([
		1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
		1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
		0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
	])
	const skew = 1 / 3
	const unskew = 1 / 6

	return (xInput, yInput, zInput) => {
		const skewAmount = (xInput + yInput + zInput) * skew
		const latticeX = Math.floor(xInput + skewAmount)
		const latticeY = Math.floor(yInput + skewAmount)
		const latticeZ = Math.floor(zInput + skewAmount)
		const unskewAmount = (latticeX + latticeY + latticeZ) * unskew
		const x0 = xInput - (latticeX - unskewAmount)
		const y0 = yInput - (latticeY - unskewAmount)
		const z0 = zInput - (latticeZ - unskewAmount)
		let stepX1: number, stepY1: number, stepZ1: number, stepX2: number, stepY2: number, stepZ2: number
		if (x0 >= y0) {
			if (y0 >= z0) [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [1, 0, 0, 1, 1, 0]
			else if (x0 >= z0) [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [1, 0, 0, 1, 0, 1]
			else [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [0, 0, 1, 1, 0, 1]
		} else if (y0 < z0) [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [0, 0, 1, 0, 1, 1]
		else if (x0 < z0) [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [0, 1, 0, 0, 1, 1]
		else [stepX1, stepY1, stepZ1, stepX2, stepY2, stepZ2] = [0, 1, 0, 1, 1, 0]

		const offsets = [
			[x0, y0, z0, 0, 0, 0],
			[x0 - stepX1 + unskew, y0 - stepY1 + unskew, z0 - stepZ1 + unskew, stepX1, stepY1, stepZ1],
			[x0 - stepX2 + 2 * unskew, y0 - stepY2 + 2 * unskew, z0 - stepZ2 + 2 * unskew, stepX2, stepY2, stepZ2],
			[x0 - 1 + 3 * unskew, y0 - 1 + 3 * unskew, z0 - 1 + 3 * unskew, 1, 1, 1],
		]
		const wrappedX = latticeX & 255
		const wrappedY = latticeY & 255
		const wrappedZ = latticeZ & 255
		let sum = 0
		for (const [x, y, z, oi, oj, ok] of offsets) {
			let influence = 0.6 - x * x - y * y - z * z
			if (influence <= 0) continue
			const gradient = gradientIndex[wrappedX + oi + permutation[wrappedY + oj + permutation[wrappedZ + ok]]] * 3
			influence *= influence
			sum += influence * influence * (
				gradients[gradient] * x + gradients[gradient + 1] * y + gradients[gradient + 2] * z
			)
		}
		return 32 * sum
	}
}

function fractal(noise: Noise3, x: number, y: number, z: number, octaves: number, lacunarity = 2, gain = 0.5): number {
	let amplitude = 0.5
	let frequency = 1
	let sum = 0
	let normalization = 0
	for (let octave = 0; octave < octaves; octave++) {
		sum += amplitude * noise(x * frequency, y * frequency, z * frequency)
		normalization += amplitude
		frequency *= lacunarity
		amplitude *= gain
	}
	return sum / normalization
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

function tint(color: Rgb, target: Rgb | null | undefined, amount: number): Rgb {
	return target ? mixRgb(color, target, amount) : color
}

function terrainColor(height: number, seaLevel: number, hydrosphere: number, cold: boolean): { color: Rgb, roughness: number } {
	if (hydrosphere > 0 && height <= seaLevel) {
		const depth = clamp((seaLevel - height) * 4, 0, 1)
		const water = mixRgb([62, 111, 151], [14, 37, 72], depth)
		return { color: cold ? mixRgb(water, [207, 222, 234], 0.72) : water, roughness: cold ? 0.38 : 0.16 }
	}
	const altitude = clamp((height - seaLevel) * 2.2, 0, 1)
	const lowland: Rgb = cold ? [153, 159, 158] : [132, 115, 88]
	const highland: Rgb = cold ? [222, 228, 232] : [102, 92, 82]
	return { color: mixRgb(lowland, highland, altitude), roughness: mix(0.82, 0.96, altitude) }
}

function gasColor(latitudeSin: number, warp: number, temperatureK: number | null): Rgb {
	const bands = 11
	const position = latitudeSin * bands + warp * 1.7
	const fraction = position - Math.floor(position)
	const warm: Rgb[] = [[213, 194, 164], [166, 130, 91], [235, 222, 198], [137, 98, 78]]
	const cool: Rgb[] = [[139, 156, 174], [79, 101, 130], [186, 197, 207], [69, 80, 102]]
	const palette = temperatureK != null && temperatureK < 250 ? cool : warm
	const index = ((Math.floor(position) % palette.length) + palette.length) % palette.length
	const edge = Math.min(1, Math.min(fraction, 1 - fraction) * 8)
	return mixRgb(palette[(index + 1) % palette.length], palette[index], edge)
}

/**
 * Produces small overview textures. These are illustrative fallbacks, not
 * claims about tectonics, climate, or cartography. All noise is sampled in 3D
 * on the unit sphere, so the equirectangular plate has no longitude seam.
 */
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
	const cloudCoverage = parameters.cloudCoverage ?? 0
	const clouds = cloudCoverage > 0 ? new Uint8Array(albedo.length) : null
	const primaryNoise = makeSimplex(parameters.seed)
	const detailNoise = makeSimplex(parameters.seed ^ 0x9E3779B9)
	const cloudNoise = makeSimplex(parameters.seed ^ 0x51AB3F)
	const hydrosphere = parameters.hydrosphereFraction ?? 0
	const seaLevel = mix(0.28, 0.72, hydrosphere)
	const cold = parameters.temperatureK != null && parameters.temperatureK < 260

	for (let pixelY = 0; pixelY < safeHeight; pixelY++) {
		const latitude = (0.5 - (pixelY + 0.5) / safeHeight) * Math.PI
		const latitudeCos = Math.cos(latitude)
		const latitudeSin = Math.sin(latitude)
		for (let pixelX = 0; pixelX < safeWidth; pixelX++) {
			const longitude = ((pixelX + 0.5) / safeWidth) * Math.PI * 2
			const x = latitudeCos * Math.cos(longitude)
			const y = latitudeSin
			const z = latitudeCos * Math.sin(longitude)
			const offset = (pixelY * safeWidth + pixelX) * 4
			const base = fractal(primaryNoise, x * 1.45, y * 1.45, z * 1.45, 5)
			const detail = fractal(detailNoise, x * 5.2, y * 5.2, z * 5.2, 3) * 0.24
			const heightValue = clamp(0.5 + (base + detail) * 0.48, 0, 1)
			let color: Rgb
			let roughnessValue: number

			if (parameters.class === 'gas') {
				const warp = fractal(primaryNoise, x * 2.4, y * 2.4, z * 2.4, 4)
				color = gasColor(latitudeSin, warp, parameters.temperatureK)
				roughnessValue = 0.68
			} else if (parameters.class === 'ice') {
				const crack = ridged(detailNoise, x * 6.5, y * 6.5, z * 6.5)
				color = crack > 0.81
					? mixRgb([216, 230, 239], [73, 119, 157], clamp((crack - 0.81) * 5.2, 0, 0.9))
					: mixRgb([198, 216, 229], [233, 239, 242], heightValue)
				roughnessValue = mix(0.38, 0.62, heightValue)
			} else {
				const terrain = terrainColor(heightValue, seaLevel, hydrosphere, cold)
				color = terrain.color
				roughnessValue = terrain.roughness
			}

			color = tint(color, parameters.tint, parameters.class === 'gas' ? 0.3 : 0.18)
			setPixel(albedo, offset, color)
			const roughnessByte = roughnessValue * 255
			setPixel(roughness, offset, [roughnessByte, roughnessByte, roughnessByte])
			if (elevation) {
				const elevationByte = heightValue * 255
				setPixel(elevation, offset, [elevationByte, elevationByte, elevationByte])
			}
			if (clouds) {
				const cloud = fractal(cloudNoise, x * 2.7, y * 4.1, z * 2.7, 5) * 0.5 + 0.5
				const opacity = clamp((cloud - (1 - cloudCoverage)) / Math.max(cloudCoverage, 0.01), 0, 1) ** 1.5
				const opacityByte = opacity * 255
				setPixel(clouds, offset, [opacityByte, opacityByte, opacityByte])
			}
		}
	}

	return { width: safeWidth, height: safeHeight, albedo, elevation, roughness, clouds }
}
