<script lang="ts">
	import type { PageData } from './$types.js'
	import { m } from '$lib/paraglide/messages.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
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
	import Compass from 'phosphor-svelte/lib/Compass'

	let { data }: { data: PageData } = $props()

	// Registry queries return loosely-typed rows; the atlas shapes are a subset.
	const systems = $derived(data.systems as unknown as AtlasSystem[])
	const stars = $derived(data.stars as unknown as AtlasStar[])
	const bodies = $derived(data.bodies as unknown as AtlasBody[])
	const sectors = $derived(data.sectors ?? [])

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
		{ value: 'name', label: m.cel_sort_name() },
		{ value: 'planets', label: m.cel_sort_most_planets() },
		{ value: 'stars', label: m.cel_sort_most_stars() },
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
		{ label: m.cel_systems(), value: totals.systems },
		{ label: m.cel_stars(), value: totals.stars },
		{ label: m.cel_planets(), value: totals.planets },
		{ label: m.cel_moons(), value: totals.moons },
	])
</script>

<svelte:head>
	<title>{m.nav_celestial()} — KnowThing</title>
</svelte:head>

<ArticleShell breadcrumbs={[{ label: m.nav_celestial() }]} title={m.nav_celestial()}>
	{#snippet actions()}
		{#if permissions.canConfigureCelestial}
			<a href={resolve('/celestial/manage')} class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
				<GearSix size={14} weight="fill" />{m.cel_manage()}
			</a>
		{/if}
	{/snippet}

	{#if sectors.length > 0}
		<section class="mb-5">
			<div class="mb-2 flex items-baseline justify-between gap-3">
				<h2 class="text-xs font-semibold tracking-wider text-secondary uppercase">Sectors</h2>
				<span class="text-xs text-dim">Coordinate frames for the stellar atlas</span>
			</div>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each sectors as sector (sector.id)}
					<a href={resolve('/celestial/sector/[slug]', { slug: sector.slug })} class="group flex items-center gap-3 border border-border-subtle bg-surface px-4 py-3 transition-colors hover:border-accent-border hover:bg-raised">
						<Compass size={18} weight="fill" class="shrink-0 text-accent" />
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold text-heading group-hover:text-link">{sector.name}</span>
							<span class="block text-xs text-secondary">{sector.rootCount} {sector.rootCount === 1 ? 'system' : 'systems'} · {sector.positionedCount} positioned · {sector.units}</span>
						</span>
						<CaretRight size={13} class="shrink-0 text-secondary" />
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if systems.length === 0}
		<div class="bg-surface p-8 text-center">
			<p class="text-dim">{m.cel_no_systems_catalogued()}</p>
			{#if permissions.canConfigureCelestial}
				<a href={resolve('/celestial/manage')} class="mt-2 inline-block text-link transition-colors hover:text-link-hover">{m.cel_add_one_in_manage()}</a>
			{/if}
		</div>
	{:else}
		<!-- Overview -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each overview as tile (tile.label)}
				<div class="bg-surface px-4 py-3">
					<div class="text-xl font-semibold text-heading tabular-nums">{tile.value}</div>
					<div class="text-xs tracking-wider text-secondary uppercase">{tile.label}</div>
				</div>
			{/each}
		</div>

		<!-- Search + sort -->
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<Input bind:value={query} placeholder={m.cel_search_placeholder()} clearable containerClass="flex-1" />
			<div class="sm:w-52">
				<Select type="single" bind:value={sortMode} items={sortItems} />
			</div>
		</div>

		<!-- Facets -->
		{#if availableTypes.length > 1 || availableClasses.length > 1}
			<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
				{#if availableTypes.length > 1}
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="tracking-wider text-secondary uppercase">{m.common_type()}</span>
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
						<span class="tracking-wider text-secondary uppercase">{m.cel_star()}</span>
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
					<button type="button" onclick={clearFilters} class="text-link transition-colors hover:text-link-hover">{m.common_clear()}</button>
				{/if}
			</div>
		{/if}

		<p class="mt-4 mb-2 text-xs text-secondary">
			{hasFilters
				? m.cel_count_summary_match({ shown: filtered.length, total: systems.length, noun: systems.length === 1 ? m.cel_word_system() : m.cel_word_systems() })
				: m.cel_count_summary({ shown: filtered.length, total: systems.length, noun: systems.length === 1 ? m.cel_word_system() : m.cel_word_systems() })}
		</p>

		<!-- Index -->
		{#if filtered.length === 0}
			<div class="bg-surface p-8 text-center text-dim">{m.cel_no_match_search()}</div>
		{:else}
			<div class="divide-y divide-border-subtle">
				{#each filtered as entry (entry.system.id)}
					{@const mb = matchedBodyName(entry, query)}
					<a
						href={resolve('/[...ns_path=namespaced]', { ns_path: `Celestial:${entry.system.slug}` })}
						class="flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-raised"
						style="content-visibility:auto;contain-intrinsic-size:auto 60px"
					>
						<SunDim size={20} weight="fill" class="shrink-0 text-accent" />
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="font-semibold text-heading">{entry.system.name}</span>
								<span class="text-xs text-secondary capitalize">{entry.type}</span>
								{#if entry.starDots.length > 0}
									<span class="flex items-center gap-1">
										{#each entry.starDots as dot (dot.name)}
											<span class="inline-block size-2 rounded-full" style="background-color:{dot.color}" title={dot.name}></span>
										{/each}
									</span>
								{/if}
							</div>
							{#if mb}
								<div class="text-xs text-dim">{m.cel_matched()} <span class="text-secondary">{mb}</span></div>
							{/if}
						</div>
						<div class="hidden shrink-0 items-center gap-3 text-xs text-secondary tabular-nums sm:flex">
							<span class="flex items-center gap-1" title={m.cel_stars()}><StarIcon size={11} weight="fill" />{entry.system.starCount}</span>
							<span class="flex items-center gap-1" title={m.cel_planets()}><Planet size={11} />{entry.system.planetCount}</span>
							{#if entry.moonCount > 0}
								<span class="flex items-center gap-1" title={m.cel_moons()}><Moon size={11} />{entry.moonCount}</span>
							{/if}
						</div>
						<CaretRight size={14} class="shrink-0 text-secondary" />
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</ArticleShell>
