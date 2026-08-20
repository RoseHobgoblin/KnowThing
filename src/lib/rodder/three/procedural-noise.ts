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

	// The corner loop is unrolled with scalar locals: this runs once per noise
	// sample per octave per pixel, so any per-call allocation dominates plate cost.
	return (xInput, yInput, zInput) => {
		const skewAmount = (xInput + yInput + zInput) * skew
		const latticeX = Math.floor(xInput + skewAmount)
		const latticeY = Math.floor(yInput + skewAmount)
		const latticeZ = Math.floor(zInput + skewAmount)
		const unskewAmount = (latticeX + latticeY + latticeZ) * unskew
		const x0 = xInput - (latticeX - unskewAmount)
		const y0 = yInput - (latticeY - unskewAmount)
		const z0 = zInput - (latticeZ - unskewAmount)
		let stepX1 = 0
		let stepY1 = 0
		let stepZ1 = 0
		let stepX2 = 0
		let stepY2 = 0
		let stepZ2 = 0
		if (x0 >= y0) {
			if (y0 >= z0) {
				stepX1 = 1
				stepX2 = 1
				stepY2 = 1
			} else if (x0 >= z0) {
				stepX1 = 1
				stepX2 = 1
				stepZ2 = 1
			} else {
				stepZ1 = 1
				stepX2 = 1
				stepZ2 = 1
			}
		} else if (y0 < z0) {
			stepZ1 = 1
			stepY2 = 1
			stepZ2 = 1
		} else if (x0 < z0) {
			stepY1 = 1
			stepY2 = 1
			stepZ2 = 1
		} else {
			stepY1 = 1
			stepX2 = 1
			stepY2 = 1
		}

		const wrappedX = latticeX & 255
		const wrappedY = latticeY & 255
		const wrappedZ = latticeZ & 255
		let sum = 0

		let influence = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
		if (influence > 0) {
			const gradient = gradientIndex[wrappedX + permutation[wrappedY + permutation[wrappedZ]]] * 3
			influence *= influence
			sum += influence * influence * (
				gradients[gradient] * x0 + gradients[gradient + 1] * y0 + gradients[gradient + 2] * z0
			)
		}

		const x1 = x0 - stepX1 + unskew
		const y1 = y0 - stepY1 + unskew
		const z1 = z0 - stepZ1 + unskew
		influence = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
		if (influence > 0) {
			const gradient = gradientIndex[wrappedX + stepX1 + permutation[wrappedY + stepY1 + permutation[wrappedZ + stepZ1]]] * 3
			influence *= influence
			sum += influence * influence * (
				gradients[gradient] * x1 + gradients[gradient + 1] * y1 + gradients[gradient + 2] * z1
			)
		}

		const x2 = x0 - stepX2 + 2 * unskew
		const y2 = y0 - stepY2 + 2 * unskew
		const z2 = z0 - stepZ2 + 2 * unskew
		influence = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
		if (influence > 0) {
			const gradient = gradientIndex[wrappedX + stepX2 + permutation[wrappedY + stepY2 + permutation[wrappedZ + stepZ2]]] * 3
			influence *= influence
			sum += influence * influence * (
				gradients[gradient] * x2 + gradients[gradient + 1] * y2 + gradients[gradient + 2] * z2
			)
		}

		const x3 = x0 - 1 + 3 * unskew
		const y3 = y0 - 1 + 3 * unskew
		const z3 = z0 - 1 + 3 * unskew
		influence = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
		if (influence > 0) {
			const gradient = gradientIndex[wrappedX + 1 + permutation[wrappedY + 1 + permutation[wrappedZ + 1]]] * 3
			influence *= influence
			sum += influence * influence * (
				gradients[gradient] * x3 + gradients[gradient + 1] * y3 + gradients[gradient + 2] * z3
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
