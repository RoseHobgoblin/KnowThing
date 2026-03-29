<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { invalidateAll } from '$app/navigation'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const isAdmin = data.isAdmin

	// Create forms
	let newStarName = $state('')
	let newBodyName = $state('')
	let newBodyType = $state('planet')
	let newBodyStarId = $state<number | null>(null)
	let creatingStar = $state(false)
	let creatingBody = $state(false)

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

	async function createStar() {
		if (!newStarName.trim()) return
		creatingStar = true
		try {
			const res = await fetch('/api/stars', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newStarName.trim(), slug: slugify(newStarName) }),
			})
			if (res.ok) {
				pushSuccess(`Star "${newStarName}" created`)
				newStarName = ''
				invalidateAll()
			} else {
				const err = await res.json()
				pushError(err.error || 'Failed to create star')
			}
		} finally {
			creatingStar = false
		}
	}

	async function createBody() {
		if (!newBodyName.trim()) return
		creatingBody = true
		try {
			const res = await fetch('/api/planetary-bodies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newBodyName.trim(),
					slug: slugify(newBodyName),
					bodyType: newBodyType,
					starId: newBodyStarId,
				}),
			})
			if (res.ok) {
				pushSuccess(`${newBodyName} created`)
				newBodyName = ''
				invalidateAll()
			} else {
				const err = await res.json()
				pushError(err.error || 'Failed to create body')
			}
		} finally {
			creatingBody = false
		}
	}

	async function deleteStar(slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete star', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/stars/${slug}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else {
			pushError('Failed to delete')
		}
	}

	async function deleteBody(slug: string, name: string) {
		const ok = await confirmDialog.confirm('Delete body', `Delete "${name}"?`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/planetary-bodies/${slug}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${name}" deleted`)
			invalidateAll()
		} else {
			pushError('Failed to delete')
		}
	}
</script>

<svelte:head>
	<title>Celestial Registry — KnowThing</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<h1 class="text-2xl font-bold text-heading mb-6">Celestial Registry</h1>

	{#if (data.stars as any[]).length === 0 && (data.bodies as any[]).length === 0}
		<div class="bg-surface border border-border p-8 text-center">
			<p class="text-dim">No celestial bodies registered yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			<!-- Star systems -->
			{#each data.stars as star (star.id)}
				<div class="bg-surface border border-border">
					<div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
						<div class="flex items-center gap-2">
							<span class="text-lg">★</span>
							{#if star.pageSlug}
								<a href="/know/{star.pageSlug}" class="text-heading font-semibold text-lg hover:text-link transition-colors">{star.name}</a>
							{:else}
								<span class="text-heading font-semibold text-lg">{star.name}</span>
							{/if}
							{#if star.spectralType}
								<span class="text-xs text-faint">({star.spectralType})</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 text-xs">
							<span class="text-faint">{star.planetCount} {star.planetCount === 1 ? 'planet' : 'planets'}</span>
							{#if isAdmin}
								<a href="/celestial/{star.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
								<button onclick={() => deleteStar(star.slug, star.name)} class="text-error transition-colors hover:text-error-hover">Delete</button>
							{/if}
						</div>
					</div>

					{#if bodiesForStar(star.id).length > 0}
						<div class="divide-y divide-border-subtle">
							{#each bodiesForStar(star.id) as planet (planet.id)}
								<div class="px-4 py-2.5">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2 ml-4">
											<span class="text-secondary">●</span>
											{#if planet.pageSlug}
												<a href="/know/{planet.pageSlug}" class="text-body font-medium hover:text-link transition-colors">{planet.name}</a>
											{:else}
												<span class="text-body font-medium">{planet.name}</span>
											{/if}
											<span class="text-xs text-faint">({planet.bodyType})</span>
											{#if planet.moonCount > 0}
												<span class="text-xs text-dim">· {planet.moonCount} {planet.moonCount === 1 ? 'moon' : 'moons'}</span>
											{/if}
										</div>
										{#if isAdmin}
											<div class="flex items-center gap-3 text-xs">
												<a href="/celestial/{planet.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
												<button onclick={() => deleteBody(planet.slug, planet.name)} class="text-error transition-colors hover:text-error-hover">×</button>
											</div>
										{/if}
									</div>
									{#each moonsForBody(planet.id) as moon (moon.id)}
										<div class="flex items-center justify-between ml-12 mt-1">
											<div class="flex items-center gap-2">
												<span class="text-faint text-xs">○</span>
												{#if moon.pageSlug}
													<a href="/know/{moon.pageSlug}" class="text-xs text-secondary hover:text-link transition-colors">{moon.name}</a>
												{:else}
													<span class="text-xs text-secondary">{moon.name}</span>
												{/if}
											</div>
											{#if isAdmin}
												<div class="flex items-center gap-3 text-xs">
													<a href="/celestial/{moon.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
													<button onclick={() => deleteBody(moon.slug, moon.name)} class="text-xs text-error transition-colors hover:text-error-hover">×</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Orphan bodies (no star assigned) -->
			{#if orphanBodies().length > 0}
				<div class="bg-surface border border-border">
					<div class="px-4 py-3 border-b border-border-subtle">
						<span class="text-heading font-semibold">Unassigned Bodies</span>
					</div>
					<div class="divide-y divide-border-subtle">
						{#each orphanBodies() as body (body.id)}
							<div class="flex items-center justify-between px-4 py-2.5">
								<div class="flex items-center gap-2">
									<span class="text-secondary">●</span>
									{#if body.pageSlug}
										<a href="/know/{body.pageSlug}" class="text-body font-medium hover:text-link transition-colors">{body.name}</a>
									{:else}
										<span class="text-body font-medium">{body.name}</span>
									{/if}
									<span class="text-xs text-faint">({body.bodyType})</span>
								</div>
								{#if isAdmin}
									<div class="flex items-center gap-3 text-xs">
										<a href="/celestial/{body.slug}" class="text-link transition-colors hover:text-link-hover">Edit</a>
										<button onclick={() => deleteBody(body.slug, body.name)} class="text-error transition-colors hover:text-error-hover">×</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Admin: create forms -->
	{#if isAdmin}
		<div class="mt-8 space-y-4">
			<section class="bg-surface border border-border p-5 space-y-3">
				<h2 class="text-sm font-semibold text-heading">Add Star</h2>
				<div class="flex gap-3 items-end">
					<Input label="Name" bind:value={newStarName} placeholder="e.g. The Sun" containerClass="flex-1" />
					<button onclick={createStar} disabled={creatingStar || !newStarName.trim()} class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
						{creatingStar ? 'Creating...' : 'Add'}
					</button>
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
					<button onclick={createBody} disabled={creatingBody || !newBodyName.trim()} class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50">
						{creatingBody ? 'Creating...' : 'Add'}
					</button>
				</div>
			</section>
		</div>
	{/if}
</div>

<ConfirmDialog bind:this={confirmDialog} />
