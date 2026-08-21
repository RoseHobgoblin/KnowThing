import { describe, expect, it } from 'vitest'
import { resolveProceduralTextureLod } from './texture-lod.js'

describe('projected physical texture LOD', () => {
	it('upgrades at 96 and 256 physical pixels', () => {
		expect(resolveProceduralTextureLod(95, 256)).toBe(256)
		expect(resolveProceduralTextureLod(96, 256)).toBe(512)
		expect(resolveProceduralTextureLod(256, 512)).toBe(1024)
	})

	it('uses independent downgrade hysteresis', () => {
		expect(resolveProceduralTextureLod(72, 512)).toBe(512)
		expect(resolveProceduralTextureLod(71.9, 512)).toBe(256)
		expect(resolveProceduralTextureLod(192, 1024)).toBe(1024)
		expect(resolveProceduralTextureLod(191.9, 1024)).toBe(512)
		expect(resolveProceduralTextureLod(60, 1024)).toBe(256)
	})
})
