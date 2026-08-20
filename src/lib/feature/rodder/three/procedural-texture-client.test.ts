import { describe, expect, it } from 'vitest'
import {
	compareTextureJobs,
	normalizeProceduralPlanetParameters,
	normalizeProceduralStellarParameters,
	proceduralTextureCacheKey,
	selectProceduralCacheEvictions,
} from './procedural-texture-client.js'

const planet = {
	class: 'terrestrial' as const,
	seed: 12.9,
	temperatureK: 288.04,
	coverage: { surfaceWater: 0.500_04, vegetation: null, permanentSnowIce: 0 },
	clouds: { meanCover: 0.2, seed: 91 },
	tint: [20.2, 30.6, 40.4] as [number, number, number],
}

describe('procedural texture scheduling', () => {
	it('quantizes insignificant drift but keys size and material changes', () => {
		const key = proceduralTextureCacheKey('planet', planet, 256)
		expect(proceduralTextureCacheKey('planet', { ...planet, temperatureK: 288.049 }, 256)).toBe(key)
		expect(proceduralTextureCacheKey('planet', { ...planet, coverage: { ...planet.coverage, surfaceWater: 0.51 } }, 256)).not.toBe(key)
		expect(proceduralTextureCacheKey('planet', { ...planet, clouds: { ...planet.clouds, seed: 92 } }, 256)).not.toBe(key)
		expect(proceduralTextureCacheKey('planet', planet, 512)).not.toBe(key)
	})

	it('quantizes host-star temperature to 100 K in the cache key', () => {
		const cool = proceduralTextureCacheKey('planet', { ...planet, starTemperatureK: 3_210 }, 256)
		expect(proceduralTextureCacheKey('planet', { ...planet, starTemperatureK: 3_240 }, 256)).toBe(cool)
		expect(proceduralTextureCacheKey('planet', { ...planet, starTemperatureK: 3_300 }, 256)).not.toBe(cool)
	})

	it('keys uploaded base-colour ownership separately from generated colour', () => {
		const generated = proceduralTextureCacheKey('planet', planet, 256)
		const superseded = proceduralTextureCacheKey('planet', { ...planet, generateAlbedo: false }, 256)
		expect(superseded).not.toBe(generated)
		expect(normalizeProceduralPlanetParameters({ ...planet, generateAlbedo: false }).generateAlbedo).toBe(false)
	})

	it('uses the same normalized values for generation that it uses for cache identity', () => {
		expect(normalizeProceduralPlanetParameters({
			...planet,
			starTemperatureK: 3_240,
		})).toMatchObject({
			seed: 12,
			temperatureK: 288,
			starTemperatureK: 3_200,
			coverage: { surfaceWater: 0.5 },
			tint: [20, 31, 40],
		})
		expect(normalizeProceduralStellarParameters({
			temperatureK: 5_772.04,
			morphology: 'main_sequence',
			rotationDays: 25.400_4,
			activity: 0.300_4,
			seed: 8.9,
		})).toEqual({
			temperatureK: 5_772,
			morphology: 'main_sequence',
			rotationDays: 25.4,
			activity: 0.3,
			seed: 8,
		})
	})

	it('orders foreground first and preserves FIFO within a priority', () => {
		const jobs = [
			{ priority: 'background' as const, sequence: 1 },
			{ priority: 'foreground' as const, sequence: 3 },
			{ priority: 'foreground' as const, sequence: 2 },
		].toSorted(compareTextureJobs)
		expect(jobs.map(job => job.sequence)).toEqual([2, 3, 1])
	})

	it('evicts resolved LRU bytes and never evicts in-flight entries', () => {
		expect(selectProceduralCacheEvictions([
			{ key: 'pending', bytes: 0, settled: false },
			{ key: 'old', bytes: 30, settled: true },
			{ key: 'new', bytes: 30, settled: true },
		], 60, 20, 30, 80)).toEqual(['old'])
	})
})
