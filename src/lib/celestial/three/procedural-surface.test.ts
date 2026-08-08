import { describe, expect, it } from 'vitest'
import { generateProceduralSurface } from './procedural-surface.js'

const base = {
	class: 'terrestrial' as const,
	seed: 436,
	temperatureK: 288,
	hydrosphereFraction: 0.55,
	cloudCoverage: null,
	vegetationFraction: 0,
	snowCoverage: 0,
}

function greenPixels(data: Uint8Array): number {
	let count = 0
	for (let offset = 0; offset < data.length; offset += 4) {
		if (data[offset + 1] > data[offset] * 1.12 && data[offset + 1] > data[offset + 2] * 1.08) count++
	}
	return count
}

function snowPixels(data: Uint8Array): number {
	let count = 0
	for (let offset = 0; offset < data.length; offset += 4) {
		if (data[offset] > 195 && data[offset + 1] > 205 && data[offset + 2] > 205) count++
	}
	return count
}

describe('procedural surface fallback', () => {
	it('is deterministic and emits independent material channels', () => {
		const first = generateProceduralSurface(base, 32, 16)
		const second = generateProceduralSurface(base, 32, 16)
		expect(first.albedo).toEqual(second.albedo)
		expect(first.roughness).toEqual(second.roughness)
		expect(first.elevation).not.toBeNull()
		expect(first.albedo).toHaveLength(32 * 16 * 4)
		expect(first.clouds).toBeNull()
	})

	it('changes with the seed and creates clouds only when requested', () => {
		const first = generateProceduralSurface(base, 24, 12)
		const second = generateProceduralSurface({ ...base, seed: 437, cloudCoverage: 0.6 }, 24, 12)
		expect(first.albedo).not.toEqual(second.albedo)
		expect(second.clouds).not.toBeNull()
		expect(second.clouds?.some((value, index) => index % 4 === 1 && value > 0)).toBe(true)
		expect(second.clouds?.some((value, index) => index % 4 === 1 && value < 255)).toBe(true)
	})

	it('does not invent solid relief for gas giants', () => {
		const generated = generateProceduralSurface({ ...base, class: 'gas' }, 24, 12)
		expect(generated.elevation).toBeNull()
	})

	it('adds authored green vegetation only to terrestrial land', () => {
		const barren = generateProceduralSurface(base, 128, 64)
		const living = generateProceduralSurface({ ...base, vegetationFraction: 0.7 }, 128, 64)
		expect(greenPixels(barren.albedo)).toBe(0)
		expect(greenPixels(living.albedo)).toBeGreaterThan(200)
	})

	it('places authored snow at cold latitudes and high terrain', () => {
		const bare = generateProceduralSurface(base, 128, 64)
		const snowy = generateProceduralSurface({ ...base, snowCoverage: 0.35 }, 128, 64)
		expect(snowPixels(snowy.albedo)).toBeGreaterThan(snowPixels(bare.albedo) + 200)
	})
})
