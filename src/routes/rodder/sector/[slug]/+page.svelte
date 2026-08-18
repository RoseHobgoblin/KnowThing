<script lang="ts">
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import { cn } from '$lib/utils.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import SectorMap from '$lib/rodder/SectorMap.svelte'
	import { rodderSectorBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import {
		formatSectorDistance,
		formatSectorPosition,
		hasSectorPosition,
		positionedRoots,
		unitsLabel,
		unpositionedRoots,
		type SectorRootView,
	} from '$lib/rodder/sector-view.js'
	import type { PageData } from './$types.js'
	import { normalizePermissions } from '$lib/permissions.js'
	import GearSix from 'phosphor-svelte/lib/GearSix'

	let { data }: { data: PageData } = $props()

	const sector = $derived(data.sector)
	const roots = $derived(data.roots as SectorRootView[])
	const permissions = $derived(normalizePermissions($page.data.permissions))

	let selectedSlug = $state<string | null>(null)
	const focusSlug = $derived($page.url.searchParams.get('focus'))

	const selectedRoot = $derived(roots.find(root => root.slug === selectedSlug) ?? null)
	const selectedPosition = $derived(selectedRoot ? formatSectorPosition(selectedRoot, sector.units) : null)
	const selectedOriginDistance = $derived.by(() => {
		if (!selectedRoot || !hasSectorPosition(selectedRoot)) return null
		return formatSectorDistance(Math.hypot(selectedRoot.x, selectedRoot.y, selectedRoot.z), sector.units)
	})

	const placed = $derived(positionedRoots(roots))
	const unplaced = $derived(unpositionedRoots(roots))

	const extentLabel = $derived.by(() => {
		if (sector.shape === 'sphere' && sector.radius != null) return `Sphere, radius ${sector.radius} ${sector.units}`
		if (sector.shape === 'cuboid' && sector.extentX != null && sector.extentY != null && sector.extentZ != null) {
			return `Cuboid, ${sector.extentX} × ${sector.extentY} × ${sector.extentZ} ${sector.units}`
		}
		return 'Undeclared'
	})

	const originLabel = $derived.by(() => {
		if (sector.originKind === 'object-centred') return 'Object-centred'
		if (sector.originKind === 'imported') return 'Imported'
		return 'Frame-centred (arbitrary)'
	})
</script>

<svelte:head>
	<title>{sector.name} — Rodder — KnowThing</title>
</svelte:head>

<ArticleShell breadcrumbs={rodderSectorBreadcrumbs(sector.name)} title={sector.name}>
	{#snippet actions()}
		{#if permissions.canConfigureRodder}
			<a href={resolve('/rodder/manage/sectors')} class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover"><GearSix size={14} weight="fill" /> Edit frame</a>
		{/if}
	{/snippet}
	{#if sector.description}
		<p class="mb-3 max-w-3xl text-sm text-secondary">{sector.description}</p>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
		<div class="min-w-0 overflow-hidden">
			{#if placed.length > 0}
				<div class="h-[clamp(28rem,72vh,56rem)]">
					<SectorMap
						sectorName={sector.name}
						sectorSlug={sector.slug}
						units={sector.units}
						{roots}
						bind:selectedSlug
						{focusSlug}
					/>
				</div>
			{:else}
				<div class="flex h-64 items-center justify-center text-dim">
					No roots in this sector have a complete position yet.
				</div>
			{/if}
		</div>

		<div class="space-y-4 text-sm md:border-l md:border-border-subtle md:pl-4">
			<!-- Frame contract -->
			<div>
				<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Frame</div>
				<div class="space-y-1.5 text-secondary">
					<div class="flex justify-between"><span>Units</span><span class="font-medium text-body">{unitsLabel(sector.units)}</span></div>
					<div class="flex justify-between"><span>Origin</span><span class="font-medium text-body">{originLabel}</span></div>
					<div class="flex justify-between"><span>Handedness</span><span class="font-medium text-body">{sector.handedness}</span></div>
					<div class="flex justify-between"><span>Extent</span><span class="font-medium text-body">{extentLabel}</span></div>
					{#if sector.referenceEpoch}
						<div class="flex justify-between gap-4"><span>Epoch</span><span class="text-right font-medium text-body">{sector.referenceEpoch}</span></div>
					{/if}
					<div class="flex justify-between"><span>Provenance</span><span class="font-medium text-body">{sector.provenance}</span></div>
				</div>
				{#if sector.axesNote}
					<p class="mt-2 text-xs text-dim">{sector.axesNote}</p>
				{/if}
			</div>

			<!-- Selected root -->
			{#if selectedRoot}
				<div>
					<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Selected</div>
					<div class="space-y-1.5">
						<div class="font-medium text-heading">{selectedRoot.name}</div>
						<div class="space-y-1 text-xs text-secondary">
							<div class="flex justify-between">
								<span>Position</span>
								<span class="text-body">{selectedPosition ?? 'Unavailable'}</span>
							</div>
							{#if selectedOriginDistance}
								<div class="flex justify-between">
									<span>From origin</span>
									<span class="text-body">{selectedOriginDistance}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span>Contents</span>
								<span class="text-body">{selectedRoot.starCount} {selectedRoot.starCount === 1 ? 'star' : 'stars'}, {selectedRoot.planetCount} {selectedRoot.planetCount === 1 ? 'body' : 'bodies'}</span>
							</div>
							{#if selectedRoot.positionProvenance === 'legacy'}
								<p class="text-accent">Legacy coordinates — migrated verbatim from an undeclared frame.</p>
							{/if}
						</div>
						<a
							href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${selectedRoot.slug}` })}
							class="mt-2 block text-xs text-link transition-colors hover:text-link-hover"
						>Enter system</a>
					</div>
				</div>
			{/if}

			<!-- Root list -->
			<div>
				<div class="mb-2 border-b border-border-subtle pb-1 text-xs font-semibold tracking-wider text-secondary uppercase">Roots</div>
				<div class="space-y-0.5">
					{#each placed as root (root.slug)}
						<button
							class={cn('flex w-full items-baseline justify-between gap-2 px-1.5 py-1 text-left transition-colors hover:bg-raised', root.slug === selectedSlug && 'bg-raised')}
							onclick={() => { selectedSlug = root.slug }}
						>
							<span class="truncate font-medium text-body">{root.name}</span>
							<span class="shrink-0 text-xs text-secondary">{formatSectorPosition(root, sector.units)}</span>
						</button>
					{/each}
				</div>
				{#if unplaced.length > 0}
					<div class="mt-3 mb-1 text-xs text-dim">Position unavailable</div>
					<div class="space-y-0.5">
						{#each unplaced as root (root.slug)}
							<div class="flex items-baseline justify-between gap-2 px-1.5 py-1">
								<span class="truncate text-body">{root.name}</span>
								<a
									href={resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${root.slug}` })}
									class="shrink-0 text-xs text-link hover:text-link-hover"
								>Open</a>
							</div>
						{/each}
					</div>
				{/if}
				{#if roots.length === 0}
					<p class="text-xs text-dim">This sector has no roots yet. Systems become roots automatically when created.</p>
				{/if}
			</div>
		</div>
	</div>
</ArticleShell>
