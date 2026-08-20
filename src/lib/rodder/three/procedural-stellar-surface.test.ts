import { describe, expect, it } from 'vitest'
import {
	generateProceduralStellarSurface,
	linearChannelToSrgb,
	srgbChannelToLinear,
	temperatureDisplayRgb,
} from './procedural-stellar-surface.js'

const base = {
	temperatureK: 5_772,
	morphology: 'main_sequence' as const,
	rotationDays: 25.4,
	activity: 0.3,
	seed: 436,
}

describe('Starwright procedural photosphere', () => {
	it('is byte-for-byte deterministic and seeded', () => {
		const first = generateProceduralStellarSurface(base, 32, 16)
		const same = generateProceduralStellarSurface(base, 32, 16)
		const rerolled = generateProceduralStellarSurface({ ...base, seed: 437 }, 32, 16)
		expect(first.photosphere).toEqual(same.photosphere)
		expect(first.photosphere).not.toEqual(rerolled.photosphere)
		expect(first.photosphere).toHaveLength(32 * 16 * 4)
	})

	it('changes display hue with temperature', () => {
		const cool = temperatureDisplayRgb(3_200)
		const hot = temperatureDisplayRgb(15_000)
		expect(cool[0] - cool[2]).toBeGreaterThan(80)
		expect(hot[2]).toBeGreaterThan(hot[0])
	})

	it('round-trips the explicit sRGB and linear transfer', () => {
		for (const channel of [0, 0.003, 0.18, 0.5, 1]) {
			expect(linearChannelToSrgb(srgbChannelToLinear(channel))).toBeCloseTo(channel, 10)
		}
	})

	it('does not invent white-dwarf spots', () => {
		const generated = generateProceduralStellarSurface({
			...base,
			morphology: 'white_dwarf',
			activity: 1,
			temperatureK: 16_000,
		}, 24, 12)
		expect(generated.spotCoverageEstimate).toBe(0)
	})

	it('keeps every output channel finite and opaque', () => {
		const generated = generateProceduralStellarSurface({
			...base,
			morphology: 'giant',
			activity: 1,
		}, 16, 8)
		for (let offset = 0; offset < generated.photosphere.length; offset += 4) {
			expect(generated.photosphere[offset + 3]).toBe(255)
		}
		expect(generated.spotCoverageEstimate).toBeGreaterThanOrEqual(0)
		expect(generated.spotCoverageEstimate).toBeLessThanOrEqual(1)
	})

	it('stays finite over the supported display temperature sweep', () => {
		for (const temperatureK of [1, 1_000, 5_772, 40_000, 1_000_000]) {
			const generated = generateProceduralStellarSurface({ ...base, temperatureK }, 8, 4)
			expect(generated.photosphere.every(Number.isFinite)).toBe(true)
		}
	})
})
