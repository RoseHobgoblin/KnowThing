/**
 * Pixi drawing helpers for the system map. Browser-only (imports pixi.js) —
 * must never be reached from server-side module graphs.
 *
 * Ellipse paths are drawn in the Graphics' local space, centered on the
 * ellipse center with no rotation: the owning Container carries the world
 * position and apsidal rotation, so orbit geometry never has to be rebuilt
 * when only the camera or selection changes.
 */
import { Color, Texture } from 'pixi.js'
import type { Graphics } from 'pixi.js'

/** Ramanujan's approximation — good to ~1e-4 for orbit-like eccentricities. */
export function ellipseCircumference(a: number, b: number): number {
	const h = ((a - b) / (a + b)) ** 2
	return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

/**
 * Append a dashed ellipse outline (centered at the local origin) to `g`.
 * Pixi Graphics has no line-dash support, so dashes are laid out by walking
 * the perimeter and toggling pen state on accumulated arc length. Pass
 * dash/gap already divided by the current zoom to keep them screen-sized.
 */
export function dashedEllipsePath(g: Graphics, a: number, b: number, dash = 4, gap = 3): void {
	const circumference = ellipseCircumference(a, b)
	if (circumference <= 0 || dash <= 0) return
	const steps = Math.min(1024, Math.max(64, Math.ceil(circumference / Math.max(1, Math.min(dash, gap) / 2))))
	const period = dash + gap

	let previousX = a
	let previousY = 0
	let traveled = 0
	let penDown = false

	for (let index = 1; index <= steps; index++) {
		const t = (index / steps) * Math.PI * 2
		const x = a * Math.cos(t)
		const y = b * Math.sin(t)
		traveled += Math.hypot(x - previousX, y - previousY)
		const inDash = traveled % period < dash
		if (inDash) {
			if (!penDown) {
				g.moveTo(previousX, previousY)
				penDown = true
			}
			g.lineTo(x, y)
		} else {
			penDown = false
		}
		previousX = x
		previousY = y
	}
}

/**
 * Append a trailing arc behind a body at eccentric anomaly `angle`, matching
 * the canvas renderer's short trail: `span` radians swept backwards.
 */
export function trailPath(g: Graphics, a: number, b: number, angle: number, span = Math.PI * 0.5, steps = 32): void {
	for (let index = 0; index <= steps; index += 1) {
		const theta = angle - (index / steps) * span
		const x = a * Math.cos(theta)
		const y = b * Math.sin(theta)
		if (index === 0) g.moveTo(x, y)
		else g.lineTo(x, y)
	}
}

/**
 * A white radial-gradient disc texture for glow sprites: tint it per star and
 * scale it per use. `stops` are [offset, alpha] pairs, offset 0 at the center.
 * Built via an offscreen 2D canvas — one texture is shared by every glow.
 */
export function makeRadialGlowTexture(size: number, stops: Array<[number, number]>): Texture {
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')!
	const half = size / 2
	const gradient = context.createRadialGradient(half, half, 0, half, half, half)
	for (const [offset, alpha] of stops) {
		gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`)
	}
	context.fillStyle = gradient
	context.fillRect(0, 0, size, size)
	return Texture.from(canvas)
}

/**
 * Convert a CSS color string (hex, named, rgb/rgba — everything resolveColor
 * and colorWithAlpha emit) into a Pixi tint + alpha pair.
 */
export function cssToTint(css: string): { tint: number, alpha: number } {
	const color = new Color(css)
	return { tint: color.toNumber(), alpha: color.alpha }
}
