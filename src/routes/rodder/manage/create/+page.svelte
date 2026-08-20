<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types.js'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api.js'
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import { rodderPresets, type RodderPreset } from '$lib/feature/rodder/presets.js'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { cn } from '$lib/utils.js'
	import { pushError, pushSuccess } from '$lib/notifications.svelte.js'
	import SunDim from 'phosphor-svelte/lib/SunDim'
	import StarIcon from 'phosphor-svelte/lib/Star'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Stack from 'phosphor-svelte/lib/Stack'

	let { data }: { data: PageData } = $props()

	type CreateKind = 'system' | 'star' | 'body' | 'preset'
	type Created = { slug: string, name: string }
	type RegistryBody = { id: number, name: string, starId: number | null }

	const systems = $derived(data.systems as unknown as Array<{ id: number, name: string }>)
	const stars = $derived(data.stars as unknown as Array<{ id: number, name: string }>)
	const bodies = $derived(data.bodies as unknown as RegistryBody[])
	const sectors = $derived(data.sectors as unknown as Array<{ id: number, name: string, units: string }>)

	let kind = $state<CreateKind>('system')
	let name = $state('')
	let systemSectorId = $state<string>(String(untrack(() => sectors[0]?.id) ?? ''))
	let systemX = $state<number | null>(null)
	let systemY = $state<number | null>(null)
	let systemZ = $state<number | null>(null)
	let starSystemId = $state<string>('')
	let bodyType = $state('planet')
	let bodyPlacement = $state<'orbit' | 'sector'>('orbit')
	let bodyStarId = $state<string>('')
	let bodyParentId = $state<string>('')
	let bodySectorId = $state<string>(String(untrack(() => sectors[0]?.id) ?? ''))
	let bodyX = $state<number | null>(null)
	let bodyY = $state<number | null>(null)
	let bodyZ = $state<number | null>(null)
	let saving = $state(false)

	const bodyParentOptions = $derived(
		bodyStarId ? bodies.filter(body => body.starId === Number(bodyStarId)) : [],
	)
	const validBodyParentId = $derived(
		bodyParentOptions.some(body => String(body.id) === bodyParentId) ? bodyParentId : '',
	)
	const positionComplete = $derived(
		[systemX, systemY, systemZ].every(value => value != null)
		|| [systemX, systemY, systemZ].every(value => value == null),
	)
	const bodyPositionComplete = $derived(
		[bodyX, bodyY, bodyZ].every(value => value != null)
		|| [bodyX, bodyY, bodyZ].every(value => value == null),
	)
	const canCreate = $derived.by(() => {
		if (!name.trim() || saving) return false
		if (kind === 'system') return !!systemSectorId && positionComplete
		if (kind === 'star') return !!starSystemId
		if (kind === 'body') {
			if (bodyPlacement === 'sector') return bodyType !== 'ring_system' && !!bodySectorId && bodyPositionComplete
			return !!bodyStarId && (bodyType !== 'ring_system' || !!validBodyParentId)
		}
		return false
	})
	const namePlaceholder = $derived(
		kind === 'system' ? 'e.g. Sunly system' : (kind === 'star' ? 'e.g. The Sun' : 'e.g. Earth'),
	)

	const kindOptions = [
		{ id: 'system' as const, label: 'System', help: 'A positioned root in a sector', icon: SunDim },
		{ id: 'star' as const, label: 'Star', help: 'A luminous member of a system', icon: StarIcon },
		{ id: 'body' as const, label: 'Body', help: 'A planet, asteroid, moon, or ring', icon: Planet },
		{ id: 'preset' as const, label: 'Preset', help: 'Seed a complete reference system', icon: Stack },
	]

	function chooseKind(next: CreateKind) {
		kind = next
		name = ''
	}

	async function createEntity() {
		if (!canCreate || kind === 'preset') return
		saving = true
		try {
			const common = { kind, name: name.trim(), slug: urlSlugify(name) }
			let payload: Record<string, unknown>
			if (kind === 'system') {
				payload = {
					...common,
					sectorId: Number(systemSectorId),
					sectorX: systemX,
					sectorY: systemY,
					sectorZ: systemZ,
				}
			} else if (kind === 'star') {
				payload = { ...common, parentId: Number(starSystemId) }
			} else {
				payload = bodyPlacement === 'sector'
					? {
						...common,
						bodyType,
						parentId: null,
						sectorId: Number(bodySectorId),
						sectorX: bodyX,
						sectorY: bodyY,
						sectorZ: bodyZ,
					}
					: {
						...common,
						bodyType,
						parentId: validBodyParentId ? Number(validBodyParentId) : Number(bodyStarId),
					}
			}
			const created = await api<Created>('POST', '/api/rodder', payload)
			pushSuccess(`“${created.name}” created`)
			await goto(resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${created.slug}/configure` }))
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Create failed')
		} finally {
			saving = false
		}
	}

	async function createPreset(preset: RodderPreset) {
		saving = true
		try {
			const created = await api<Created>('POST', '/api/rodder/preset', { preset: preset.label })
			pushSuccess(`“${created.name}” created with its stars and bodies`)
			await goto(resolve('/[...ns_path=namespaced]', { ns_path: `Rodder:${created.slug}` }))
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Preset creation failed')
		} finally {
			saving = false
		}
	}
</script>

<div class="mb-4">
	<h2 class="text-lg font-semibold text-heading">Create</h2>
	<p class="mt-1 max-w-2xl text-sm text-secondary">Start with the object’s place in the hierarchy. Detailed physical and presentation fields open immediately after creation.</p>
</div>

<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
	{#each kindOptions as option (option.id)}
		{@const Icon = option.icon}
		<button
			type="button"
			onclick={() => chooseKind(option.id)}
			class={cn(
				'flex items-start gap-3 border p-3 text-left transition-colors',
				kind === option.id ? 'border-accent-border bg-accent-subtle' : 'border-border-subtle bg-surface hover:bg-raised',
			)}
		>
			<Icon size={20} weight={kind === option.id ? 'fill' : 'regular'} class="mt-0.5 shrink-0 text-accent" />
			<span><span class="block text-sm font-semibold text-heading">{option.label}</span><span class="mt-0.5 block text-xs text-secondary">{option.help}</span></span>
		</button>
	{/each}
</div>

<section class="mt-4 border border-border-subtle bg-surface p-5">
	{#if kind === 'preset'}
		<h3 class="text-sm font-semibold text-heading">Complete system presets</h3>
		<p class="mt-1 text-xs text-secondary">Each preset is created atomically: the entire hierarchy succeeds or nothing is written.</p>
		<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each rodderPresets as preset (preset.label)}
				<button type="button" disabled={saving} onclick={() => createPreset(preset)} class="border border-border-subtle bg-page p-4 text-left transition-colors hover:border-accent-border hover:bg-raised disabled:opacity-50">
					<span class="block font-semibold text-heading">{preset.label}</span>
					<span class="mt-1 block text-xs text-secondary">{preset.stars.length} {preset.stars.length === 1 ? 'star' : 'stars'} · {preset.system.name}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="space-y-4">
			<div>
				<h3 class="text-sm font-semibold text-heading">New {kind}</h3>
				<p class="mt-1 text-xs text-secondary">Only the structural fields are required here. You’ll configure the full record next.</p>
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Input label="Name" bind:value={name} placeholder={namePlaceholder} onsubmit={createEntity} />

				{#if kind === 'system'}
					<Select type="single" label="Sector" bind:value={systemSectorId} items={sectors.map(sector => ({ value: String(sector.id), label: `${sector.name} (${sector.units})` }))} />
				{:else if kind === 'star'}
					<Select type="single" label="System" bind:value={starSystemId} items={systems.map(system => ({ value: String(system.id), label: system.name }))} placeholder="Choose a system" />
				{:else}
					<Select type="single" label="Body type" bind:value={bodyType} items={[
						{ value: 'planet', label: 'Planet or moon' },
						{ value: 'asteroid', label: 'Asteroid' },
						{ value: 'ring_system', label: 'Ring system' },
					]} />
					<Select type="single" label="Placement" bind:value={bodyPlacement} items={[
						{ value: 'orbit', label: 'Orbiting another object' },
						{ value: 'sector', label: 'Independent sector root' },
					]} />
					{#if bodyPlacement === 'orbit'}
						<Select type="single" label="Primary star" bind:value={bodyStarId} items={stars.map(star => ({ value: String(star.id), label: star.name }))} placeholder="Choose a star" />
						<Select type="single" label="Orbits body (optional)" bind:value={bodyParentId} disabled={!bodyStarId || bodyParentOptions.length === 0} items={bodyParentOptions.map(body => ({ value: String(body.id), label: body.name }))} placeholder={bodyStarId ? 'None — orbits the star' : 'Choose a star first'} />
					{:else}
						<Select type="single" label="Sector" bind:value={bodySectorId} items={sectors.map(sector => ({ value: String(sector.id), label: `${sector.name} (${sector.units})` }))} />
					{/if}
				{/if}
			</div>

			{#if kind === 'system'}
				<div>
					<div class="mb-2 flex items-baseline justify-between gap-3">
						<h4 class="text-xs font-semibold tracking-wider text-secondary uppercase">Initial sector position</h4>
						<span class="text-xs text-dim">Optional, but enter all three coordinates together.</span>
					</div>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Input label="X" type="number" step="any" bind:value={systemX} error={positionComplete ? '' : 'Complete all three coordinates'} />
						<Input label="Y" type="number" step="any" bind:value={systemY} error={positionComplete ? '' : 'Complete all three coordinates'} />
						<Input label="Z" type="number" step="any" bind:value={systemZ} error={positionComplete ? '' : 'Complete all three coordinates'} />
					</div>
				</div>
			{:else if kind === 'body' && bodyPlacement === 'sector'}
				<div>
					<div class="mb-2 flex items-baseline justify-between gap-3">
						<h4 class="text-xs font-semibold tracking-wider text-secondary uppercase">Initial sector position</h4>
						<span class="text-xs text-dim">Optional, but enter all three coordinates together.</span>
					</div>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Input label="X" type="number" step="any" bind:value={bodyX} error={bodyPositionComplete ? '' : 'Complete all three coordinates'} />
						<Input label="Y" type="number" step="any" bind:value={bodyY} error={bodyPositionComplete ? '' : 'Complete all three coordinates'} />
						<Input label="Z" type="number" step="any" bind:value={bodyZ} error={bodyPositionComplete ? '' : 'Complete all three coordinates'} />
					</div>
					{#if bodyType === 'ring_system'}
						<p class="mt-2 text-xs text-accent">A ring system must orbit a body and cannot be an independent root.</p>
					{/if}
				</div>
			{/if}

			<div class="flex justify-end border-t border-border-subtle pt-4">
				<Button onclick={createEntity} disabled={!canCreate} loading={saving}>Create and configure</Button>
			</div>
		</div>
	{/if}
</section>

{#if (kind === 'system' || (kind === 'body' && bodyPlacement === 'sector')) && sectors.length === 0}
	<div class="mt-3 border border-warning-border bg-warning-bg p-3 text-sm text-body">
		Create a <a href={resolve('/rodder/manage/sectors')} class="text-link hover:text-link-hover">sector frame</a> before adding an independent root.
	</div>
{/if}
