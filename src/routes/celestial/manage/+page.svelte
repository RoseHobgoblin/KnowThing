<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess } from '$lib/notifications.svelte'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { invalidateAll } from '$app/navigation'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { celestialPresets } from '$lib/celestial/presets.js'
	import type { CelestialPreset } from '$lib/celestial/presets.js'
	import { deriveSystemType } from '$lib/celestial/compute.js'
	import { celestialRegistryBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Moon from 'phosphor-svelte/lib/Moon'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
	import X from 'phosphor-svelte/lib/X'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	type RegistrySystem = {
		id: number
		name: string
		slug: string
		starCount: number
		planetCount: number
	}

	type RegistryStar = {
		id: number
		name: string
		slug: string
		spectralType: string | null
		color: string | null
		systemId: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		parentStarId: number | null
		planetCount: number
	}

	type RegistryBody = {
		id: number
		name: string
		slug: string
		bodyType: string
		starId: number | null
		parentId: number | null
		semiMajorAxisAu: number | null
		eccentricity: number | null
		moonCount: number
	}

	const systems = $derived(data.systems as unknown as RegistrySystem[])
	const stars = $derived(data.stars as unknown as RegistryStar[])
	const bodies = $derived(data.bodies as unknown as RegistryBody[])

	let newSystemName = $state('')
	let newStarName = $state('')
	let newStarSystemId = $state<string | undefined>(undefined)
	let newBodyName = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<string | undefined>(undefined)
	let newBodyParentId = $state<string | undefined>(undefined)


	const newBodyParentOptions = $derived(
		newBodyStarId
			? bodies.filter(body => body.starId === Number(newBodyStarId))
			: [],
	)

	$effect(() => {
		if (!newBodyParentId) return
		if (!newBodyParentOptions.some(body => String(body.id) === newBodyParentId)) {
			newBodyParentId = undefined
		}
	})

	function starsForSystem(systemId: number) {
		return stars.filter(star => star.systemId === systemId)
	}

	function orphanStars() {
		return stars.filter(star => !star.systemId)
	}

	function bodiesForStar(starId: number) {
		return bodies.filter(body => body.starId === starId && !body.parentId)
	}

	function orphanBodies() {
		return bodies.filter(body => !body.starId && !body.parentId)
	}

	function moonsForBody(bodyId: number) {
		return bodies.filter(body => body.parentId === bodyId)
	}

	const slugify = urlSlugify

	const createSystemMutation = createMutation(() => ({
		mutationFn: () => api('POST', '/api/celestial', { kind: 'system', name: newSystemName.trim(), slug: slugify(newSystemName) }),
		onSuccess: () => {
			pushSuccess(`System "${newSystemName}" created`)
			newSystemName = ''
			invalidateAll()
		},
	}))

	function createSystem() {
		if (!newSystemName.trim()) return
		createSystemMutation.mutate()
	}

	const createStarMutation = createMutation(() => ({
		mutationFn: () => api('POST', '/api/celestial', {
			kind: 'star',
			name: newStarName.trim(),
			slug: slugify(newStarName),
			parentId: newStarSystemId ? Number(newStarSystemId) : null,
		}),
		onSuccess: () => {
			pushSuccess(`Star "${newStarName}" created`)
			newStarName = ''
			newStarSystemId = undefined
			invalidateAll()
		},
	}))

	function createStar() {
		if (!newStarName.trim()) return
		createStarMutation.mutate()
	}

	const createBodyMutation = createMutation(() => ({
		mutationFn: () => api('POST', '/api/celestial', {
			kind: 'body',
			name: newBodyName.trim(),
			slug: slugify(newBodyName),
			bodyType: newBodyType,
			// A moon orbits its parent body; a planet orbits the star.
			parentId: newBodyParentId ? Number(newBodyParentId) : (newBodyStarId ? Number(newBodyStarId) : null),
		}),
		onSuccess: () => {
			pushSuccess(`${newBodyName} created`)
			newBodyName = ''
			newBodyStarId = undefined
			newBodyParentId = undefined
			invalidateAll()
		},
	}))

	function createBody() {
		if (!newBodyName.trim()) return
		createBodyMutation.mutate()
	}

	const creating = $derived(createSystemMutation.isPending || createStarMutation.isPending || createBodyMutation.isPending)

	let presetProgress = $state('')

	// One server call seeds the whole system in a single transaction — a
	// failure part-way rolls everything back instead of orphaning half a system.
	const presetMutation = createMutation(() => ({
		mutationFn: (preset: CelestialPreset) => api('POST', '/api/celestial/preset', { preset: preset.label }),
		onMutate: (preset) => { presetProgress = `Creating ${preset.system.name}...` },
		onSuccess: (_data, preset) => {
			pushSuccess(`Created "${preset.system.name}" with all bodies`)
			invalidateAll()
		},
		onSettled: () => { presetProgress = '' },
	}))

	const creatingPreset = $derived(presetMutation.isPending)

	function createFromPreset(preset: CelestialPreset) {
		presetMutation.mutate(preset)
	}

	const deleteMutation = createMutation(() => ({
		mutationFn: ({ slug }: { slug: string, name: string }) => api('DELETE', `/api/celestial/${slug}`),
		onSuccess: (_data, { name }) => {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		},
	}))

	async function deleteItem(slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		deleteMutation.mutate({ slug, name })
	}
</script>

<svelte:head>
	<title>Manage Registry — Celestial — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={celestialRegistryBreadcrumbs()}
	title="Manage Registry"
>
	{#snippet actions()}
		<a href="/celestial" class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
			<ArrowLeft size={14} weight="bold" />Back to atlas
		</a>
	{/snippet}

	{#if systems.length === 0 && orphanStars().length === 0 && orphanBodies().length === 0}
		<div class="bg-surface p-8 text-center">
			<p class="text-dim">No celestial bodies registered yet. Use the forms below to add one.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each systems as system (system.id)}
				<div class="bg-surface">
					<!-- System header -->
					<div class="flex items-center justify-between px-4 py-3 bg-raised border-b border-border-subtle">
						<div class="flex items-center gap-2">
							<SunDim size={20} weight="fill" class="text-accent" />
							<a href="/Celestial:{system.slug}" class="text-heading font-bold text-lg transition-colors hover:text-link">{system.name}</a>
							<span class="text-xs text-secondary">{deriveSystemType(system.starCount)} · {system.starCount} {system.starCount === 1 ? 'star' : 'stars'} · {system.planetCount} {system.planetCount === 1 ? 'planet' : 'planets'}</span>
						</div>
						<div class="flex items-center gap-3 text-xs">
							<a href="/Celestial:{system.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
							<button onclick={() => deleteItem(system.slug, system.name)} class="text-error transition-colors hover:text-error-hover">Delete</button>
						</div>
					</div>

					<!-- Stars in this system -->
					{#each starsForSystem(system.id) as star (star.id)}
						<div class="border-b border-border-subtle last:border-0">
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2 ml-2">
									<StarIcon size={14} weight="fill" class="text-secondary" />
									<a href="/Celestial:{star.slug}" class="text-heading font-semibold transition-colors hover:text-link">{star.name}</a>
									{#if star.spectralType}
										<span class="text-xs text-secondary">({star.spectralType})</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 text-xs">
									<a href="/Celestial:{star.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
									<button onclick={() => deleteItem(star.slug, star.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {star.name}"><X size={12} weight="bold" /></button>
								</div>
							</div>

							<!-- Planets under this star -->
							{#each bodiesForStar(star.id) as planet (planet.id)}
								<div class="flex items-center justify-between px-4 py-1.5 ml-8">
									<div class="flex items-center gap-2">
										<Planet size={12} class="text-dim" />
										<a href="/Celestial:{planet.slug}" class="text-body text-sm transition-colors hover:text-link">{planet.name}</a>
										<span class="text-xs text-secondary">({planet.bodyType})</span>
										{#if planet.moonCount > 0}
											<span class="text-xs text-dim">· {planet.moonCount} {planet.moonCount === 1 ? 'satellite' : 'satellites'}</span>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs">
										<a href="/Celestial:{planet.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
										<button onclick={() => deleteItem(planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {planet.name}"><X size={12} weight="bold" /></button>
									</div>
								</div>
								{#each moonsForBody(planet.id) as moon (moon.id)}
									<div class="flex items-center justify-between px-4 py-1 ml-14">
										<div class="flex items-center gap-2">
											<Moon size={10} class="text-secondary" />
											<a href="/Celestial:{moon.slug}" class="text-xs text-secondary transition-colors hover:text-link">{moon.name}</a>
										</div>
										<div class="flex items-center gap-3 text-xs">
											<a href="/Celestial:{moon.slug}/configure" class="text-link transition-colors flex items-center gap-1 hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
											<button onclick={() => deleteItem(moon.slug, moon.name)} class="text-error transition-colors hover:text-error-hover" aria-label="Delete {moon.name}"><X size={12} weight="bold" /></button>
										</div>
									</div>
								{/each}
							{/each}
						</div>
					{/each}
				</div>
			{/each}

			<!-- Orphan stars (no system) -->
			{#if orphanStars().length > 0}
				<div class="bg-surface p-4">
					<span class="text-xs text-secondary uppercase tracking-wide">Unassigned Stars</span>
					{#each orphanStars() as star (star.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<StarIcon size={14} weight="fill" class="text-secondary" />
								<span class="text-body">{star.name}</span>
								{#if star.spectralType}
									<span class="text-xs text-secondary">({star.spectralType})</span>
								{/if}
							</div>
							<a href="/Celestial:{star.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Orphan bodies (no star) -->
			{#if orphanBodies().length > 0}
				<div class="bg-surface p-4">
					<span class="text-xs text-secondary uppercase tracking-wide">Unassigned Bodies</span>
					{#each orphanBodies() as body (body.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<Planet size={12} class="text-dim" />
								<span class="text-body">{body.name}</span>
								<span class="text-xs text-secondary">({body.bodyType})</span>
							</div>
							<a href="/Celestial:{body.slug}/configure" class="text-xs text-link flex items-center gap-1 transition-colors hover:text-link-hover"><GearSix size={12} weight="fill" />Configure</a>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Create forms -->
	<div class="mt-8 space-y-4">
		<!-- Presets -->
		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">Create from Preset</h2>
			<p class="text-xs text-secondary">Populate an entire system with real-world data. Creates the system, stars, planets, and moons in one go.</p>
			<div class="flex flex-wrap gap-2">
				{#each celestialPresets as preset (preset.label)}
					<Button onclick={() => createFromPreset(preset)} loading={creatingPreset} disabled={creatingPreset}>
						{preset.label}
					</Button>
				{/each}
			</div>
			{#if presetProgress}
				<p class="text-xs text-secondary">{presetProgress}</p>
			{/if}
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">Add System</h2>
			<div class="flex gap-3 items-end">
				<Input label="Name" bind:value={newSystemName} placeholder="e.g. Sunly system" containerClass="flex-1" />
				<Button onclick={createSystem} disabled={!newSystemName.trim()} loading={creating}>Add</Button>
			</div>
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">Add Star</h2>
			<div class="flex gap-3 items-end">
				<Input label="Name" bind:value={newStarName} placeholder="e.g. The Sun" containerClass="flex-1" />
				<Select
					type="single"
					label="System"
					bind:value={newStarSystemId}
					placeholder="None"
					items={systems.map(system => ({ value: String(system.id), label: system.name }))}
				/>
				<Button onclick={createStar} disabled={!newStarName.trim()} loading={creating}>Add</Button>
			</div>
		</section>

		<section class="bg-surface p-5 space-y-3">
			<h2 class="text-sm font-semibold text-heading">Add Body</h2>
			<p class="text-xs text-secondary">Pick a parent body to create a moon or ring system; leave empty for a planet that orbits the star directly.</p>
			<div class="flex gap-3 items-end flex-wrap">
				<Input label="Name" bind:value={newBodyName} placeholder="e.g. Earth" containerClass="flex-1 min-w-40" />
				<Select
					type="single"
					label="Type"
					bind:value={newBodyType}
					items={[
						{ value: 'planet', label: 'Planet' },
						{ value: 'asteroid', label: 'Asteroid' },
						{ value: 'ring_system', label: 'Ring System' },
					]}
				/>
				<Select
					type="single"
					label="Star"
					bind:value={newBodyStarId}
					placeholder="None"
					items={stars.map(star => ({ value: String(star.id), label: star.name }))}
				/>
				<Select
					type="single"
					label="Orbits Body"
					bind:value={newBodyParentId}
					placeholder={newBodyStarId ? 'None (orbits star)' : 'Pick a star first'}
					disabled={!newBodyStarId || newBodyParentOptions.length === 0}
					items={newBodyParentOptions.map(body => ({ value: String(body.id), label: body.name }))}
				/>
				<Button onclick={createBody} disabled={!newBodyName.trim() || (newBodyType === 'ring_system' && !newBodyParentId)} loading={creating}>Add</Button>
			</div>
		</section>
	</div>
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
