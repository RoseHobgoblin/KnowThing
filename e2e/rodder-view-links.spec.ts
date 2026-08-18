import { expect, test, type Page } from '@playwright/test'

async function grantClipboard(page: Page) {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
}

async function copiedView(page: Page): Promise<{ url: string, state: Record<string, unknown> }> {
	await page.getByRole('button', { name: 'Copy view link', exact: true }).click()
	const url = await page.evaluate(() => navigator.clipboard.readText())
	const encoded = new URL(url).searchParams.get('view')
	expect(encoded).not.toBeNull()
	return { url, state: JSON.parse(encoded!) as Record<string, unknown> }
}

function rounded(value: unknown): unknown {
	if (typeof value === 'number') return Math.round(value * 1e8) / 1e8
	if (Array.isArray(value)) return value.map(rounded)
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rounded(entry)]))
	}
	return value
}

test.describe('Rodder view links', () => {
	test('round-trips a root composition through a copied URL', async ({ page }) => {
		await grantClipboard(page)
		await page.setViewportSize({ width: 1100, height: 850 })
		await page.goto('/test/rodder-root-map')
		await expect(page.locator('[data-render-state="ready"]')).toBeVisible({ timeout: 15_000 })

		await page.getByRole('button', { name: 'Plan', exact: true }).click()
		await page.getByRole('button', { name: 'All', exact: true }).click()
		await page.getByRole('button', { name: 'Full', exact: true }).click()
		await page.getByRole('button', { name: 'Markers', exact: true }).click()
		await page.getByRole('button', { name: 'Advance Â¼ day', exact: true }).click()

		const canvas = page.locator('canvas')
		const label = page.locator('[data-entity-key="body:13"]')
		const position = {
			x: Number(await label.getAttribute('data-anchor-x')),
			y: Number(await label.getAttribute('data-anchor-y')),
		}
		await canvas.click({ position })
		await canvas.dblclick({ position })
		await expect(page.getByTestId('fixture-selection')).toHaveText('body:13')
		await expect(page.getByTestId('fixture-focus')).toHaveText('body:13')

		const first = await copiedView(page)
		expect(first.state).toMatchObject({
			version: 1,
			renderer: 'root',
			space: { slug: 'aurelia-fixture' },
			selected: 'body:13',
			focus: 'body:13',
			mode: 'plan',
			time: 12_345.5,
			labels: 'all',
			trails: 'full',
			visibility: 'markers',
			exposure: 'auto',
		})

		await page.goto(first.url)
		await expect(page.locator('[data-render-state="ready"]')).toBeVisible({ timeout: 15_000 })
		await expect(page.locator('[data-camera-projection="orthographic"]')).toBeVisible()
		await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveClass(/bg-accent-subtle/)
		await expect(page.getByRole('button', { name: 'Full', exact: true })).toHaveClass(/bg-accent-subtle/)
		await expect(page.getByRole('button', { name: 'Markers', exact: true })).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByTestId('fixture-day')).toContainText('12345.500')
		await expect(page.getByTestId('fixture-selection')).toHaveText('body:13')
		await expect(page.getByTestId('fixture-focus')).toHaveText('body:13')

		const second = await copiedView(page)
		expect(rounded(second.state)).toEqual(rounded(first.state))
	})

	test('round-trips a sector selection, focus, and camera pose', async ({ page }) => {
		await grantClipboard(page)
		await page.setViewportSize({ width: 1100, height: 850 })
		await page.goto('/test/rodder-sector-map?focus=glass-wake')
		await expect(page.locator('[data-render-state="ready"]')).toBeVisible({ timeout: 15_000 })
		await expect(page.getByTestId('fixture-sector-selection')).toHaveText('glass-wake')

		const canvas = page.locator('canvas')
		const box = await canvas.boundingBox()
		expect(box).not.toBeNull()
		await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.55)
		await page.mouse.down()
		await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.42, { steps: 8 })
		await page.mouse.up()

		const first = await copiedView(page)
		expect(first.state).toMatchObject({
			version: 1,
			renderer: 'sector',
			space: { slug: 'fixture-sector' },
			selected: 'glass-wake',
			focus: 'glass-wake',
		})
		expect(new URL(first.url).searchParams.has('focus')).toBe(false)

		await page.goto(first.url)
		await expect(page.locator('[data-render-state="ready"]')).toBeVisible({ timeout: 15_000 })
		await expect(page.getByTestId('fixture-sector-selection')).toHaveText('glass-wake')
		const second = await copiedView(page)
		expect(rounded(second.state)).toEqual(rounded(first.state))
	})
})
