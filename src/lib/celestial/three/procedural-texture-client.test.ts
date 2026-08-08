import { describe, expect, it } from 'vitest'
import {
	compareTextureJobs,
	proceduralTextureCacheKey,
	selectProceduralCacheEvictions,
} from './procedural-texture-client.js'

const planet = {
	class: 'terrestrial' as const,
	seed: 12.9,
	temperatureK: 288.04,
	coverage: { surfaceWater: 0.500_04, vegetation: null, permanentSnowIce: 0, clouds: 0.2 },
	tint: [20.2, 30.6, 40.4] as [number, number, number],
}

describe('procedural texture scheduling', () => {
	it('quantizes insignificant drift but keys size and material changes', () => {
		const key = proceduralTextureCacheKey('planet', planet, 256)
		expect(proceduralTextureCacheKey('planet', { ...planet, temperatureK: 288.049 }, 256)).toBe(key)
		expect(proceduralTextureCacheKey('planet', { ...planet, coverage: { ...planet.coverage, surfaceWater: 0.51 } }, 256)).not.toBe(key)
		expect(proceduralTextureCacheKey('planet', planet, 512)).not.toBe(key)
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
