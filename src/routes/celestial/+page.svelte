<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const isAdmin = $derived(data.isAdmin)

	let newSystemName = $state('')
	let newStarName = $state('')
	let newStarSystemId = $state<number | null>(null)
	let newBodyName = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<number | null>(null)
	let creating = $state(false)

	function starsForSystem(systemId: number) {
		return (data.stars as any[]).filter((s: any) => s.systemId === systemId)
	}

	function orphanStars() {
		return (data.stars as any[]).filter((s: any) => !s.systemId)
	}

	function bodiesForStar(starId: number) {
		return (data.bodies as any[]).filter((b: any) => b.starId === starId && !b.parentId)
	}

	function orphanBodies() {
		return (data.bodies as any[]).filter((b: any) => !b.starId && !b.parentId)
	}

	function moonsForBody(bodyId: number) {
		return (data.bodies as any[]).filter((b: any) => b.parentId === bodyId)
	}

	function slugify(name: string) {
		return name.trim().toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^a-z0-9-]/g, '')
	}

	async function createSystem() {
		if (!newSystemName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/star-systems', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newSystemName.trim(), slug: slugify(newSystemName) }),
			})
			if (res.ok) {
				pushSuccess(`System "${newSystemName}" created`)
				newSystemName = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	async function createStar() {
		if (!newStarName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/stars', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newStarName.trim(), slug: slugify(newStarName), systemId: newStarSystemId }),
			})
			if (res.ok) {
				pushSuccess(`Star "${newStarName}" created`)
				newStarName = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	async function createBody() {
		if (!newBodyName.trim()) return
		creating = true
		try {
			const res = await fetch('/api/planetary-bodies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newBodyName.trim(), slug: slugify(newBodyName), bodyType: newBodyType, starId: newBodyStarId }),
			})
			if (res.ok) {
				pushSuccess(`${newBodyName} created`)
				newBodyName = ''
				invalidateAll()
			} else {
				const error = await res.json()
				pushError(error.error || 'Failed to create')
			}
		} finally { creating = false }
	}

	async function deleteItem(type: string, slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		const endpoint = type === 'system' ? `/api/star-systems/${slug}` : type === 'star' ? `/api/stars/${slug}` : `/api/planetary-bodies/${slug}`
		const res = await fetch(endpoint, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else pushError('Failed to delete')
	}
</script>

<svelte:head>
	<title>Celestial Registry — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm border border-border overflow-hidden">
	<div class="px-4 pt-4 md:px-6">
		<div class="text-[10px] font-semibold uppercase tracking-wider mb-1">
			<span class="text-accent">Celestial Registry</span>
		</div>
		<h1 class="text-2xl font-bold text-heading md:text-3xl">Celestial Registry</h1>
		<div class="mt-2 h-0.5 bg-gradient-to-r from-accent to-accent-hover"></div>
	</div>

	<div class="px-4 pt-3 pb-4 md:px-6 md:pb-5">

	{#if (data.systems as any[]).length === 0 && orphanStars().length === 0 && orphanBodies().length === 0}
		<div class="bg-surface border border-border p-8 text-center">
			<p class="text-dim">No celestial bodies registered yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.systems as system (system.id)}
				<div class="bg-surface border border-border">
					<!-- System header -->
					<div class="flex items-center justify-between px-4 py-3 bg-raised border-b border-border-subtle">
						<div class="flex items-center gap-2">
							<span class="text-accent text-lg">☉</span>
							<a href="/celestial/{system.slug}" class="text-heading font-bold text-lg hover:text-link transition-colors">{system.name}</a>
							<span class="text-xs text-faint">{system.systemType} · {system.starCount} {system.starCount === 1 ? 'star' : 'stars'} · {system.planetCount} {system.planetCount === 1 ? 'planet' : 'planets'}</span>
						</div>
						{#if isAdmin}
							<div class="flex items-center gap-3 text-xs">
								<a href="/celestial/{system.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
								<button onclick={() => deleteItem('system', system.slug, system.name)} class="text-error transition-colors hover:text-error-hover">Delete</button>
							</div>
						{/if}
					</div>

					<!-- Stars in this system -->
					{#each starsForSystem(system.id) as star (star.id)}
						<div class="border-b border-border-subtle last:border-0">
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2 ml-2">
									<span class="text-secondary">★</span>
									<a href="/celestial/{system.slug}/{star.slug}" class="text-heading font-semibold hover:text-link transition-colors">{star.name}</a>
									{#if star.spectralType}
										<span class="text-xs text-faint">({star.spectralType})</span>
									{/if}
								</div>
								{#if isAdmin}
									<div class="flex items-center gap-3 text-xs">
										<a href="/celestial/{system.slug}/{star.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
										<button onclick={() => deleteItem('star', star.slug, star.name)} class="text-error transition-colors hover:text-error-hover">×</button>
									</div>
								{/if}
							</div>

							<!-- Planets under this star -->
							{#each bodiesForStar(star.id) as planet (planet.id)}
								<div class="flex items-center justify-between px-4 py-1.5 ml-8">
									<div class="flex items-center gap-2">
										<span class="text-dim text-xs">●</span>
										<a href="/celestial/{system.slug}/{planet.slug}" class="text-body text-sm hover:text-link transition-colors">{planet.name}</a>
										<span class="text-xs text-faint">({planet.bodyType})</span>
										{#if planet.moonCount > 0}
											<span class="text-xs text-dim">· {planet.moonCount} {planet.moonCount === 1 ? 'moon' : 'moons'}</span>
										{/if}
									</div>
									{#if isAdmin}
										<div class="flex items-center gap-3 text-xs">
											<a href="/celestial/{system.slug}/{planet.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
											<button onclick={() => deleteItem('body', planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover">×</button>
										</div>
									{/if}
								</div>
								{#each moonsForBody(planet.id) as moon (moon.id)}
									<div class="flex items-center justify-between px-4 py-1 ml-14">
										<div class="flex items-center gap-2">
											<span class="text-faint text-[10px]">○</span>
											<a href="/celestial/{system.slug}/{moon.slug}" class="text-xs text-secondary hover:text-link transition-colors">{moon.name}</a>
										</div>
										{#if isAdmin}
											<div class="flex items-center gap-3 text-xs">
												<a href="/celestial/{system.slug}/{moon.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
												<button onclick={() => deleteItem('body', moon.slug, moon.name)} class="text-xs text-error transition-colors hover:text-error-hover">×</button>
											</div>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
					{/each}
				</div>
			{/each}

			<!-- Orphan stars (no system) -->
			{#if orphanStars().length > 0}
				<div class="bg-surface border border-border p-4">
					<span class="text-xs text-faint uppercase tracking-wide">Unassigned Stars</span>
					{#each orphanStars() as star (star.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<span class="text-secondary">★</span>
								<span class="text-body">{star.name}</span>
								{#if star.spectralType}
									<span class="text-xs text-faint">({star.spectralType})</span>
								{/if}
							</div>
							{#if isAdmin}
								<a href="/celestial/{star.slug}" class="text-xs text-link">Edit</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Orphan bodies (no star) -->
			{#if orphanBodies().length > 0}
				<div class="bg-surface border border-border p-4">
					<span class="text-xs text-faint uppercase tracking-wide">Unassigned Bodies</span>
					{#each orphanBodies() as body (body.id)}
						<div class="flex items-center justify-between py-1.5 mt-1">
							<div class="flex items-center gap-2">
								<span class="text-dim">●</span>
								<span class="text-body">{body.name}</span>
								<span class="text-xs text-faint">({body.bodyType})</span>
							</div>
							{#if isAdmin}
								<a href="/celestial/{body.slug}" class="text-xs text-link">Edit</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Admin: create forms -->
	{#if isAdmin}
		<div class="mt-8 space-y-4">
			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add System</h2>
				<div class="flex gap-3 items-end">
					<Input label="Name" bind:value={newSystemName} placeholder="e.g. Sunly system" containerClass="flex-1" />
					<button onclick={createSystem} disabled={creating || !newSystemName.trim()} class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">Add</button>
				</div>
			</section>

			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add Star</h2>
				<div class="flex gap-3 items-end">
					<Input label="Name" bind:value={newStarName} placeholder="e.g. The Sun" containerClass="flex-1" />
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">System</span>
						<select bind:value={newStarSystemId} class="px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							<option value={null}>None</option>
							{#each data.systems as sys (sys.id)}
								<option value={sys.id}>{sys.name}</option>
							{/each}
						</select>
					</div>
					<button onclick={createStar} disabled={creating || !newStarName.trim()} class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">Add</button>
				</div>
			</section>

			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add Body</h2>
				<div class="flex gap-3 items-end flex-wrap">
					<Input label="Name" bind:value={newBodyName} placeholder="e.g. Earth" containerClass="flex-1 min-w-40" />
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Type</span>
						<select bind:value={newBodyType} class="px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							<option value="planet">Planet</option>
							<option value="moon">Moon</option>
							<option value="dwarf_planet">Dwarf planet</option>
							<option value="asteroid">Asteroid</option>
						</select>
					</div>
					<div>
						<span class="text-xs font-medium text-secondary block mb-1">Star</span>
						<select bind:value={newBodyStarId} class="px-2 py-2 text-sm border border-border-strong bg-surface text-body outline-none transition-colors hover:border-border focus:ring-2 focus:ring-accent">
							<option value={null}>None</option>
							{#each data.stars as star (star.id)}
								<option value={star.id}>{star.name}</option>
							{/each}
						</select>
					</div>
					<button onclick={createBody} disabled={creating || !newBodyName.trim()} class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">Add</button>
				</div>
			</section>
		</div>
	{/if}
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
