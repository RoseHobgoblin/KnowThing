/* global Cesium, maplibregl */

import { worlds } from './fixtures.js'

const viewerHost = document.querySelector('#viewer')
const status = document.querySelector('#status')
const handoffOutput = document.querySelector('#handoff')
const worldSelect = document.querySelector('#world')
let engine = 'cesium'
let disposeViewer = () => {}
let selectedFeatureId = null

const handoff = {
	bodyId: worlds.mars.bodyId,
	absoluteDay: 57.625,
	selectedFeatureId,
	incomingDirection: [0.41, -0.73, 0.55],
	returnCamera: { target: [0, 0, 0], position: [212, -378, 286], projection: 'perspective' },
}

function publishHandoff() {
	handoff.bodyId = worlds[worldSelect.value].bodyId
	handoff.selectedFeatureId = selectedFeatureId
	handoffOutput.value = JSON.stringify(handoff)
	handoffOutput.textContent = JSON.stringify(handoff)
}

function featureName(world, id) {
	return world.features.features.find(feature => String(feature.id) === String(id))?.properties?.name ?? String(id)
}

function mountMapLibre(world) {
	const map = new maplibregl.Map({
		container: viewerHost,
		center: world.center,
		zoom: 1.4,
		attributionControl: false,
		style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#05070b' } }] },
	})
	map.on('load', () => {
		map.setProjection({ type: 'globe' })
		map.addSource('fixture', { type: 'geojson', data: world.features })
		map.addLayer({ id: 'areas', type: 'fill', source: 'fixture', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#b68b45', 'fill-opacity': 0.45 } })
		map.addLayer({ id: 'points', type: 'circle', source: 'fixture', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#ffe18a' } })
		status.textContent = `${world.name} · MapLibre · Earth-radius globe limitation recorded`
	})
	map.on('click', (event) => {
		const hit = map.queryRenderedFeatures(event.point, { layers: ['areas', 'points'] })[0]
		selectedFeatureId = hit?.id ?? null
		status.textContent = selectedFeatureId == null ? `${world.name} · no selection` : `Selected ${featureName(world, selectedFeatureId)}`
		publishHandoff()
	})
	return () => map.remove()
}

function cartesianFor(ellipsoid, coordinates, height = 0) {
	return Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], height, ellipsoid)
}

function mountCesium(world) {
	const ellipsoid = new Cesium.Ellipsoid(...world.radiiM)
	const globe = new Cesium.Globe(ellipsoid)
	globe.baseColor = Cesium.Color.fromCssColorString('#6c4b32')
	const viewer = new Cesium.Viewer(viewerHost, {
		globe,
		baseLayer: false,
		animation: false, timeline: false, geocoder: false, homeButton: false,
		sceneModePicker: true, baseLayerPicker: false, navigationHelpButton: false,
		fullscreenButton: false, infoBox: false, selectionIndicator: true,
	})
	for (const feature of world.features.features) {
		if (feature.geometry.type === 'Point') {
			viewer.entities.add({ id: String(feature.id), name: feature.properties.name, position: cartesianFor(ellipsoid, feature.geometry.coordinates), point: { pixelSize: 10, color: Cesium.Color.KHAKI } })
		}
	}
	viewer.camera.flyTo({ destination: cartesianFor(ellipsoid, world.center, world.radiiM[0] * 2.2), duration: 0 })
	const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
	handler.setInputAction((event) => {
		const picked = viewer.scene.pick(event.position)
		selectedFeatureId = picked?.id?.id ?? null
		status.textContent = selectedFeatureId == null ? `${world.name} · no selection` : `Selected ${featureName(world, selectedFeatureId)}`
		publishHandoff()
	}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
	status.textContent = `${world.name} · Cesium · custom ellipsoid ${world.radiiM.join(' × ')} m`
	return () => {
		handler.destroy()
		viewer.destroy()
	}
}

function mount() {
	disposeViewer()
	viewerHost.replaceChildren()
	selectedFeatureId = null
	const world = worlds[worldSelect.value]
	const started = performance.now()
	disposeViewer = engine === 'cesium' ? mountCesium(world) : mountMapLibre(world)
	requestAnimationFrame(() => {
		viewerHost.dataset.engine = engine
		viewerHost.dataset.world = worldSelect.value
		viewerHost.dataset.loadMs = String(Math.round(performance.now() - started))
		publishHandoff()
	})
}

for (const nextEngine of ['cesium', 'maplibre']) {
	document.querySelector(`#${nextEngine}`).addEventListener('click', (event) => {
		engine = nextEngine
		for (const button of document.querySelectorAll('header button[aria-pressed]')) button.setAttribute('aria-pressed', String(button === event.currentTarget))
		mount()
	})
}
worldSelect.addEventListener('change', mount)
document.querySelector('#return').addEventListener('click', () => {
	publishHandoff()
	status.textContent = 'Return state captured; no application navigation occurs in this isolated spike.'
})
addEventListener('beforeunload', () => disposeViewer())
mount()
