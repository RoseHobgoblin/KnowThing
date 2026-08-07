import { describe, expect, it } from 'vitest'
import { SphereGeometry, Sprite, SpriteMaterial, Texture } from 'three'
import { createBodyVisual } from './body-visual.js'

describe('body visual selection', () => {
	it('never changes the physical mesh scale when selection changes', () => {
		const sphereGeometry = new SphereGeometry(1, 8, 6)
		const glowTexture = new Texture()
		const markerTexture = new Texture()
		const selectionTexture = new Texture()
		const visual = createBodyVisual({
			body: {
				id: 1,
				name: 'Test world',
				slug: 'test-world',
				bodyType: 'planet',
				radiusM: 69_900_000,
			},
			isStar: false,
			isSatellite: false,
			sphereGeometry,
			glowTexture,
			markerTexture,
			selectionTexture,
			selectionColor: '#FFE088',
			worldUnitsPerAu: 100,
		})
		const original = visual.mesh.scale.clone()
		const marker = visual.anchor.getObjectByName('overview-marker') as Sprite
		visual.setWorldUnitsPerPixel(1)
		expect((marker.material as SpriteMaterial).opacity).toBeGreaterThan(0)
		visual.setWorldUnitsPerPixel(visual.extent / 10)
		expect((marker.material as SpriteMaterial).opacity).toBe(0)
		visual.setSelected(true, true)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		visual.setSelected(false, true)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		visual.setSelected(false, false)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		visual.dispose()
		sphereGeometry.dispose()
		glowTexture.dispose()
		markerTexture.dispose()
		selectionTexture.dispose()
	})
})
