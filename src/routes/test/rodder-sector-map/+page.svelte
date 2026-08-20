<script lang="ts">
	import { untrack } from 'svelte'
	import { page } from '$app/stores'
	import CopyViewLink from '$lib/feature/rodder/CopyViewLink.svelte'
	import SectorMap from '$lib/feature/rodder/SectorMap.svelte'
	import type { SectorRootView } from '$lib/feature/rodder/sector-view.js'
	import {
		RODDER_VIEW_QUERY_PARAM,
		sectorViewStateFor,
		type SectorCameraState,
		type SectorViewState,
	} from '$lib/feature/rodder/view-state.js'

	const roots: SectorRootView[] = [
		{ rootId: 1, bodyId: 101, name: 'Orison Fold', slug: 'orison-fold', kind: 'system', x: 0, y: 0, z: 0, positionProvenance: 'authored', positionUncertainty: null, distanceLy: 0, starCount: 1, planetCount: 4 },
		{ rootId: 2, bodyId: 102, name: 'Glass Wake', slug: 'glass-wake', kind: 'system', x: 6, y: -2, z: 1.5, positionProvenance: 'authored', positionUncertainty: null, distanceLy: 6.5, starCount: 2, planetCount: 7 },
		{ rootId: 3, bodyId: 103, name: 'Rogue Lantern', slug: 'rogue-lantern', kind: 'body', x: -4, y: 3, z: -1, positionProvenance: 'authored', positionUncertainty: null, distanceLy: 5.1, starCount: 0, planetCount: 1 },
	]
	const linkedViewState = $derived(sectorViewStateFor(
		$page.url.searchParams.get(RODDER_VIEW_QUERY_PARAM),
		'fixture-sector',
		new Set(roots.map(root => root.slug)),
	))
	const focusSlug = $derived(linkedViewState?.focus ?? $page.url.searchParams.get('focus'))
	const initialCameraState = $derived(linkedViewState?.camera ?? null)
	let selectedSlug = $state<string | null>(null)
	let sectorMap = $state<{ getCameraState(): SectorCameraState | null } | null>(null)

	$effect(() => {
		const selected = linkedViewState?.selected ?? focusSlug
		untrack(() => {
			selectedSlug = selected
		})
	})

	function currentViewState(): SectorViewState | null {
		const camera = sectorMap?.getCameraState()
		if (!camera) return null
		return {
			version: 1,
			renderer: 'sector',
			space: { slug: 'fixture-sector' },
			selected: selectedSlug,
			focus: focusSlug,
			camera,
		}
	}
</script>

<svelte:head><title>Rodder sector map fixture</title></svelte:head>

<main class="min-h-screen bg-page p-3 text-heading" data-testid="rodder-sector-fixture">
	<div class="mx-auto max-w-7xl overflow-hidden border border-border-subtle bg-surface">
		<div class="flex items-center justify-between border-b border-border-subtle px-3 py-1.5 text-xs">
			<span data-testid="fixture-sector-selection">{selectedSlug ?? 'none'}</span>
			<CopyViewLink getState={currentViewState} />
		</div>
		<div class="h-[min(76vh,54rem)] min-h-112" data-testid="sector-map-frame">
			<SectorMap
				bind:this={sectorMap}
				sectorName="Fixture sector"
				sectorSlug="fixture-sector"
				units="ly"
				{roots}
				bind:selectedSlug
				{focusSlug}
				{initialCameraState}
			/>
		</div>
	</div>
</main>
