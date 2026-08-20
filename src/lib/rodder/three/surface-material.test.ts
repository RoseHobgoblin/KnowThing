import { describe, expect, it, vi } from 'vitest'
import { DataTexture, SphereGeometry, Texture, TextureLoader } from 'three'
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
		expect(visual.plan.channels.normal.source).toBe('procedural')
		expect(visual.material.normalMap).toBeInstanceOf(DataTexture)
		expect(visual.material.bumpMap).toBeNull()
		expect(visual.cloudMesh).toBeNull()
		visual.dispose()
		sphere.dispose()
	})

	it('creates clouds only from an explicit representative weather layer', async () => {
		const sphere = new SphereGeometry(1, 8, 6)
		const visual = createPlanetSurfaceVisual({
			body: {
				id: 5, name: 'Clouded', slug: 'clouded', bodyType: 'terrestrial',
				surface: {
					version: 5, fallback: 'procedural', class: 'terrestrial', seed: 9,
					coverage: { surfaceWater: 0.4, vegetation: 0.45, permanentSnowIce: 0.1 },
					maps: {},
				},
				weather: {
					version: 1,
					clouds: { mode: 'procedural', meanCover: 0.5, seed: 17 },
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

	it('lets uploaded elevation replace illustrative generated normals', async () => {
		const uploadedElevation = new Texture<HTMLImageElement>()
		const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
			queueMicrotask(() => onLoad?.(uploadedElevation))
			return uploadedElevation
		})
		const sphere = new SphereGeometry(1, 8, 6)
		const visual = createPlanetSurfaceVisual({
			body: {
				id: 6, name: 'Surveyed', slug: 'surveyed', bodyType: 'terrestrial',
				surface: {
					version: 5, fallback: 'procedural', class: 'terrestrial', seed: 10,
					coverage: { surfaceWater: 0.2, vegetation: 0.1, permanentSnowIce: 0 },
					maps: {
						elevation: {
							version: 1,
							mediaId: null,
							filename: 'surveyed-height.png',
							contentHash: null,
							interpretation: {
								projection: 'equirectangular',
								colorSpace: 'linear',
								elevationUnit: 'relative',
							},
						},
					},
				},
			},
			colorCss: '#7D7568',
			radius: 0.02,
			sphereGeometry: sphere,
		})
		await visual.ready
		await new Promise<void>(resolve => queueMicrotask(resolve))
		expect(visual.plan.channels.elevation.source).toBe('uploaded')
		expect(visual.plan.channels.normal.source).toBe('procedural')
		expect(visual.material.normalMap).toBeNull()
		expect(visual.material.bumpMap).toBe(uploadedElevation)
		visual.dispose()
		sphere.dispose()
		load.mockRestore()
	})

	it('does not allocate an unused procedural elevation GPU texture when a normal exists', async () => {
		const dispose = vi.spyOn(DataTexture.prototype, 'dispose')
		const sphere = new SphereGeometry(1, 8, 6)
		const visual = createPlanetSurfaceVisual({
			body: { id: 7, name: 'Generated', slug: 'generated', bodyType: 'rocky' },
			colorCss: '#80766B',
			radius: 0.02,
			sphereGeometry: sphere,
		})
		await visual.ready
		visual.dispose()
		expect(dispose).toHaveBeenCalledTimes(3)
		dispose.mockRestore()
		sphere.dispose()
	})
})
