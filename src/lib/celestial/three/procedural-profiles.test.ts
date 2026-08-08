import { describe, expect, it } from 'vitest'
import { sampleRamp, type ColorStop } from './procedural-profiles.js'

const ramp: ColorStop[] = [
	[0, [0, 0, 0]],
	[0.5, [100, 50, 200]],
	[1, [200, 100, 0]],
]

describe('multi-stop color ramp', () => {
	it('clamps outside the stop range', () => {
		expect(sampleRamp(ramp, -1)).toEqual([0, 0, 0])
		expect(sampleRamp(ramp, 2)).toEqual([200, 100, 0])
	})

	it('returns exact stop colors at stop positions', () => {
		expect(sampleRamp(ramp, 0)).toEqual([0, 0, 0])
		expect(sampleRamp(ramp, 0.5)).toEqual([100, 50, 200])
		expect(sampleRamp(ramp, 1)).toEqual([200, 100, 0])
	})

	it('interpolates linearly between bracketing stops', () => {
		expect(sampleRamp(ramp, 0.25)).toEqual([50, 25, 100])
		expect(sampleRamp(ramp, 0.75)).toEqual([150, 75, 100])
	})

	it('supports arbitrary ascending domains such as Kelvin', () => {
		const kelvin: ColorStop[] = [[3_200, [90, 50, 40]], [5_800, [110, 140, 55]]]
		expect(sampleRamp(kelvin, 4_500)).toEqual([100, 95, 47.5])
	})
})
