<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { page } from '$app/stores'
	import MapControls from '$lib/feature/rodder/public/ui/MapControls.svelte'
	import RootMap from '$lib/feature/rodder/public/ui/RootMap.svelte'
	import CopyViewLink from '$lib/feature/rodder/public/ui/CopyViewLink.svelte'
	import { DEFAULT_MAP_SETTINGS } from '$lib/feature/rodder/public/map-settings.js'
	import type { EntityKey, MapBody } from '$lib/feature/rodder/public/root-layout.js'
	import { buildApparentSky, type RootSelectionKey } from '$lib/feature/rodder/public/apparent-sky.js'
	import {
		RODDER_VIEW_QUERY_PARAM,
		rootViewStateFor,
		type RootCameraState,
		type RootViewState,
	} from '$lib/feature/rodder/public/view-state.js'

	const stars: MapBody[] = [{
		id: 1, name: 'Aurelia', slug: 'aurelia', bodyType: 'star', massKg: 1.989e30,
		radiusM: 695_700_000, spectralType: 'G2V', color: 'yellow-white',
		rotationPeriodS: 2_160_000, axialTilt: 7.25, temperatureK: 5772, luminosityW: 3.828e26,
	}]
	const additionalBodies: MapBody[] = Array.from({ length: 9 }, (_, index) => ({
		id: 20 + index,
		name: `Survey ${index + 1}`,
		slug: `survey-${index + 1}`,
		bodyType: 'dwarf planet',
		starId: 1,
		semiMajorAxisAu: 6.5 + index * 2.2,
		eccentricity: 0.03 + index * 0.012,
		inclination: 8 + index * 4,
		longitudeAscendingNode: 18 + index * 31,
		argumentOfPeriapsis: 27 + index * 23,
		orbitalPeriodDays: 6_000 + index * 1_700,
		epochPhase: (index * 0.091) % 1,
		effectivePeriodSource: 'stored',
		radiusM: 420_000 + index * 45_000,
		color: 'grey',
	}))
	const bodies: MapBody[] = [
		{
			id: 10, name: 'Cinder', slug: 'cinder', bodyType: 'terrestrial', starId: 1,
			semiMajorAxisAu: 0.42, eccentricity: 0.12, inclination: 4,
			longitudeAscendingNode: 24, argumentOfPeriapsis: 68, orbitalPeriodDays: 99,
			epochPhase: 0.18, effectivePeriodSource: 'stored', radiusM: 4_900_000,
			rotationPeriodS: 78_000, axialTilt: 11, color: 'orange-red',
		},
		{
			id: 11, name: 'Pelagos', slug: 'pelagos', bodyType: 'ocean', starId: 1,
			semiMajorAxisAu: 1.1, eccentricity: 0.04, inclination: 18,
			longitudeAscendingNode: 47, argumentOfPeriapsis: 15, orbitalPeriodDays: 421,
			epochPhase: 0.36, effectivePeriodSource: 'derived', radiusM: 7_100_000,
			rotationPeriodS: 91_000, axialTilt: 27, color: 'blue', moonCount: 1,
		},
		{
			id: 12, name: 'Nacre', slug: 'nacre', bodyType: 'moon', starId: 1, parentId: 11,
			semiMajorAxisAu: 0.0028, eccentricity: 0.07, inclination: 31,
			longitudeAscendingNode: 110, argumentOfPeriapsis: 42, orbitalPeriodDays: 28,
			epochPhase: 0.1, effectivePeriodSource: 'stored', radiusM: 1_850_000,
			rotationPeriodS: 2_419_200, axialTilt: 6, color: 'white',
		},
		{
			id: 13, name: 'Brontes', slug: 'brontes', bodyType: 'gas giant', starId: 1,
			semiMajorAxisAu: 5.4, eccentricity: 0.19, inclination: 39,
			longitudeAscendingNode: 205, argumentOfPeriapsis: 124, orbitalPeriodDays: 4_580,
			epochPhase: 0.66, effectivePeriodSource: 'stored', radiusM: 62_000_000,
			rotationPeriodS: 38_000, axialTilt: 19, color: 'pale yellow',
			ringSystems: [{
				id: 130, name: 'Brontes ring system', slug: 'brontes-rings',
				ringSystem: {
					schemaVersion: 1, plane: 'parent-equatorial', origin: 'tidal-disruption',
					bands: [
						{ name: 'Broad band', innerRadiusM: 82_000_000, outerRadiusM: 104_000_000, color: '#d8c79a', opacity: 0.3, provenance: 'authored' },
						{ name: 'Narrow band', innerRadiusM: 112_000_000, outerRadiusM: 118_000_000, color: '#eee1bb', opacity: 0.48, provenance: 'authored' },
					],
				},
			}],
		},
		{
			id: 14, name: 'Far Lantern', slug: 'far-lantern', bodyType: 'dwarf planet', starId: 1,
			semiMajorAxisAu: 28, eccentricity: 0.32, inclination: 57,
			longitudeAscendingNode: 310, argumentOfPeriapsis: 211, epochPhase: 0.42,
			effectivePeriodSource: 'unavailable', radiusM: 950_000, color: 'white',
		},
		...additionalBodies,
	]
	const apparentSky = buildApparentSky({
		rootId: 100, sectorId: 1, sectorName: 'Fixture Reach', sectorSlug: 'fixture-reach',
		units: 'ly', handedness: 'right-handed', referenceEpoch: 'Static fixture epoch', x: 0, y: 0, z: 0,
	}, [
		{
			rootId: 101, rootName: 'Glasswake', rootSlug: 'glasswake', rootKind: 'system',
			x: 8.4, y: -3.2, z: 1.1, positionProvenance: 'authored', positionUncertainty: 0.03,
			stars: [{ id: 1011, name: 'Aster Vale', slug: 'aster-vale', spectralType: 'F8V', temperatureK: 6200, luminosityW: 6.508e26, radiusM: 8.07e8, absoluteMagnitude: null }],
		},
		{
			rootId: 102, rootName: 'Vey\'s Anvil', rootSlug: 'veys-anvil', rootKind: 'system',
			x: -11.6, y: 4.7, z: -2.9, positionProvenance: 'authored', positionUncertainty: 0.05,
			stars: [
				{ id: 1021, name: 'Vey', slug: 'vey', spectralType: 'K1III', temperatureK: 4600, luminosityW: 1.225e28, radiusM: 5.9135e9, absoluteMagnitude: null },
				{ id: 1022, name: 'Clinker', slug: 'clinker', spectralType: 'DA3', temperatureK: 15500, luminosityW: 1.1484e24, radiusM: 8.6267e6, absoluteMagnitude: null },
			],
		},
	])

	let scale = $state(DEFAULT_MAP_SETTINGS.scale)
	let labels = $state(DEFAULT_MAP_SETTINGS.labels)
	let skyLabels = $state(DEFAULT_MAP_SETTINGS.skyLabels)
	let trails = $state(DEFAULT_MAP_SETTINGS.trails)
	let follow = $state(DEFAULT_MAP_SETTINGS.follow)
	let view = $state(DEFAULT_MAP_SETTINGS.view)
	let visibility = $state(DEFAULT_MAP_SETTINGS.visibility)
	let selectedId = $state<RootSelectionKey | null>(null)
	let focusId = $state<EntityKey | null>(null)
	let initialCameraState = $state<RootCameraState | null>(null)
	let rootMap = $state<{ getCameraState(): RootCameraState | null } | null>(null)
	let currentAbsoluteDay = $state(12_345.25)
	let playing = $state(false)
	const entityKeys = new Set<EntityKey>([
		...stars.map(star => `star:${star.id}` as const),
		...bodies.map(body => `body:${body.id}` as const),
	])
	const ringSystemKeys = bodies.flatMap(body => body.ringSystems?.map(system => `body:${system.id}` as const) ?? [])
	const linkedViewState = $derived(rootViewStateFor(
		$page.url.searchParams.get(RODDER_VIEW_QUERY_PARAM),
		'aurelia-fixture',
		{
			selected: new Set<RootSelectionKey>([...entityKeys, ...ringSystemKeys, ...apparentSky.sources.map(source => source.key)]),
			focus: entityKeys,
		},
	))

	$effect(() => {
		const state = linkedViewState
		untrack(() => {
			scale = state?.scale ?? DEFAULT_MAP_SETTINGS.scale
			labels = state?.labels ?? DEFAULT_MAP_SETTINGS.labels
			skyLabels = state?.skyLabels ?? DEFAULT_MAP_SETTINGS.skyLabels
			trails = state?.trails ?? DEFAULT_MAP_SETTINGS.trails
			follow = state?.follow ?? DEFAULT_MAP_SETTINGS.follow
			view = state?.mode ?? DEFAULT_MAP_SETTINGS.view
			visibility = state?.visibility ?? DEFAULT_MAP_SETTINGS.visibility
			selectedId = state?.selected ?? null
			focusId = state?.focus ?? null
			currentAbsoluteDay = state?.time ?? 12_345.25
			initialCameraState = state?.camera ?? null
		})
	})

	function currentViewState(): RootViewState | null {
		const camera = rootMap?.getCameraState()
		if (!camera) return null
		return {
			version: 1,
			renderer: 'root',
			space: { slug: 'aurelia-fixture' },
			selected: selectedId,
			focus: focusId,
			camera,
			mode: view,
			time: currentAbsoluteDay,
			labels,
			skyLabels,
			trails,
			visibility,
			exposure: visibility === 'physical' ? 'fixed' : 'auto',
			scale,
			follow,
		}
	}

	onMount(() => {
		let frame = 0
		let previous = performance.now()
		const tick = (now: number) => {
			if (playing) currentAbsoluteDay += (now - previous) / 2_000
			previous = now
			frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	})
</script>

<svelte:head><title>Rodder root map fixture</title></svelte:head>

<main class="min-h-screen bg-page p-3 text-heading" data-testid="rodder-fixture">
	<div class="mx-auto max-w-7xl overflow-hidden border border-border-subtle bg-surface">
		<div class="flex justify-end border-b border-border-subtle px-3 py-1.5 text-xs">
			<CopyViewLink getState={currentViewState} />
		</div>
		<MapControls bind:labels bind:skyLabels bind:trails bind:visibility />
		<div class="h-[min(76vh,54rem)] min-h-112" data-testid="map-frame">
			<RootMap
				bind:this={rootMap}
				rootName="Aurelia fixture"
				{stars}
				{bodies}
				{apparentSky}
				{currentAbsoluteDay}
				{scale}
				{labels}
				{skyLabels}
				{trails}
				{visibility}
				bind:follow
				bind:view
				bind:selectedId
				bind:focusId
				{initialCameraState}
			/>
		</div>
		<div class="flex items-center gap-3 border-t border-border-subtle px-3 py-2 text-xs text-secondary">
			<button class="bg-raised px-2 py-1 text-heading" onclick={() => { playing = !playing }}>{playing ? 'Pause' : 'Play'}</button>
			<button class="bg-raised px-2 py-1 text-heading" onclick={() => { currentAbsoluteDay += 0.25 }}>Advance ¼ day</button>
			<span data-testid="fixture-day">Day {currentAbsoluteDay.toFixed(3)}</span>
			<span data-testid="fixture-selection">{selectedId ?? 'none'}</span>
			<span data-testid="fixture-focus">{focusId ?? 'none'}</span>
			<span data-testid="fixture-mode">{view}</span>
		</div>
	</div>
</main>
