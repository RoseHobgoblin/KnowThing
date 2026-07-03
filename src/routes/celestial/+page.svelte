<script lang="ts">
	import type { PageData } from './$types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { page } from '$app/stores'
	import { cn } from '$lib/utils'
	import { normalizePermissions } from '$lib/permissions.js'
	import { spectralColor } from '$lib/celestial/colors.js'
	import {
		enrichSystems,
		filterSystems,
		matchedBodyName,
		SYSTEM_TYPE_ORDER,
		SPECTRAL_CLASS_ORDER,
		type AtlasSystem,
		type AtlasStar,
		type AtlasBody,
	} from '$lib/celestial/atlas.js'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import CaretRight from 'phosphor-svelte/lib/CaretRight'

	let { data }: { data: PageData } = $props()

	// Registry queries return loosely-typed rows; the atlas shapes are a subset.
	const systems = $derived(data.systems as unknown as AtlasSystem[])
	const stars = $derived(data.stars as unknown as AtlasStar[])
	const bodies = $derived(data.bodies as unknown as AtlasBody[])

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)
	$effect(() => {
		if ($page.data.permissions !== undefined) stablePermissions = normalizePermissions($page.data.permissions)
	})

	const enriched = $derived(enrichSystems(systems, stars, bodies))

	let query = $state('')
	let selectedTypes = $state<string[]>([])
	let selectedClasses = $state<string[]>([])
	let sortMode = $state<'name' | 'planets' | 'stars'>('name')

	const availableTypes = $derived(SYSTEM_TYPE_ORDER.filter(type => enriched.some(entry => entry.type === type)))
	const availableClasses = $derived(SPECTRAL_CLASS_ORDER.filter(cls => enriched.some(entry => entry.classes.includes(cls))))

	function toggleType(type: string) {
		selectedTypes = selectedTypes.includes(type) ? selectedTypes.filter(t => t !== type) : [...selectedTypes, type]
	}
	function toggleClass(cls: string) {
		selectedClasses = selectedClasses.includes(cls) ? selectedClasses.filter(c => c !== cls) : [...selectedClasses, cls]
	}
	function clearFilters() {
		query = ''
		selectedTypes = []
		selectedClasses = []
	}

	const sortItems = [
		{ value: 'name', label: 'Name (A–Z)' },
		{ value: 'planets', label: 'Most planets' },
		{ value: 'stars', label: 'Most stars' },
	]

	const filtered = $derived(filterSystems(enriched, { query, types: selectedTypes, classes: selectedClasses, sort: sortMode }))
	const hasFilters = $derived(query.trim() !== '' || selectedTypes.length > 0 || selectedClasses.length > 0)

	const totals = $derived({
		systems: systems.length,
		stars: stars.length,
		planets: bodies.filter(body => body.parentId == null).length,
		moons: bodies.filter(body => body.parentId != null).length,
	})
	const overview = $derived([
		{ label: 'Systems', value: totals.systems },
		{ label: 'Stars', value: totals.stars },
		{ label: 'Planets', value: totals.planets },
		{ label: 'Moons', value: totals.moons },
	])
</script>

<svelte:head>
	<title>Celestial — KnowThing</title>
</svelte:head>

