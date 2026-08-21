import { describe, expect, it } from 'vitest'
import { stellarSurfaceRecipeFromDraft } from './public/stellar-surface-editor.js'

describe('stellar surface editor recipe', () => {
	it('shares one validated Starwright recipe between preview and persistence', () => {
		expect(stellarSurfaceRecipeFromDraft({
			stellarSurfaceFallback: 'procedural',
			stellarMorphology: 'main_sequence',
			stellarSurfaceSeed: 81.9,
			stellarActivity: 0.72,
			stellarPhotosphereMap: ' Therne photosphere.webp ',
		})).toEqual({
			version: 2,
			fallback: 'procedural',
			morphology: 'main_sequence',
			seed: 81,
			activity: 0.72,
			maps: { photosphere: {
				version: 1, mediaId: null, filename: 'Therne photosphere.webp', contentHash: null,
				interpretation: { projection: 'equirectangular', colorSpace: 'srgb' },
			} },
		})
	})

	it('normalizes incomplete stellar drafts', () => {
		expect(stellarSurfaceRecipeFromDraft({
			stellarSurfaceFallback: 'unknown',
			stellarMorphology: 'neutron_star',
			stellarActivity: Number.NaN,
		})).toMatchObject({
			fallback: 'procedural',
			morphology: 'auto',
			seed: null,
			activity: null,
			maps: {},
		})
	})
})
