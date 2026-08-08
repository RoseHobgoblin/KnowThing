import { describe, expect, it } from 'vitest'
import { surfaceRecipeFromDraft } from './surface-editor.js'

describe('surface editor recipe', () => {
	it('uses the same validated recipe shape for live preview and persistence', () => {
		expect(surfaceRecipeFromDraft({
			surfaceFallback: 'procedural',
			surfaceClass: 'terrestrial',
			surfaceSeed: 436.8,
			surfaceHydrosphere: 0.55,
			surfaceCloudCoverage: 0.48,
			surfaceVegetation: 0.62,
			surfaceSnowCoverage: 0.14,
			surfaceMap_albedo: ' Saxnat albedo.png ',
			surfaceMap_normal: '',
		})).toEqual({
			version: 3,
			fallback: 'procedural',
			class: 'terrestrial',
			seed: 436,
			hydrosphereFraction: 0.55,
			cloudCoverage: 0.48,
			vegetationFraction: 0.62,
			snowCoverage: 0.14,
			maps: { albedo: {
				version: 1, mediaId: null, filename: 'Saxnat albedo.png', contentHash: null,
				interpretation: { projection: 'equirectangular', colorSpace: 'srgb' },
			} },
		})
	})

	it('sanitizes incomplete drafts to safe defaults', () => {
		expect(surfaceRecipeFromDraft({
			surfaceFallback: 'magic',
			surfaceClass: 'earthlike',
			surfaceHydrosphere: Number.NaN,
		})).toMatchObject({
			fallback: 'procedural',
			class: 'auto',
			hydrosphereFraction: null,
			cloudCoverage: null,
			vegetationFraction: null,
			snowCoverage: null,
			maps: {},
		})
	})
})
