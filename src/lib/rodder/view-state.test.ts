import { describe, expect, it } from 'vitest'
import {
	decodeRodderViewState,
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
	it('round-trips a complete root composition', () => {
		const encoded = encodeRodderViewState(rootState)
		expect(decodeRodderViewState(encoded)).toEqual(rootState)
		expect(rootViewStateFor(encoded, 'orison-fold', new Set(['body:13']))).toEqual(rootState)
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
		expect(rootViewStateFor(encoded, 'orison-fold', new Set(['star:1']))).toBeNull()
	})
})
