/**
 * Screen-space HUD for the system map: distance legend, scale-mode label, and
 * off-screen body indicators. Browser-only (imports pixi.js).
 *
 * The HUD draws in the classic 800-unit square — the caller mounts it on a
 * container scaled to the actual canvas size — so every layout constant from
 * the canvas renderer ports verbatim.
 */
import { Container, Graphics, Text } from 'pixi.js'
import { SIZE, CENTER } from '../system-layout.js'
import type { ThemePalette } from '../system-layout.js'
import type { ScaleMode } from '../map-settings.js'
import { cssToTint } from './draw-helpers.js'

export const FONT_STACK = 'Work Sans, ui-sans-serif, system-ui, sans-serif'

const MODE_LABELS: Record<ScaleMode, string> = {
	log: 'Log scale',
	proportional: 'Linear scale',
	compact: 'Compact scale',
	inner: 'Inner system',
}

const NICE_AU_VALUES = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 50, 100]
const INDICATOR_MARGIN = 16

export type HudTarget = {
	name: string
	/** Screen position in 800-space HUD units. */
	x: number
	y: number
	alpha: number
}

export type HudState = {
	scale: ScaleMode
	/** Pixels (800-space) per AU at the current zoom; 0 disables the legend. */
	pxPerAu: number
	targets: HudTarget[]
	theme: ThemePalette
}

export type SystemMapHud = {
	update(state: HudState): void
	destroy(): void
}

export function createHud(parent: Container): SystemMapHud {
	const root = new Container()
	const legend = new Graphics()
	const legendText = new Text({
		text: '',
		style: { fontFamily: FONT_STACK, fontSize: 9, fontWeight: '400', fill: 0xFFFFFF },
	})
	legendText.anchor.set(0.5, 1)
	const modeText = new Text({
		text: '',
		style: { fontFamily: FONT_STACK, fontSize: 8, fontWeight: '400', fill: 0xFFFFFF },
	})
	modeText.anchor.set(1, 0)
	modeText.position.set(SIZE - 12, 12)
	modeText.alpha = 0.5
	const indicatorLayer = new Container()
	root.addChild(legend, legendText, modeText, indicatorLayer)
	parent.addChild(root)

	type Indicator = { triangle: Graphics, label: Text }
	const indicatorPool: Indicator[] = []

	function ensureIndicator(index: number): Indicator {
		let indicator = indicatorPool[index]
		if (!indicator) {
			const triangle = new Graphics()
			const label = new Text({
				text: '',
				style: { fontFamily: FONT_STACK, fontSize: 9, fontWeight: '500', fill: 0xFFFFFF },
			})
			label.anchor.set(0.5)
			indicatorLayer.addChild(triangle, label)
			indicator = { triangle, label }
			indicatorPool[index] = indicator
		}
		indicator.triangle.visible = true
		indicator.label.visible = true
		return indicator
	}

	function update(state: HudState): void {
		const faint = cssToTint(state.theme.faint).tint
		const secondary = cssToTint(state.theme.secondary).tint

		// Scale-mode label (top right)
		modeText.text = MODE_LABELS[state.scale]
		modeText.tint = faint

		// Distance legend (bottom left, linear modes only)
		legend.clear()
		legendText.visible = false
		if ((state.scale === 'proportional' || state.scale === 'inner') && state.pxPerAu > 0) {
			let bestAu = 1
			let bestBarPx = state.pxPerAu
			for (const value of NICE_AU_VALUES) {
				const barPx = value * state.pxPerAu
				if (barPx >= 40 && barPx <= 150) {
					bestAu = value
					bestBarPx = barPx
					break
				}
			}
			if (bestBarPx >= 20 && bestBarPx <= 200) {
				const x0 = 20
				const y0 = SIZE - 20
				const capHeight = 4
				legend
					.moveTo(x0, y0 - capHeight)
					.lineTo(x0, y0 + capHeight)
					.moveTo(x0, y0)
					.lineTo(x0 + bestBarPx, y0)
					.moveTo(x0 + bestBarPx, y0 - capHeight)
					.lineTo(x0 + bestBarPx, y0 + capHeight)
					.stroke({ width: 1, color: faint, alpha: 0.6 })
				legendText.text = `${bestAu} AU`
				legendText.tint = faint
				legendText.alpha = 0.6
				legendText.position.set(x0 + bestBarPx / 2, y0 - 6)
				legendText.visible = true
			}
		}

		// Off-screen body indicators: triangles clamped to the margins, pointing
		// away from the map center, with the body name pulled inward.
		let used = 0
		for (const target of state.targets) {
			const inView = target.x >= INDICATOR_MARGIN && target.x <= SIZE - INDICATOR_MARGIN
				&& target.y >= INDICATOR_MARGIN && target.y <= SIZE - INDICATOR_MARGIN
			if (inView) continue

			const angle = Math.atan2(target.y - CENTER, target.x - CENTER)
			const clampedX = Math.min(SIZE - INDICATOR_MARGIN, Math.max(INDICATOR_MARGIN, target.x))
			const clampedY = Math.min(SIZE - INDICATOR_MARGIN, Math.max(INDICATOR_MARGIN, target.y))
			const alpha = 0.85 * target.alpha

			const indicator = ensureIndicator(used)
			used += 1
			const triangleSize = 8
			indicator.triangle.clear()
			indicator.triangle
				.moveTo(triangleSize, 0)
				.lineTo(-triangleSize, -triangleSize * 0.6)
				.lineTo(-triangleSize, triangleSize * 0.6)
				.closePath()
				.fill(secondary)
			indicator.triangle.position.set(clampedX, clampedY)
			indicator.triangle.rotation = angle
			indicator.triangle.alpha = alpha

			indicator.label.text = target.name
			indicator.label.tint = secondary
			indicator.label.alpha = alpha
			indicator.label.position.set(
				clampedX - Math.cos(angle) * 18,
				clampedY - Math.sin(angle) * 18,
			)
		}
		for (let index = used; index < indicatorPool.length; index++) {
			indicatorPool[index].triangle.visible = false
			indicatorPool[index].label.visible = false
		}
	}

	function destroy(): void {
		root.destroy({ children: true })
	}

	return { update, destroy }
}
