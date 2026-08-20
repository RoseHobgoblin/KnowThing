import { describe, expect, it } from 'vitest'
import { SRGBColorSpace } from 'three'
import { createStellarSurfaceVisual } from './stellar-material.js'

describe('stellar surface material', () => {
	it('shows generated Starwright structure only in Enhanced mode', async () => {
		const visual = createStellarSurfaceVisual({
			body: {
				id: 1, name: 'Sun', slug: 'sun', bodyType: 'star', spectralType: 'G2V',
				temperatureK: 5_772, rotationPeriodS: 2_194_560,
				stellarSurface: { version: 2, fallback: 'procedural', morphology: 'auto', seed: 9, activity: 0.3, maps: {} },
			},
			colorCss: '#FFF4EA',
		})

		await visual.ready
		expect(visual.plan.photosphere.source).toBe('procedural')
		expect(visual.material.uniforms.hasPhotosphereMap.value).toBe(1)
		expect(visual.material.uniforms.photosphereMap.value.colorSpace).toBe(SRGBColorSpace)
		visual.setVisibilityMode('physical')
		expect(visual.material.uniforms.structureStrength.value).toBe(0)
		visual.setVisibilityMode('enhanced')
		expect(visual.material.uniforms.structureStrength.value).toBe(1)
		visual.setVisibilityMode('markers')
		expect(visual.material.uniforms.structureStrength.value).toBe(0)
		visual.dispose()
	})

	it('keeps a flat recipe untextured', () => {
		const visual = createStellarSurfaceVisual({
			body: {
				id: 2, name: 'Plain', slug: 'plain', bodyType: 'star',
				stellarSurface: { version: 2, fallback: 'flat', morphology: 'main_sequence', seed: null, activity: null, maps: {} },
			},
			colorCss: '#FFE088',
		})
		expect(visual.material.uniforms.hasPhotosphereMap.value).toBe(0)
		visual.setVisibilityMode('enhanced')
		expect(visual.material.uniforms.structureStrength.value).toBe(0)
		visual.dispose()
	})
})
