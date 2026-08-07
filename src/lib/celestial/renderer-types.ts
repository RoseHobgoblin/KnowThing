import type { LabelMode, ScaleMode, TrailMode, ViewMode, VisibilityMode } from './map-settings.js'
import type { EntityKey, MapBody, ThemePalette } from './system-layout.js'

export type MapSettingsState = {
	scale: ScaleMode
	labels: LabelMode
	trails: TrailMode
	follow: boolean
	view: ViewMode
	visibility: VisibilityMode
}

export type ProjectedLabel = {
	key: EntityKey
	name: string
	x: number
	y: number
	anchorX: number
	anchorY: number
	selected: boolean
	major: boolean
}

export type OffscreenIndicator = {
	key: EntityKey
	name: string
	x: number
	y: number
	angle: number
}

export type OverlaySnapshot = {
	labels: ProjectedLabel[]
	indicators: OffscreenIndicator[]
	scaleLabel: string
	legend: { pixels: number, label: string } | null
	modeLabel: string
	projection: 'orthographic' | 'perspective' | null
	status: 'initializing' | 'ready' | 'unavailable'
}

export type MapRendererCallbacks = {
	/** Hover state for the DOM tooltip; position is CSS px within the canvas. */
	onHover: (body: MapBody | null, position: { x: number, y: number } | null) => void
	onSelect: (id: EntityKey | null) => void
	onViewChange: (view: { zoomLevel: number, isMoved: boolean }) => void
	onOverlayChange?: (snapshot: OverlaySnapshot) => void
	onUnavailable?: (reason: string) => void
}

export type SystemMapRenderer = {
	setData(stars: MapBody[], bodies: MapBody[]): void
	setDay(day: number | null): void
	setSettings(settings: MapSettingsState): void
	setSelected(id: EntityKey | null): void
	setTheme(theme: ThemePalette): void
	resize(width: number, height: number): void
	resetView(): void
	destroy(): void
	readonly canvas: HTMLCanvasElement
}
