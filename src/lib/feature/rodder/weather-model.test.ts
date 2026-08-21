import { describe, expect, it } from 'vitest'
import { composeWeatherPlan, parseWeatherRecipe } from './public/weather-model.js'

describe('weather recipe', () => {
	it('defaults to no cloud layer', () => {
		const plan = composeWeatherPlan({ id: 4, slug: 'dry' }, null)
		expect(plan.recipe.clouds).toEqual({ mode: 'none', meanCover: null, seed: null })
		expect(plan.clouds.source).toBe('unavailable')
	})

	it('migrates explicit legacy procedural coverage but not uploaded masks', () => {
		const recipe = parseWeatherRecipe(null, {
			coverage: { clouds: 0.47 },
			maps: { clouds: 'dated-observation.png' },
		})
		expect(recipe.clouds).toEqual({ mode: 'procedural', meanCover: 0.47, seed: null })
		expect('maps' in recipe).toBe(false)
	})

	it('clamps authored mean cover and resolves a stable independent seed', () => {
		const first = composeWeatherPlan({ id: 9, slug: 'pelagos' }, {
			clouds: { mode: 'procedural', meanCover: 2, seed: null },
		})
		const second = composeWeatherPlan({ id: 9, slug: 'pelagos' }, first.recipe)
		expect(first.recipe.clouds.meanCover).toBe(1)
		expect(first.clouds.seed).toBe(second.clouds.seed)
		expect(first.clouds.source).toBe('procedural')
	})
})