<ArticleShell breadcrumbs={[{ label: 'Celestial' }]} title="Celestial">
	{#snippet actions()}
		{#if permissions.canConfigureCelestial}
			<a href="/celestial/manage" class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
				<GearSix size={14} weight="fill" />Manage
			</a>
		{/if}
	{/snippet}

	{#if systems.length === 0}
		<div class="border border-border bg-surface p-8 text-center">
			<p class="text-dim">No star systems catalogued yet.</p>
			{#if permissions.canConfigureCelestial}
				<a href="/celestial/manage" class="mt-2 inline-block text-link transition-colors hover:text-link-hover">Add one in Manage →</a>
			{/if}
		</div>
	{:else}
		<!-- Overview -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each overview as tile (tile.label)}
				<div class="border border-border-subtle bg-surface px-4 py-3">
					<div class="text-xl font-semibold text-heading tabular-nums">{tile.value}</div>
					<div class="text-xs uppercase tracking-wider text-faint">{tile.label}</div>
				</div>
			{/each}
		</div>

		<!-- Search + sort -->
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<Input bind:value={query} placeholder="Search systems, stars, planets…" clearable containerClass="flex-1" />
			<div class="sm:w-52">
				<Select type="single" bind:value={sortMode} items={sortItems} />
			</div>
		</div>

		<!-- Facets -->
		{#if availableTypes.length > 1 || availableClasses.length > 1}
			<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
				{#if availableTypes.length > 1}
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="uppercase tracking-wider text-faint">Type</span>
						{#each availableTypes as type (type)}
							<button
								type="button"
								onclick={() => toggleType(type)}
								class={cn('border px-2 py-0.5 capitalize transition-colors', selectedTypes.includes(type) ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:bg-raised')}
							>{type}</button>
						{/each}
					</div>
				{/if}
				{#if availableClasses.length > 1}
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="uppercase tracking-wider text-faint">Star</span>
						{#each availableClasses as cls (cls)}
							<button
								type="button"
								onclick={() => toggleClass(cls)}
								class={cn('flex items-center gap-1 border px-2 py-0.5 transition-colors', selectedClasses.includes(cls) ? 'border-accent-border bg-accent-subtle text-accent' : 'border-border-subtle text-secondary hover:bg-raised')}
							>
								<span class="inline-block size-2 rounded-full" style="background-color:{spectralColor(cls)}"></span>{cls}
							</button>
						{/each}
					</div>
				{/if}
				{#if hasFilters}
					<button type="button" onclick={clearFilters} class="text-link transition-colors hover:text-link-hover">Clear</button>
				{/if}
			</div>
		{/if}

		<p class="mb-2 mt-4 text-xs text-faint">
			{filtered.length} of {systems.length} {systems.length === 1 ? 'system' : 'systems'}{hasFilters ? ' match' : ''}
		</p>

		<!-- Index -->
		{#if filtered.length === 0}
			<div class="border border-border-subtle bg-surface p-8 text-center text-dim">No systems match your search.</div>
		{:else}
			<div class="divide-y divide-border-subtle border border-border-subtle">
				{#each filtered as entry (entry.system.id)}
					{@const mb = matchedBodyName(entry, query)}
					<a
						href="/Celestial:{entry.system.slug}"
						class="flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-raised"
						style="content-visibility:auto;contain-intrinsic-size:auto 60px"
					>
						<SunDim size={20} weight="fill" class="shrink-0 text-accent" />
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="font-semibold text-heading">{entry.system.name}</span>
								<span class="text-xs capitalize text-faint">{entry.type}</span>
								{#if entry.starDots.length > 0}
									<span class="flex items-center gap-1">
										{#each entry.starDots as dot (dot.name)}
											<span class="inline-block size-2 rounded-full" style="background-color:{dot.color}" title={dot.name}></span>
										{/each}
									</span>
								{/if}
							</div>
							{#if mb}
								<div class="text-xs text-dim">matched: <span class="text-secondary">{mb}</span></div>
							{/if}
						</div>
						<div class="hidden shrink-0 items-center gap-3 text-xs tabular-nums text-faint sm:flex">
							<span class="flex items-center gap-1" title="Stars"><StarIcon size={11} weight="fill" />{entry.system.starCount}</span>
							<span class="flex items-center gap-1" title="Planets"><Planet size={11} />{entry.system.planetCount}</span>
							{#if entry.moonCount > 0}
								<span class="flex items-center gap-1" title="Moons"><Moon size={11} />{entry.moonCount}</span>
							{/if}
						</div>
						<CaretRight size={14} class="shrink-0 text-faint" />
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</ArticleShell>
