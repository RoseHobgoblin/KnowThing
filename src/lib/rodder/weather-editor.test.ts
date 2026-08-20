import { describe, expect, it } from 'vitest'
import { weatherRecipeFromDraft } from './weather-editor.js'

describe('weather editor recipe', () => {
	it('stores representative procedural clouds separately from the surface recipe', () => {
		expect(weatherRecipeFromDraft({
			weatherCloudMode: 'procedural',
			weatherCloudMeanCover: 0.48,
			weatherCloudSeed: 91.8,
		})).toEqual({
			version: 1,
			clouds: { mode: 'procedural', meanCover: 0.48, seed: 91 },
		})
	})
})
