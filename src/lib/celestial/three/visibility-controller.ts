import type { VisibilityMode } from '../map-settings.js'

export type VisibilityBodyKind = 'star' | 'body' | 'satellite'

export type VisibilityState = {
	markerActive: boolean
}

export type VisibilityResult = VisibilityState & {
	meshVisible: boolean
	markerDiameterPx: number
	markerOpacity: number
	glowOpacity: number
	pickRadiusPx: number
	screenExtentPx: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function smoothstep(edge0: number, edge1: number, value: number): number {
	const progress = clamp01((value - edge0) / (edge1 - edge0))
	return progress * progress * (3 - 2 * progress)
}

function markerDiameter(mode: VisibilityMode, kind: VisibilityBodyKind): number {
	if (mode === 'markers') {
		if (kind === 'star') return 16
		return kind === 'satellite' ? 10 : 13
	}
	if (kind === 'star') return 9
	return kind === 'satellite' ? 6 : 7
}

/**
 * Owns every screen-space minimum used by body presentation and picking.
 * Physical mesh scale is deliberately absent from the result: callers must
 * never resize physical geometry to satisfy a visibility mode.
 */
export function resolveBodyVisibility(args: {
	mode: VisibilityMode
	kind: VisibilityBodyKind
	projectedRadiusPx: number
	previous: VisibilityState
}): VisibilityResult {
	const projectedRadiusPx = Math.max(0, args.projectedRadiusPx)
	const diameterPx = markerDiameter(args.mode, args.kind)

	if (args.mode === 'physical') {
		return {
			markerActive: false,
			meshVisible: true,
			markerDiameterPx: diameterPx,
			markerOpacity: 0,
			glowOpacity: 0,
			pickRadiusPx: projectedRadiusPx,
			screenExtentPx: projectedRadiusPx,
		}
	}

	const fadeStart = diameterPx * (args.mode === 'markers' ? 0.42 : 0.36)
	const fadeEnd = diameterPx * (args.mode === 'markers' ? 0.82 : 0.72)
	// The activation band extends beyond the visible fade. This keeps a marker
	// from toggling on and off when camera damping settles at the threshold.
	const enterAt = fadeEnd - 0.25
	const exitAt = fadeEnd + 0.25
	const markerActive = args.previous.markerActive
		? projectedRadiusPx < exitAt
		: projectedRadiusPx < enterAt
	const fade = 1 - smoothstep(fadeStart, fadeEnd, projectedRadiusPx)
	const markerOpacity = markerActive ? fade * (args.mode === 'markers' ? 1 : 0.82) : 0
	const markerRadiusPx = markerOpacity > 0.02 ? diameterPx / 2 : 0
	const minimumPickPx = args.mode === 'markers' ? Math.max(8, diameterPx / 2 + 3) : 8

	return {
		markerActive,
		meshVisible: args.mode !== 'markers' || projectedRadiusPx >= 0.75,
		markerDiameterPx: diameterPx,
		markerOpacity,
		glowOpacity: args.kind === 'star' ? (args.mode === 'enhanced' ? 0.44 : 0.2) : 0,
		pickRadiusPx: Math.max(minimumPickPx, projectedRadiusPx + 3),
		screenExtentPx: Math.max(projectedRadiusPx, markerRadiusPx),
	}
}
