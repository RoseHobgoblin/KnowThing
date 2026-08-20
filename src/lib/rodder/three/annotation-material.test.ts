import { describe, expect, it } from 'vitest'
import { AdditiveBlending, Texture } from 'three'
import {
	createApparentSkyPointMaterial,
	createOverviewMarkerMaterial,
} from './annotation-material.js'

describe('scene annotation materials', () => {
	it('keeps overview markers independent of scene exposure', () => {
		const texture = new Texture()
		const material = createOverviewMarkerMaterial(texture, '#FFFFFF')

		expect(material.toneMapped).toBe(false)
		expect(material.depthTest).toBe(true)
		expect(material.depthWrite).toBe(false)

		material.dispose()
		texture.dispose()
	})

	it('keeps unresolved apparent-sky points independent of scene exposure', () => {
		const texture = new Texture()
		const material = createApparentSkyPointMaterial(texture, '#FFFFFF')

		expect(material.toneMapped).toBe(false)
		expect(material.blending).toBe(AdditiveBlending)
		expect(material.depthTest).toBe(true)
		expect(material.depthWrite).toBe(false)

		material.dispose()
		texture.dispose()
	})
})
