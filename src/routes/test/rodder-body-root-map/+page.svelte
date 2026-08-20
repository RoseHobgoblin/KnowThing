<script lang="ts">
	import MapControls from '$lib/feature/rodder/MapControls.svelte'
	import RootMap from '$lib/feature/rodder/RootMap.svelte'
	import type { LabelMode, TrailMode, ViewMode, VisibilityMode } from '$lib/feature/rodder/map-settings.js'
	import type { EntityKey, MapBody } from '$lib/feature/rodder/root-layout.js'
	import { buildApparentSky, type RootSelectionKey } from '$lib/feature/rodder/apparent-sky.js'

	const bodies: MapBody[] = [
		{
			id: 300,
			name: 'Waywain',
			slug: 'waywain',
			bodyType: 'planet',
			isRoot: true,
			massKg: 6.2e24,
			radiusM: 6_450_000,
			rotationPeriodS: 93_600,
			axialTilt: 18,
			color: 'slate blue',
		},
		{
			id: 301,
			name: 'Wisp',
			slug: 'wisp',
			bodyType: 'moon',
			parentId: 300,
			semiMajorAxisAu: 0.0028,
			eccentricity: 0.08,
			inclination: 23,
			longitudeAscendingNode: 70,
			argumentOfPeriapsis: 34,
			orbitalPeriodDays: 31,
			epochPhase: 0.2,
			radiusM: 1_700_000,
			color: 'grey',
		},
	]
	const apparentSky = buildApparentSky(null, [])

	let labels = $state<LabelMode>('all')
	let skyLabels = $state<LabelMode>('off')
	let trails = $state<TrailMode>('off')
	let visibility = $state<VisibilityMode>('enhanced')
	let follow = $state(false)
	let view = $state<ViewMode>('orrery')
	let selectedId = $state<RootSelectionKey | null>(null)
	let focusId = $state<EntityKey | null>(null)
</script>

<svelte:head><title>Rodder body-root map fixture</title></svelte:head>

<main class="min-h-screen bg-page p-3 text-heading" data-testid="rodder-body-root-fixture">
	<div class="mx-auto max-w-5xl overflow-hidden border border-border-subtle bg-surface">
		<MapControls bind:labels bind:skyLabels bind:trails bind:visibility bind:follow canFollowSelection={selectedId != null && !selectedId.startsWith('sky-root:')} />
		<div class="h-[min(76vh,48rem)] min-h-112" data-testid="body-root-map-frame">
			<RootMap
				rootName="Waywain"
				stars={[]}
				{bodies}
				{apparentSky}
				currentAbsoluteDay={12_345.25}
				scale="proportional"
				{labels}
				{skyLabels}
				{trails}
				{visibility}
				bind:follow
				bind:view
				bind:selectedId
				bind:focusId
			/>
		</div>
		<div class="flex gap-3 border-t border-border-subtle px-3 py-2 text-xs text-secondary">
			<span data-testid="body-root-selection">{selectedId ?? 'none'}</span>
			<span data-testid="body-root-focus">{focusId ?? 'none'}</span>
		</div>
	</div>
</main>
