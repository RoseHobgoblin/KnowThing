import { describe, expect, it } from 'vitest'
import type { TemplateArg } from '$lib/parser/types.js'
import { buildApparentSky } from './public/apparent-sky.js'
import { resolveRootMapEmbedConfiguration, resolveSectorMapEmbedConfiguration } from './public/embed-config.js'
import type { MapBody } from './public/root-layout.js'
import { encodeRodderViewState, type RootViewState } from './public/view-state.js'

const stars: MapBody[] = [{ id: 1, name: 'Primary', slug: 'primary', bodyType: 'star', isStar: true }]
const bodies: MapBody[] = [{ id: 2, name: 'World', slug: 'world', bodyType: 'planet', semiMajorAxisAu: 1 }]
const sky = buildApparentSky(null, [])

function args(values: Array<[string | null, string]>): TemplateArg[] {
	return values.map(([name, value]) => ({ name, value }))
}

describe('Rodder embed configuration', () => {
	it('uses a chrome-free locked policy by default', () => {
		const config = resolveRootMapEmbedConfiguration([], 'root', stars, bodies, sky)
		expect(config.interaction).toMatchObject({
			cameraMovement: false,
			displayChanges: false,
			selectionInspection: false,
			hoverInspection: true,
			controlsVisible: false,
			objectNavigation: true,
		})
	})

	it('applies presets and independent capability overrides', () => {
		const config = resolveRootMapEmbedConfiguration(args([
			['interaction', 'explore'],
			['camera', 'off'],
			['controls', 'hide'],
			['selection', 'off'],
		]), 'root', stars, bodies, sky)
		expect(config.interaction).toMatchObject({ cameraMovement: false, controlsVisible: false, selectionInspection: false, hoverInspection: true })
		expect(config.errors).toEqual([])
	})

	it('parses animation speed independently from time and chrome policy', () => {
		const config = resolveRootMapEmbedConfiguration(args([
			['interaction', 'locked'],
			['time', 'on'],
			['controls', 'hide'],
			['speed', '250'],
		]), 'root', stars, bodies, sky)
		expect(config.interaction).toMatchObject({ timeMovement: true, controlsVisible: false })
		expect(config.playbackRate).toBe(250)
		expect(config.errors).toEqual([])
	})

	it('seeds from copied view state and lets readable arguments override it', () => {
		const state: RootViewState = {
			version: 1,
			renderer: 'root',
			space: { slug: 'root' },
			selected: 'body:2',
			focus: 'body:2',
			camera: { projection: 'perspective', target: [0, 0, 0], direction: [1, 1, 1], distance: 20, zoom: 1, fieldOfView: 50 },
			mode: 'orrery',
			time: 42,
			labels: 'all',
			skyLabels: 'hovered',
			trails: 'full',
			visibility: 'markers',
			exposure: 'auto',
			scale: 'log',
			follow: true,
		}
		const config = resolveRootMapEmbedConfiguration(args([
			['view', encodeURIComponent(encodeRodderViewState(state))],
			['labels', 'major'],
			['focus', 'primary'],
		]), 'root', stars, bodies, sky)
		expect(config).toMatchObject({ labels: 'major', focus: 'star:1', selected: 'body:2', day: 42, follow: true })
		expect(config.camera).toEqual(state.camera)
	})

	it('reports invalid arguments locally while retaining defaults', () => {
		const config = resolveRootMapEmbedConfiguration(args([
			['aspect', '99:1'],
			['mode', 'galaxy'],
			['focus', 'missing'],
			['speed', 'instant'],
		]), 'root', stars, bodies, sky)
		expect(config.aspectRatio).toBe(16 / 9)
		expect(config.mode).toBe('orrery')
		expect(config.errors.map(error => error.argument)).toEqual(['mode', 'speed', 'focus', 'aspect'])
	})

	it('resolves sector focus and selection case-insensitively', () => {
		const config = resolveSectorMapEmbedConfiguration(args([
			['focus', 'ORISON-FOLD'],
			['selected', 'other-root'],
		]), 'reach', ['orison-fold', 'other-root'])
		expect(config.focus).toBe('orison-fold')
		expect(config.selected).toBe('other-root')
	})
})
