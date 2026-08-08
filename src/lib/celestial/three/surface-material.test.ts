import { describe, expect, it } from 'vitest'
import { DataTexture, SphereGeometry } from 'three'
import { createPlanetSurfaceVisual } from './surface-material.js'

describe('planet surface material composition', () => {
	it('installs independent procedural PBR channels without changing geometry', async () => {
		const sphere = new SphereGeometry(1, 8, 6)
		const visual = createPlanetSurfaceVisual({
			body: { id: 4, name: 'Pelagos', slug: 'pelagos', bodyType: 'ocean world' },
			colorCss: '#6B8BCD',
			radius: 0.02,
			sphereGeometry: sphere,
		})
		await visual.ready
		expect(visual.plan.channels.albedo.source).toBe('procedural')
		expect(visual.plan.coverage.surfaceWater).toBeNull()
		expect(visual.material.map).toBeInstanceOf(DataTexture)
		expect(visual.material.roughnessMap).toBeInstanceOf(DataTexture)
		expect(visual.material.bumpMap).toBeInstanceOf(DataTexture)
		expect(visual.cloudMesh).toBeNull()
		visual.dispose()
		sphere.dispose()
	})

	it('creates clouds only from an explicit requested fallback layer', async () => {
		const sphere = new SphereGeometry(1, 8, 6)
		const visual = createPlanetSurfaceVisual({
			body: {
				id: 5, name: 'Clouded', slug: 'clouded', bodyType: 'terrestrial',
				surface: {
					version: 4, fallback: 'procedural', class: 'terrestrial', seed: 9,
					coverage: { surfaceWater: 0.4, clouds: 0.5, vegetation: 0.45, permanentSnowIce: 0.1 },
					maps: {},
				},
			},
			colorCss: '#A09882',
			radius: 0.02,
			sphereGeometry: sphere,
		})
		await visual.ready
		expect(visual.cloudMesh).not.toBeNull()
		visual.setGeometryVisible(false)
		expect(visual.cloudMesh?.visible).toBe(false)
		visual.dispose()
		sphere.dispose()
	})
})
