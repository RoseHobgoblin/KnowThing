import { describe, expect, it } from 'vitest'
import { generateProceduralSurface } from './procedural-surface.js'

const base = {
	class: 'terrestrial' as const,
	seed: 436,
	temperatureK: 288,
	coverage: { surfaceWater: 0.55, vegetation: 0, permanentSnowIce: 0 },
	clouds: null,
}

describe('area-calibrated procedural surface', () => {
	it('is byte-deterministic at each LOD and emits independent channels', () => {
		for (const width of [32, 64, 128]) {
			const first = generateProceduralSurface(base, width, width / 2)
			const second = generateProceduralSurface(base, width, width / 2)
			expect(first.albedo).toEqual(second.albedo)
			expect(first.roughness).toEqual(second.roughness)
			expect(first.elevation).not.toBeNull()
			expect(first.normal).not.toBeNull()
			expect(first.normal).toEqual(second.normal)
			expect(first.algorithmRevision).toBeGreaterThan(0)
		}
	})

	it('derives outward-facing seam-safe normals from elevation', () => {
		const generated = generateProceduralSurface(base, 64, 32)
		const normal = generated.normal
		expect(normal).not.toBeNull()
		if (!normal) return
		let blueSum = 0
		let bluePixels = 0
		let seamDifference = 0
		let interiorDifference = 0
		let interiorPairs = 0
		for (let offset = 0; offset < normal.length; offset += 4) {
			// Blue encodes the outward component, which normalize() keeps positive.
			expect(normal[offset + 2]).toBeGreaterThanOrEqual(128)
			expect(normal[offset + 3]).toBe(255)
			blueSum += normal[offset + 2]
			bluePixels += 1
		}
		expect(blueSum / bluePixels).toBeGreaterThan(128)
		for (let pixelY = 2; pixelY < generated.height - 2; pixelY++) {
			const row = pixelY * generated.width * 4
			const last = row + (generated.width - 1) * 4
			seamDifference += Math.abs(normal[row] - normal[last])
				+ Math.abs(normal[row + 1] - normal[last + 1])
			for (let pixelX = 1; pixelX < generated.width; pixelX++) {
				const current = row + pixelX * 4
				const previous = current - 4
				interiorDifference += Math.abs(normal[current] - normal[previous])
					+ Math.abs(normal[current + 1] - normal[previous + 1])
				interiorPairs += 1
			}
		}
		const seamMean = seamDifference / (generated.height - 4)
		const interiorMean = interiorDifference / interiorPairs
		expect(seamMean).toBeLessThan(interiorMean * 3)
	})

	it('shifts vegetation pigment with host-star temperature', () => {
		const vegetated = {
			...base,
			coverage: { surfaceWater: 0.3, vegetation: 0.6, permanentSnowIce: 0 },
		}
		const mDwarf = generateProceduralSurface({ ...vegetated, starTemperatureK: 3_200 }, 64, 32)
		const sunLike = generateProceduralSurface({ ...vegetated, starTemperatureK: 5_800 }, 64, 32)
		const defaulted = generateProceduralSurface({ ...vegetated, starTemperatureK: null }, 64, 32)
		const solar = generateProceduralSurface({ ...vegetated, starTemperatureK: 5_772 }, 64, 32)
		expect(mDwarf.albedo).not.toEqual(sunLike.albedo)
		expect(defaulted.albedo).toEqual(solar.albedo)
		expect(mDwarf.measuredCoverage).toEqual(sunLike.measuredCoverage)
	})

	it('omits procedural colour when an uploaded plate owns appearance', () => {
		const vegetated = {
			...base,
			starTemperatureK: 3_200,
			coverage: { surfaceWater: 0.3, vegetation: 0.6, permanentSnowIce: 0 },
		}
		const withColour = generateProceduralSurface(vegetated, 64, 32)
		const withoutColour = generateProceduralSurface({ ...vegetated, generateAlbedo: false }, 64, 32)
		expect(withColour.albedo).toBeInstanceOf(Uint8Array)
		expect(withoutColour.albedo).toBeNull()
		expect(withoutColour.roughness).toEqual(withColour.roughness)
		expect(withoutColour.elevation).toEqual(withColour.elevation)
		expect(withoutColour.normal).toEqual(withColour.normal)
		expect(withoutColour.measuredCoverage).toEqual(withColour.measuredCoverage)
	})

	it('hits domain-relative authored coverage within two percentage points', () => {
		const generated = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 0.43, vegetation: 0.62, permanentSnowIce: 0.14 },
			clouds: { meanCover: 0.48, seed: 91 },
		}, 256, 128)
		expect(Math.abs(generated.measuredCoverage.surfaceWater - 0.43)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.meanCloudCover - 0.48)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.vegetation - 0.62)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.permanentSnowIce - 0.14)).toBeLessThanOrEqual(0.02)
		expect(generated.measuredCoverage.vegetationOfSurface)
			.toBeLessThanOrEqual(1 - generated.measuredCoverage.surfaceWater + 0.001)
	})

	it('preserves exact zero and full targets', () => {
		const empty = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 0, vegetation: 0, permanentSnowIce: 0 },
			clouds: null,
		}, 64, 32)
		expect(empty.measuredCoverage).toEqual({
			surfaceWater: 0, meanCloudCover: 0, vegetation: 0, vegetationOfSurface: 0, permanentSnowIce: 0,
		})
		const ocean = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 1, vegetation: 1, permanentSnowIce: 0 },
			clouds: { meanCover: 1, seed: 91 },
		}, 64, 32)
		expect(ocean.measuredCoverage.surfaceWater).toBe(1)
		expect(ocean.measuredCoverage.meanCloudCover).toBe(1)
		expect(ocean.measuredCoverage.vegetation).toBe(0)
		expect(ocean.diagnostics).toContain('Vegetation target could not be placed because no exposed non-snow land remains.')
	})

	it('is monotonic and remains finite across temperature extremes', () => {
		const low = generateProceduralSurface({ ...base, temperatureK: null, coverage: { ...base.coverage, surfaceWater: 0.2 } }, 64, 32)
		const high = generateProceduralSurface({ ...base, temperatureK: 10_000, coverage: { ...base.coverage, surfaceWater: 0.8 } }, 64, 32)
		expect(high.measuredCoverage.surfaceWater).toBeGreaterThan(low.measuredCoverage.surfaceWater)
		for (const bytes of [low.albedo!, low.roughness, high.albedo!, high.roughness]) {
			expect(bytes.every(Number.isFinite)).toBe(true)
		}
	})

	it('does not create solid relief or incompatible coverage for gas giants', () => {
		const generated = generateProceduralSurface({
			...base,
			class: 'gas',
			coverage: { surfaceWater: 1, vegetation: 1, permanentSnowIce: 1 },
			clouds: { meanCover: 0.3, seed: 91 },
		}, 64, 32)
		expect(generated.elevation).toBeNull()
		expect(generated.normal).toBeNull()
		expect(generated.measuredCoverage.surfaceWater).toBe(0)
		expect(generated.measuredCoverage.vegetation).toBe(0)
		expect(generated.measuredCoverage.permanentSnowIce).toBe(0)
	})
})
