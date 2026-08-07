import { expect, test, type Page } from '@playwright/test'

async function ready(page: Page) {
	const pageErrors: string[] = []
	page.on('pageerror', error => pageErrors.push(error.message))
	await page.goto('/test/celestial-map')
	await expect(page.locator('[data-render-state="ready"]')).toBeVisible({ timeout: 15_000 })
	await page.waitForTimeout(100)
	expect(pageErrors).toEqual([])
}

test.describe('celestial map', () => {
	test('renders Orrery and Plan at desktop width', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 })
		await ready(page)
		await expect(page.getByTestId('map-frame')).toHaveScreenshot('orrery-desktop.png')
		await page.getByRole('button', { name: 'Plan', exact: true }).click()
		await expect(page.getByTestId('map-frame')).toHaveScreenshot('plan-desktop.png')
	})

	test('keeps the physical orrery bounded in a tall container', async ({ page }) => {
		await page.setViewportSize({ width: 430, height: 900 })
		await ready(page)
		await expect(page.getByTestId('map-frame')).toHaveScreenshot('orrery-mobile-physical.png')
	})

	test('pans continuously with WASD and arrow keys while the canvas is focused', async ({ page }) => {
		await page.setViewportSize({ width: 1100, height: 850 })
		await ready(page)
		await page.getByRole('button', { name: 'Plan', exact: true }).click()
		const canvas = page.locator('canvas')
		await canvas.focus()
		await page.keyboard.down('d')
		await page.waitForTimeout(80)
		await page.keyboard.up('d')
		await expect(page.getByRole('button', { name: /Reset/ })).toBeVisible()
		await page.getByRole('button', { name: /Reset/ }).click()
		await canvas.focus()
		await page.keyboard.down('ArrowUp')
		await page.waitForTimeout(80)
		await page.keyboard.up('ArrowUp')
		await expect(page.getByRole('button', { name: /Reset/ })).toBeVisible()
	})

	test('selects, focuses, follows fractional playback, resets, and resizes', async ({ page }) => {
		await page.setViewportSize({ width: 1100, height: 850 })
		await ready(page)
		await page.getByRole('button', { name: 'All', exact: true }).click()
		const canvas = page.locator('canvas')
		const box = await canvas.boundingBox()
		expect(box).not.toBeNull()
		const brontesLabel = page.locator('[data-entity-key="body:13"]')
		const anchorX = Number(await brontesLabel.getAttribute('data-anchor-x'))
		const anchorY = Number(await brontesLabel.getAttribute('data-anchor-y'))
		const bodyPosition = {
			x: anchorX,
			y: anchorY,
		}
		await canvas.hover({ position: bodyPosition })
		await expect(page.getByTestId('map-tooltip')).toContainText('Brontes')
		await canvas.click({ position: bodyPosition })
		await expect(page.getByTestId('fixture-selection')).toHaveText('body:13')
		await expect(page.getByTestId('map-frame')).toHaveScreenshot('selected-body-desktop.png')
		await canvas.dblclick({ position: bodyPosition })
		await expect(page.getByTestId('map-frame')).toHaveScreenshot('focused-body-desktop.png', { maxDiffPixels: 20 })
		await page.getByRole('button', { name: 'Follow', exact: true }).click()
		await page.getByRole('button', { name: 'Play', exact: true }).click()
		const initialDay = await page.getByTestId('fixture-day').textContent()
		await expect(page.getByTestId('fixture-day')).not.toHaveText(initialDay!)
		await canvas.hover()
		await page.mouse.wheel(0, -500)
		await page.getByRole('button', { name: /Reset/ }).click()
		await page.setViewportSize({ width: 760, height: 980 })
		await expect(page.locator('[data-render-state="ready"]')).toBeVisible()
	})

	test('shows the accessible fallback when WebGL2 is unavailable', async ({ page }) => {
		await page.addInitScript(() => {
			const original = HTMLCanvasElement.prototype.getContext
			HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
				if (type === 'webgl2') return null
				return original.call(this, type, ...args as [])
			} as typeof HTMLCanvasElement.prototype.getContext
		})
		await page.goto('/test/celestial-map')
		await expect(page.locator('[data-render-state="unavailable"]')).toBeVisible({ timeout: 15_000 })
		await expect(page.getByRole('heading', { name: 'Interactive map unavailable' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Open' }).first()).toBeVisible()
	})

	test('replaces an unrecoverable context loss with the accessible fallback', async ({ page }) => {
		await ready(page)
		await page.locator('canvas').evaluate((canvas) => {
			const context = canvas.getContext('webgl2')
			context?.getExtension('WEBGL_lose_context')?.loseContext()
		})
		await expect(page.locator('[data-render-state="unavailable"]')).toBeVisible()
		await expect(page.getByText(/graphics context was lost/i)).toBeVisible()
	})
})
