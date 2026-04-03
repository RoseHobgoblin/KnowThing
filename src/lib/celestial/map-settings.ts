export type ScaleMode = 'all' | 'inner'
export type LabelMode = 'off' | 'hovered' | 'major' | 'all'
export type TrailMode = 'off' | 'short' | 'full'

export interface MapSettings {
	scale: ScaleMode
	labels: LabelMode
	trails: TrailMode
	follow: boolean
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
	scale: 'all',
	labels: 'major',
	trails: 'off',
	follow: false,
}
