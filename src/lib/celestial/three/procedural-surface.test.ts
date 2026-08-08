import { describe, expect, it } from 'vitest'
import { generateProceduralSurface } from './procedural-surface.js'

const base = {
	class: 'terrestrial' as const,
	seed: 436,
	temperatureK: 288,
	coverage: { surfaceWater: 0.55, clouds: null, vegetation: 0, permanentSnowIce: 0 },
}

describe('area-calibrated procedural surface', () => {
	it('is byte-deterministic at each LOD and emits independent channels', () => {
		for (const width of [32, 64, 128]) {
			const first = generateProceduralSurface(base, width, width / 2)
			const second = generateProceduralSurface(base, width, width / 2)
			expect(first.albedo).toEqual(second.albedo)
			expect(first.roughness).toEqual(second.roughness)
			expect(first.elevation).not.toBeNull()
			expect(first.algorithmRevision).toBeGreaterThan(0)
		}
	})

	it('hits domain-relative authored coverage within two percentage points', () => {
		const generated = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 0.43, clouds: 0.48, vegetation: 0.62, permanentSnowIce: 0.14 },
		}, 256, 128)
		expect(Math.abs(generated.measuredCoverage.surfaceWater - 0.43)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.clouds - 0.48)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.vegetation - 0.62)).toBeLessThanOrEqual(0.02)
		expect(Math.abs(generated.measuredCoverage.permanentSnowIce - 0.14)).toBeLessThanOrEqual(0.02)
		expect(generated.measuredCoverage.vegetationOfSurface)
			.toBeLessThanOrEqual(1 - generated.measuredCoverage.surfaceWater + 0.001)
	})

	it('preserves exact zero and full targets', () => {
		const empty = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 0, clouds: 0, vegetation: 0, permanentSnowIce: 0 },
		}, 64, 32)
		expect(empty.measuredCoverage).toEqual({
			surfaceWater: 0, clouds: 0, vegetation: 0, vegetationOfSurface: 0, permanentSnowIce: 0,
		})
		const ocean = generateProceduralSurface({
			...base,
			coverage: { surfaceWater: 1, clouds: 1, vegetation: 1, permanentSnowIce: 0 },
		}, 64, 32)
		expect(ocean.measuredCoverage.surfaceWater).toBe(1)
		expect(ocean.measuredCoverage.clouds).toBe(1)
		expect(ocean.measuredCoverage.vegetation).toBe(0)
		expect(ocean.diagnostics).toContain('Vegetation target could not be placed because no exposed non-snow land remains.')
	})

	it('is monotonic and remains finite across temperature extremes', () => {
		const low = generateProceduralSurface({ ...base, temperatureK: null, coverage: { ...base.coverage, surfaceWater: 0.2 } }, 64, 32)
		const high = generateProceduralSurface({ ...base, temperatureK: 10_000, coverage: { ...base.coverage, surfaceWater: 0.8 } }, 64, 32)
		expect(high.measuredCoverage.surfaceWater).toBeGreaterThan(low.measuredCoverage.surfaceWater)
		for (const bytes of [low.albedo, low.roughness, high.albedo, high.roughness]) {
			expect(bytes.every(Number.isFinite)).toBe(true)
		}
	})

	it('does not create solid relief or incompatible coverage for gas giants', () => {
		const generated = generateProceduralSurface({
			...base,
			class: 'gas',
			coverage: { surfaceWater: 1, clouds: 0.3, vegetation: 1, permanentSnowIce: 1 },
		}, 64, 32)
		expect(generated.elevation).toBeNull()
		expect(generated.measuredCoverage.surfaceWater).toBe(0)
		expect(generated.measuredCoverage.vegetation).toBe(0)
		expect(generated.measuredCoverage.permanentSnowIce).toBe(0)
	})
})
