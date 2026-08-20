import { describe, expect, it } from 'vitest'
import { MeshStandardMaterial, SphereGeometry, Sprite, SpriteMaterial, Texture } from 'three'
import { createBodyVisual } from './body-visual.js'

describe('body visual selection', () => {
	it('never changes the physical mesh scale when selection changes', () => {
		const sphereGeometry = new SphereGeometry(1, 8, 6)
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
			markerTexture,
			selectionTexture,
			selectionColor: '#FFE088',
			worldUnitsPerAu: 100,
		})
		const original = visual.mesh.scale.clone()
		const marker = visual.anchor.getObjectByName('overview-marker') as Sprite
		expect(visual.ringMeshes).toHaveLength(0)
		visual.setVisibility('enhanced', 1)
		expect((marker.material as SpriteMaterial).opacity).toBeGreaterThan(0)
		expect((marker.material as SpriteMaterial).depthTest).toBe(true)
		expect((marker.material as SpriteMaterial).toneMapped).toBe(false)
		visual.setVisibility('enhanced', visual.extent / 10)
		expect((marker.material as SpriteMaterial).opacity).toBe(0)
		visual.setSelected(true, true)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		expect((visual.mesh.material as MeshStandardMaterial).emissiveIntensity).toBe(1)
		visual.setSelected(false, true)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		visual.setSelected(false, false)
		expect(visual.mesh.scale.equals(original)).toBe(true)
		visual.dispose()
		sphereGeometry.dispose()
		markerTexture.dispose()
		selectionTexture.dispose()
	})

	it('changes aids, not physical scale, across visibility modes', () => {
		const sphereGeometry = new SphereGeometry(1, 8, 6)
		const markerTexture = new Texture()
		const selectionTexture = new Texture()
		const visual = createBodyVisual({
			body: { id: 2, name: 'Tiny world', slug: 'tiny-world', bodyType: 'planet', radiusM: 1_000_000 },
			isStar: false,
			isSatellite: false,
			sphereGeometry,
			markerTexture,
			selectionTexture,
			selectionColor: '#FFE088',
			worldUnitsPerAu: 100,
		})
		const physicalScale = visual.mesh.scale.clone()
		const marker = visual.anchor.getObjectByName('overview-marker') as Sprite

		visual.setVisibility('physical', 1)
		expect(visual.mesh.visible).toBe(true)
		expect((marker.material as SpriteMaterial).opacity).toBe(0)

		visual.setVisibility('enhanced', 1)
		expect(visual.mesh.visible).toBe(true)
		expect((marker.material as SpriteMaterial).opacity).toBeGreaterThan(0)

		visual.setVisibility('markers', 1)
		expect(visual.mesh.visible).toBe(false)
		expect((marker.material as SpriteMaterial).opacity).toBeGreaterThan(0)
		expect(visual.mesh.scale.equals(physicalScale)).toBe(true)

		visual.dispose()
		sphereGeometry.dispose()
		markerTexture.dispose()
		selectionTexture.dispose()
	})

	it('renders authored bands at physical radii with individual appearance and provenance', () => {
		const sphereGeometry = new SphereGeometry(1, 8, 6)
		const markerTexture = new Texture()
		const selectionTexture = new Texture()
		const visual = createBodyVisual({
			body: {
				id: 3, name: 'Ringed world', slug: 'ringed-world', bodyType: 'planet', radiusM: 10_000_000,
				ringSystems: [{
					id: 30, name: 'Main rings', slug: 'main-rings',
					ringSystem: {
						schemaVersion: 1, plane: 'parent-equatorial',
						bands: [
							{ name: 'Broad', innerRadiusM: 13_000_000, outerRadiusM: 17_000_000, color: '#abcdef', opacity: 0.25, provenance: 'authored' },
							{ name: 'Narrow', innerRadiusM: 19_000_000, outerRadiusM: 20_000_000, opacity: 0.6, provenance: 'imported' },
						],
					},
				}],
			},
			isStar: false,
			isSatellite: false,
			sphereGeometry,
			markerTexture,
			selectionTexture,
			selectionColor: '#FFE088',
			worldUnitsPerAu: 100,
		})
		expect(visual.ringMeshes).toHaveLength(2)
		expect(visual.ringMeshes[0].name).toBe('ring-band:30:0')
		expect(visual.ringMeshes[0].userData).toMatchObject({ bandName: 'Broad', provenance: 'authored' })
		expect(visual.ringMeshes[0].material.opacity).toBe(0.25)
		expect(visual.ringMeshes[0].material.emissive.getHex()).toBe(0)
		expect(visual.extent).toBeCloseTo(20_000_000 / 149_597_870_700 * 100)
		expect(visual.anchor.userData.ringPresentation).toEqual({ status: 'authored', bandCount: 2 })

		visual.dispose()
		sphereGeometry.dispose()
		markerTexture.dispose()
		selectionTexture.dispose()
	})
})
