import { describe, expect, it } from 'vitest'
import { surfaceRecipeFromDraft } from './surface-editor.js'

describe('surface editor recipe', () => {
	it('uses the validated v5 recipe for preview and persistence', () => {
		expect(surfaceRecipeFromDraft({
			surfaceFallback: 'procedural', surfaceClass: 'terrestrial', surfaceSeed: 436.8,
			surfaceHydrosphere: 0.55,
			surfaceVegetation: 0.62, surfaceSnowCoverage: 0.14,
			surfaceMap_albedo: ' Saxnat albedo.png ', surfaceMap_normal: '',
		})).toEqual({
			version: 5,
			fallback: 'procedural',
			class: 'terrestrial',
			seed: 436,
			coverage: { surfaceWater: 0.55, vegetation: 0.62, permanentSnowIce: 0.14 },
			maps: { albedo: {
				version: 1, mediaId: null, filename: 'Saxnat albedo.png', contentHash: null,
				interpretation: { projection: 'equirectangular', colorSpace: 'srgb' },
			} },
		})
	})

	it('keeps incomplete coverage null and resolves invalid class to unspecified', () => {
		expect(surfaceRecipeFromDraft({ surfaceFallback: 'magic', surfaceClass: 'earthlike' })).toMatchObject({
			fallback: 'procedural', class: null,
			coverage: { surfaceWater: null, vegetation: null, permanentSnowIce: null },
			maps: {},
		})
	})
})
