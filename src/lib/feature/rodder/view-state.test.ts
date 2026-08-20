import { describe, expect, it } from 'vitest'
import {
	decodeRodderViewState,
	defaultRootCameraState,
	encodeRodderViewState,
	rodderViewUrl,
	rootViewStateFor,
	sectorViewStateFor,
	type RootViewState,
	type SectorViewState,
} from './view-state.js'

const rootState: RootViewState = {
	version: 1,
	renderer: 'root',
	space: { slug: 'orison-fold' },
	selected: 'body:13',
	focus: 'body:13',
	camera: {
		projection: 'perspective',
		target: [1.25, -2.5, 0.75],
		direction: [0.4, -0.7, 0.59],
		distance: 42,
		zoom: 3.5,
		fieldOfView: 50,
	},
	mode: 'orrery',
	time: 12_345.25,
	labels: 'all',
	skyLabels: 'hovered',
	trails: 'full',
	visibility: 'markers',
	exposure: 'auto',
	scale: 'log',
	follow: true,
}

const sectorState: SectorViewState = {
	version: 1,
	renderer: 'sector',
	space: { slug: 'palimpsest-reach' },
	selected: 'orison-fold',
	focus: 'orison-fold',
	camera: {
		position: [12, -8, 5],
		target: [2, 1, 0],
		fieldOfView: 50,
	},
}

describe('Rodder view links', () => {
	it('provides schema-valid fallback cameras before a renderer is ready', () => {
		for (const mode of ['plan', 'orrery'] as const) {
			const fallback = { ...rootState, mode, camera: defaultRootCameraState(mode) }
			expect(decodeRodderViewState(JSON.stringify(fallback))).toEqual(fallback)
		}
	})

	it('round-trips a complete root composition', () => {
		const encoded = encodeRodderViewState(rootState)
		expect(decodeRodderViewState(encoded)).toEqual(rootState)
		expect(rootViewStateFor(encoded, 'orison-fold', {
			selected: new Set(['body:13']),
			focus: new Set(['body:13']),
		})).toEqual(rootState)
	})

	it('accepts legacy version-1 root links without a separate sky-label option', () => {
		const { skyLabels: _skyLabels, ...legacyState } = rootState
		const encoded = JSON.stringify(legacyState)
		expect(decodeRodderViewState(encoded)).toEqual(legacyState)
	})

	it('round-trips a complete sector composition', () => {
		const url = rodderViewUrl('https://example.test/rodder/sector/palimpsest-reach?focus=old#map', sectorState)
		expect(url.searchParams.has('focus')).toBe(false)
		expect(url.hash).toBe('#map')
		expect(sectorViewStateFor(url.searchParams.get('view'), 'palimpsest-reach', new Set(['orison-fold']))).toEqual(sectorState)
	})

	it.each([
		'not json',
		JSON.stringify({ ...rootState, version: 0 }),
		JSON.stringify({ ...rootState, camera: { ...rootState.camera, distance: Number.NaN } }),
		JSON.stringify({ ...rootState, mode: 'plan' }),
		JSON.stringify({ ...rootState, exposure: 'fixed' }),
	])('safely ignores invalid or obsolete state: %s', (raw) => {
		expect(decodeRodderViewState(raw)).toBeNull()
	})

	it('rejects state for another space or missing object identity', () => {
		const encoded = encodeRodderViewState(rootState)
		expect(rootViewStateFor(encoded, 'another-root')).toBeNull()
		expect(rootViewStateFor(encoded, 'orison-fold', {
			selected: new Set(['star:1']),
			focus: new Set(['star:1']),
		})).toBeNull()
	})

	it('restores a remote sky selection without allowing it as a focus or follow target', () => {
		const skyState: RootViewState = { ...rootState, selected: 'sky-root:42', focus: null, follow: false }
		const encoded = encodeRodderViewState(skyState)
		expect(rootViewStateFor(encoded, 'orison-fold', {
			selected: new Set(['sky-root:42']),
			focus: new Set(['body:13']),
		})).toEqual(skyState)
		expect(decodeRodderViewState(JSON.stringify({ ...skyState, focus: 'sky-root:42' }))).toBeNull()
		expect(decodeRodderViewState(JSON.stringify({ ...skyState, follow: true }))).toBeNull()
	})
})
