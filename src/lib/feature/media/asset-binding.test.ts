import { describe, expect, it } from 'vitest'
import {
	assessMediaCompatibility,
	mediaAssetContentUrl,
	mediaBindingFromItem,
	parseMediaAssetBinding,
} from './public/media-binding.js'

const item = {
	id: 12,
	filename: 'Saxnat albedo.png',
	mimeType: 'image/png',
	width: 2048,
	height: 1024,
	sizeBytes: 4000,
	description: null,
	hash: 'a'.repeat(64),
	hasThumb150: true,
	hasThumb300: true,
	hasThumb600: true,
	uploadedAt: '2026-08-08T00:00:00Z',
	usageCount: 0,
}

const albedo = { projection: 'equirectangular', colorSpace: 'srgb' } as const
const normal = { projection: 'equirectangular', colorSpace: 'linear', normalY: 'up' } as const
const elevation = { projection: 'equirectangular', colorSpace: 'linear', elevationUnit: 'relative' } as const
const plate = { mimePrefix: 'image/', aspectRatio: 2, aspectRatioTolerance: 0.04, minimumWidth: 1024, minimumHeight: 512, requireContentHash: true }

describe('media asset bindings', () => {
	it('creates an immutable ID/hash binding with channel interpretation', () => {
		const binding = mediaBindingFromItem(item, albedo)
		expect(binding).toMatchObject({ mediaId: 12, filename: item.filename, contentHash: item.hash })
		expect(binding.interpretation).toEqual({ projection: 'equirectangular', colorSpace: 'srgb' })
		expect(mediaAssetContentUrl(binding)).toBe(`/api/media-assets/12/${item.hash}`)
	})

	it('keeps legacy filename recipes readable', () => {
		const binding = parseMediaAssetBinding(' old normal.png ', normal)
		expect(binding).toMatchObject({ mediaId: null, filename: 'old normal.png', contentHash: null })
		expect(binding?.interpretation.normalY).toBe('up')
		expect(mediaAssetContentUrl(binding!)).toBe('/api/media/old%20normal.png')
	})

	it('retains measured elevation encoding and datum metadata', () => {
		const binding = parseMediaAssetBinding({
			filename: 'mars-mola.png',
			interpretation: {
				elevationUnit: 'm', elevationScale: 29_348, elevationOffset: -8177,
				elevationDatum: 'Mars GMM3 areoid', elevationPositiveDirection: 'up',
			},
		}, elevation)
		expect(binding?.interpretation).toMatchObject({
			elevationUnit: 'm', elevationScale: 29_348, elevationOffset: -8177,
			elevationDatum: 'Mars GMM3 areoid', elevationPositiveDirection: 'up',
		})
	})

	it('rejects non-images and non-2:1 plates while warning about low resolution', () => {
		expect(assessMediaCompatibility({ ...item, width: 800, height: 400 }, plate)).toMatchObject({
			compatible: true,
			warnings: ['Below the recommended 1024 × 512 overview resolution'],
		})
		expect(assessMediaCompatibility({ ...item, mimeType: 'application/pdf', width: 800, height: 800 }, plate).compatible).toBe(false)
	})
})
