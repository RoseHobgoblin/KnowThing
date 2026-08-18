import { expect, test } from '@playwright/test'

test.describe('rodder independent body root map', () => {
	test('renders, lights, and selects a rogue world without a star', async ({ page }) => {
		await page.setViewportSize({ width: 1100, height: 850 })
		await page.goto('/test/rodder-body-root-map')
		const map = page.locator('[data-render-state="ready"]')
		await expect(map).toBeVisible({ timeout: 15_000 })
		await expect(page.getByText(/No stellar light .* ambient presentation/)).toBeVisible()

		const canvas = page.locator('canvas')
		const rootLabel = page.locator('[data-entity-key="body:300"]')
		await expect(rootLabel).toContainText('Waywain')
		const rootPosition = {
			x: Number(await rootLabel.getAttribute('data-anchor-x')),
			y: Number(await rootLabel.getAttribute('data-anchor-y')),
		}
		await canvas.click({ position: rootPosition })
		await expect(page.getByTestId('body-root-selection')).toHaveText('body:300')

		const moonLabel = page.locator('[data-entity-key="body:301"]')
		await expect(moonLabel).toContainText('Wisp')
	})
})
