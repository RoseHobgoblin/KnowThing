import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getBodyPresets } from './presets.js'

describe('Mars preset data package', () => {
	it('carries physical, orbital, frame, and truthful surface defaults', () => {
		const mars = getBodyPresets().get('Mars')
		expect(mars).toMatchObject({
			massKg: 6.41691e23,
			radiusM: 3_389_500,
			rotationPeriodS: 88_642.664064,
			semiMajorAxisAu: 1.52371243,
			eccentricity: 0.09336511,
			inclination: 1.85181869,
			longitudeAscendingNode: 49.71320984,
			argumentOfPeriapsis: 286.36934232,
			surfacePressure: '0.636 kPa (mean; seasonally variable)',
		})
		expect(mars?.extra?.referenceBody).toMatchObject({
			frame: 'IAU_MARS', naifBodyCode: 499,
			latitudeType: 'planetocentric', longitudeDirection: 'positive-east',
		})
		expect(mars?.seedSurface).toMatchObject({
			fallback: 'flat', class: 'rocky',
			coverage: { surfaceWater: 0, vegetation: 0, permanentSnowIce: 0 },
		})
		expect(Object.keys(mars?.seedSurface?.maps ?? {}).toSorted()).toEqual(['albedo', 'elevation'])
	})

	it('pins every installed runtime plate to the checked-in bytes', async () => {
		const mars = getBodyPresets().get('Mars')
		for (const asset of Object.values(mars?.seedSurface?.maps ?? {})) {
			if (!asset) continue
			const assetPath = path.resolve('static', asset.publicPath)
			const buffer = await readFile(assetPath)
			const metadata = await sharp(buffer).metadata()
			expect(createHash('sha256').update(buffer).digest('hex')).toBe(asset.contentHash)
			expect(buffer.length).toBe(asset.sizeBytes)
			expect(metadata.width).toBe(asset.width)
			expect(metadata.height).toBe(asset.height)
		}
	})

	it('keeps analytical albedo separate from the sRGB appearance channel', async () => {
		const manifest = JSON.parse(await readFile(
			path.resolve('static/seed-data/celestial/mars/manifest.json'), 'utf8',
		)) as {
			referenceFrame: { localKernel: string, sourceSha256: string }
			products: Array<{
				role: string
				status: string
				bindingNote?: string
				localLabel?: string
				sourceLabelSha256?: string
				runtime?: { path: string, bytes: number, sha256: string }
			}>
		}
		const tes = manifest.products.find(product => product.role === 'bolometric-albedo')
		expect(tes).toMatchObject({ status: 'catalogued-not-material-bound' })
		expect(tes?.bindingNote).toContain('falsely grey')

		const root = path.resolve('static/seed-data/celestial/mars')
		const pinnedFiles = [
			{ path: manifest.referenceFrame.localKernel, hash: manifest.referenceFrame.sourceSha256 },
			...manifest.products.flatMap((product) => {
				const files: Array<{ path: string, hash: string, bytes?: number }> = []
				if (product.localLabel && product.sourceLabelSha256) {
					files.push({ path: product.localLabel, hash: product.sourceLabelSha256 })
				}
				if (product.runtime) files.push({
					path: product.runtime.path, hash: product.runtime.sha256, bytes: product.runtime.bytes,
				})
				return files
			}),
		]
		for (const pinned of pinnedFiles) {
			const buffer = await readFile(path.resolve(root, pinned.path))
			expect(createHash('sha256').update(buffer).digest('hex')).toBe(pinned.hash)
			if ('bytes' in pinned) expect(buffer.length).toBe(pinned.bytes)
		}
	})
})
