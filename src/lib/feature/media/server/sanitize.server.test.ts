import { describe, expect, it } from 'vitest'
import { verifyMimeType } from './sanitize.server.js'

const PNG_FIXTURE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9KPAAAAAElFTkSuQmCC',
	'base64',
)

describe('verifyMimeType', () => {
	it('accepts an image whose detected type matches its declaration', async () => {
		await expect(verifyMimeType(PNG_FIXTURE, 'image/png')).resolves.toBeUndefined()
	})

	it('rejects a declaration that disagrees with the detected type', async () => {
		await expect(verifyMimeType(PNG_FIXTURE, 'image/jpeg')).rejects.toMatchObject({
			status: 400,
			body: { message: 'File contents (image/png) do not match declared type (image/jpeg).' },
		})
	})

	it('rejects corrupt raster data even when its signature is recognizable', async () => {
		const corruptPng = PNG_FIXTURE.subarray(0, 24)

		await expect(verifyMimeType(corruptPng, 'image/png')).rejects.toMatchObject({
			status: 400,
			body: { message: 'Unable to verify image type from file contents.' },
		})
	})

	it('accepts a PDF whose signature matches its declaration', async () => {
		const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF')

		await expect(verifyMimeType(pdf, 'application/pdf')).resolves.toBeUndefined()
	})

	it('keeps SVG validation on the text-aware path', async () => {
		const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')

		await expect(verifyMimeType(svg, 'image/svg+xml')).resolves.toBeUndefined()
	})
})
