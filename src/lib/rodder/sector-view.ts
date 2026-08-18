/**
 * Renderer-agnostic helpers for the read-only sector view.
 *
 * A sector root is displayed only when it has a complete position triple in
 * the sector frame; anything else is listed as "position unavailable" rather
 * than being invented a location. All distances are in the sector's declared
 * units (light-years or parsecs) — never AU, never renderer units.
 */

import type { SectorCameraState } from './view-state.js'
export type { SectorCameraState } from './view-state.js'

export interface SectorRootView {
	rootId: number
	bodyId: number
	name: string
	slug: string
	kind: string
	x: number | null
	y: number | null
	z: number | null
	positionProvenance: string
	positionUncertainty: number | null
	distanceLy: number | null
	starCount: number
	planetCount: number
}

export interface PositionedSectorRoot extends SectorRootView {
	x: number
	y: number
	z: number
}

export function hasSectorPosition(root: SectorRootView): root is PositionedSectorRoot {
	return root.x != null && root.y != null && root.z != null
}

export function positionedRoots(roots: SectorRootView[]): PositionedSectorRoot[] {
	return roots.filter(hasSectorPosition)
}

export function unpositionedRoots(roots: SectorRootView[]): SectorRootView[] {
	return roots.filter(root => !hasSectorPosition(root))
}

/**
 * Radius of the smallest origin-centred sphere containing every positioned
 * root, floored so an empty or single-origin-root sector still frames sanely.
 */
export function sectorBoundsRadius(roots: SectorRootView[], minimum = 1): number {
	let max = 0
	for (const root of positionedRoots(roots)) {
		max = Math.max(max, Math.hypot(root.x, root.y, root.z))
	}
	return Math.max(max, minimum)
}

export function sectorDistance(a: PositionedSectorRoot, b: PositionedSectorRoot): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function unitsLabel(units: string): string {
	if (units === 'pc') return 'parsecs'
	return 'light-years'
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function formatSectorPosition(root: SectorRootView, units: string): string | null {
	if (!hasSectorPosition(root)) return null
	return `(${fmt(root.x)}, ${fmt(root.y)}, ${fmt(root.z)}) ${units}`
}

export function formatSectorDistance(value: number, units: string): string {
	return `${fmt(value)} ${units}`
}

/**
 * A grid spacing that keeps 4–10 lines across the sector bounds, snapped to a
 * 1/2/5 decade so the legend reads as a round number of sector units.
 */
export function sectorGridSpacing(boundsRadius: number): number {
	const target = boundsRadius / 4
	const decade = 10 ** Math.floor(Math.log10(Math.max(target, Number.MIN_VALUE)))
	for (const step of [1, 2, 5]) {
		if (target <= step * decade) return step * decade
	}
	return 10 * decade
}

// ---------------------------------------------------------------------------
// Renderer contract (mirrors renderer-types.ts for the root map).
// ---------------------------------------------------------------------------

export interface SectorOverlayLabel {
	slug: string
	name: string
	x: number
	y: number
	selected: boolean
}

export interface SectorOverlaySnapshot {
	labels: SectorOverlayLabel[]
	legend: { pixels: number, label: string } | null
	status: 'initializing' | 'ready' | 'unavailable'
}

export type SectorRendererCallbacks = {
	/** Hover state for the DOM tooltip; position is CSS px within the canvas. */
	onHover: (root: PositionedSectorRoot | null, position: { x: number, y: number } | null) => void
	onSelect: (slug: string | null) => void
	/** Double-click on a root — the "enter this system" gesture. */
	onActivate: (slug: string) => void
	onOverlayChange?: (snapshot: SectorOverlaySnapshot) => void
	onUnavailable?: (reason: string) => void
}

export type SectorRenderer = {
	setData(roots: SectorRootView[], units: string): void
	setSelected(slug: string | null): void
	setTheme(theme: { page: string, surface: string, accent: string, accentLight: string, secondary: string, dim: string, heading: string, faint: string }): void
	resize(width: number, height: number): void
	resetView(): void
	/** Centre the camera on a root without changing its viewing direction. */
	focusRoot(slug: string): void
	getCameraState(): SectorCameraState | null
	setCameraState(state: SectorCameraState): void
	destroy(): void
	readonly canvas: HTMLCanvasElement
}
