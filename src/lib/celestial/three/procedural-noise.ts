export type Noise3 = (x: number, y: number, z: number) => number

/** Mulberry32: compact, deterministic, and stable across browsers. */
export function makeRandom(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6D2B79F5) >>> 0
		let value = Math.imul(state ^ state >>> 15, 1 | state)
		value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
		return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
	}
}

/** Seeded three-dimensional simplex noise shared by illustrative body generators. */
export function makeSimplex(seed: number): Noise3 {
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

export function fractalNoise(
	noise: Noise3,
	x: number,
	y: number,
	z: number,
	octaves: number,
	lacunarity = 2,
	gain = 0.5,
): number {
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
