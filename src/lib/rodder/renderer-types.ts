import type { LabelMode, ScaleMode, TrailMode, ViewMode, VisibilityMode } from './map-settings.js'
import type { EntityKey, MapBody, ThemePalette } from './root-layout.js'
import type { ApparentSkyResult, ApparentSkySource, RootSelectionKey } from './apparent-sky.js'
import type { RootCameraState } from './view-state.js'

export type MapSettingsState = {
	scale: ScaleMode
	labels: LabelMode
	skyLabels: LabelMode
	trails: TrailMode
	follow: boolean
	view: ViewMode
	visibility: VisibilityMode
}

export type ProjectedLabel = {
	key: RootSelectionKey
	name: string
	x: number
	y: number
	anchorX: number
	anchorY: number
	selected: boolean
	major: boolean
	pillar?: { x: number, fromY: number, toY: number }
}

export type OffscreenIndicator = {
	key: RootSelectionKey
	name: string
	x: number
	y: number
	angle: number
}

export type OverlaySnapshot = {
	labels: ProjectedLabel[]
	indicators: OffscreenIndicator[]
	legend: { pixels: number, label: string } | null
	projection: 'orthographic' | 'perspective' | null
	status: 'initializing' | 'ready' | 'unavailable'
}

export type MapRendererCallbacks = {
	/** Hover state for the DOM tooltip; position is CSS px within the canvas. */
	onHover: (target: { kind: 'local', body: MapBody } | { kind: 'sky', source: ApparentSkySource } | null, position: { x: number, y: number } | null) => void
	onSelect: (id: RootSelectionKey | null) => void
	onFocusChange: (id: EntityKey | null) => void
	onActivateSkySource: (rootSlug: string) => void
	onViewChange: (view: { zoomLevel: number, isMoved: boolean }) => void
	onOverlayChange?: (snapshot: OverlaySnapshot) => void
	onUnavailable?: (reason: string) => void
}

export type RootMapRenderer = {
	setData(stars: MapBody[], bodies: MapBody[], apparentSky: ApparentSkyResult): void
	setDay(day: number | null): void
	setSettings(settings: MapSettingsState): void
	setSelected(id: RootSelectionKey | null): void
	setTheme(theme: ThemePalette): void
	resize(width: number, height: number): void
	resetView(): void
	getCameraState(): RootCameraState | null
	setCameraState(state: RootCameraState): void
	destroy(): void
	readonly canvas: HTMLCanvasElement
}
