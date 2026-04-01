export type ScaleMode = 'realistic' | 'compressed' | 'logarithmic'
export type LabelMode = 'off' | 'hovered' | 'major' | 'all'
export type TrailMode = 'off' | 'short' | 'full'
export type CenterTarget = 'system' | 'star' | 'selection'

export interface MapSettings {
	scale: ScaleMode
	labels: LabelMode
	trails: TrailMode
	centerOn: CenterTarget
	followSelection: boolean
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
	scale: 'compressed',
	labels: 'major',
	trails: 'off',
	centerOn: 'system',
	followSelection: false,
}
