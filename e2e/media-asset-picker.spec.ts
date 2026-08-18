import { expect, test } from '@playwright/test'

const valid = {
	id: 12, filename: 'Saxnat albedo.png', mimeType: 'image/png', width: 2048, height: 1024,
	sizeBytes: 4096, description: 'Authoritative Saxnat albedo', hash: 'a'.repeat(64),
	hasThumb150: true, hasThumb300: true, hasThumb600: true,
	uploadedAt: '2026-08-08T00:00:00Z', usageCount: 0,
}
const invalid = { ...valid, id: 13, filename: 'Portrait.png', width: 800, height: 800, hash: 'b'.repeat(64) }

test.describe('real Media asset selection', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/api/media?*', (route) => {
			const compatibleOnly = new URL(route.request().url()).searchParams.get('rodderPlate') === 'true'
			const files = compatibleOnly ? [valid] : [valid, invalid]
			return route.fulfill({ json: { files, total: files.length } })
		})
		await page.route('**/api/media-assets/12', route => route.fulfill({ json: valid }))
		await page.route('**/api/media-assets/12/*', route => route.fulfill({
			status: 200,
			contentType: 'image/png',
			body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M/wHwAF/gL+4gLO9wAAAABJRU5ErkJggg==', 'base64'),
		}))
	})

	test('searches, rejects an incompatible plate, binds a pinned revision, and clears it', async ({ page }) => {
		await page.goto('/test/media-asset-picker')
		await expect(page.getByTestId('picker-fixture')).toHaveAttribute('data-render-state', 'ready')
		await page.getByRole('button', { name: 'Choose base color map' }).click()
		await page.getByLabel('Compatible only').uncheck()
		const portrait = page.getByRole('button', { name: /Portrait\.png/ })
		await expect(portrait).toBeDisabled()
		await page.getByRole('button', { name: /Saxnat albedo\.png/ }).click()
		await expect(page.getByTestId('binding-output')).toContainText(`12:Saxnat albedo.png:${'a'.repeat(64)}`)
		await expect(page.getByText('Selected', { exact: true })).toBeVisible()
		await page.getByRole('button', { name: 'Clear' }).click()
		await expect(page.getByTestId('binding-output')).toHaveText('none')
	})

	test('uploads and immediately selects a compatible image', async ({ page }) => {
		const uploaded = { ...valid, id: 21, filename: 'New world.png', hash: 'c'.repeat(64) }
		await page.route('**/api/media', async (route) => {
			if (route.request().method() === 'POST') await route.fulfill({ status: 201, json: uploaded })
			else await route.fallback()
		})
		await page.route('**/api/media-assets/21', route => route.fulfill({ json: uploaded }))
		await page.route('**/api/media-assets/21/*', route => route.fulfill({ status: 200, contentType: 'image/png', body: '' }))

		await page.goto('/test/media-asset-picker')
		await expect(page.getByTestId('picker-fixture')).toHaveAttribute('data-render-state', 'ready')
		await page.getByRole('button', { name: 'Choose base color map' }).click()
		await page.getByLabel(/Upload image/).setInputFiles({
			name: 'New world.png', mimeType: 'image/png', buffer: Buffer.from('texture'),
		})
		await expect(page.getByTestId('binding-output')).toContainText(`21:New world.png:${'c'.repeat(64)}`)
	})
})
