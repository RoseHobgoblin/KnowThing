import { expect, test } from '@playwright/test'

test.describe('rodder surface preview', () => {
	test('renders the unsaved terrestrial recipe and updates it live', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', error => pageErrors.push(error.message))
		await page.setViewportSize({ width: 980, height: 900 })
		await page.goto('/test/surface-preview')
		const preview = page.getByTestId('surface-preview')
		await expect(preview).toHaveAttribute('data-render-state', 'ready', { timeout: 20_000 })
		await expect(preview).toContainText('Illustrative')
		await expect(preview).toHaveScreenshot('surface-preview-terrestrial.png', { maxDiffPixels: 1_000 })

		const waterInput = page.getByLabel('Surface water, exact percentage of the entire spherical surface')
		await waterInput.fill('20')
		await waterInput.press('Enter')
		await expect(preview).toHaveAttribute('data-render-state', 'ready', { timeout: 20_000 })
		expect(pageErrors).toEqual([])
	})

	test('keeps the base color plate available without WebGL 2', async ({ page }) => {
		await page.addInitScript(() => {
			const original = HTMLCanvasElement.prototype.getContext
			HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
				if (type === 'webgl2') return null
				return original.call(this, type, ...args as [])
			} as typeof HTMLCanvasElement.prototype.getContext
		})
		await page.goto('/test/surface-preview')
		const preview = page.getByTestId('surface-preview')
		await expect(preview).toHaveAttribute('data-render-state', 'plate-only', { timeout: 20_000 })
		await expect(preview).toContainText('WebGL 2 is unavailable')
		await expect(preview.getByLabel('Two-to-one equirectangular preview of the base color appearance map')).toBeVisible()
	})

	test('renders the unsaved Starwright photosphere instead of a color swatch', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', error => pageErrors.push(error.message))
		await page.setViewportSize({ width: 980, height: 900 })
		await page.goto('/test/surface-preview')
		await expect(page.getByTestId('surface-preview')).toHaveAttribute('data-render-state', 'ready', { timeout: 20_000 })
		await page.getByRole('button', { name: 'Star', exact: true }).click()
		const preview = page.getByTestId('stellar-preview')
		await expect(preview).toHaveAttribute('data-render-state', 'ready', { timeout: 20_000 })
		await expect(preview).toContainText('Illustrative')
		await expect(preview).toContainText('main sequence')
		await expect(preview).toHaveScreenshot('stellar-preview-m3v.png', { maxDiffPixels: 1_000 })
		expect(pageErrors).toEqual([])
	})
})
