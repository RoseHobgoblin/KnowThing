<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { createMutation, createQuery } from '@tanstack/svelte-query'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import { api } from '$lib/api'

	type Variant = {
		id: number
		dialectId: number
		dialectName: string
		pronunciation: string | null
		spelling: string | null
		notes: string | null
	}

	let {
		entryId,
		languageSlug,
		variants = [],
		canEdit = false,
	}: {
		entryId: number
		languageSlug: string
		variants?: Variant[]
		canEdit?: boolean
	} = $props()

	let adding = $state(false)
	let dialectIdString = $state('')
	let pronunciation = $state('')
	let spelling = $state('')


	const dialectsQuery = createQuery(() => ({
		queryKey: ['dialects', languageSlug],
		queryFn: () => api<Array<{ id: number, name: string }>>('GET', `/api/languages/${languageSlug}/dialects`),
		enabled: adding,
	}))

	const dialects = $derived(dialectsQuery.data ?? [])
	const dialectsLoaded = $derived(dialectsQuery.isSuccess)

	$effect(() => {
		if (dialectsQuery.isError) pushError('Could not load dialects')
	})

	// Dialects the entry doesn't already have a variant for
	const availableDialects = $derived(
		dialects.filter(dialect => !variants.some(variant => variant.dialectId === dialect.id)),
	)

	function openAdd() {
		adding = true
	}

	const addVariantMutation = createMutation(() => ({
		mutationFn: () => api('POST', `/api/wordbook/${entryId}/variants`, {
			dialectId: Number(dialectIdString),
			pronunciation: pronunciation.trim() || undefined,
			spelling: spelling.trim() || undefined,
		}),
		onSuccess: async () => {
			pushSuccess('Dialect variant added')
			adding = false
			dialectIdString = ''
			pronunciation = ''
			spelling = ''
			await invalidateAll()
		},
	}))

	const saving = $derived(addVariantMutation.isPending)

	function addVariant(event: Event) {
		event.preventDefault()
		const dialectId = Number(dialectIdString)
		if (!dialectId || (!pronunciation.trim() && !spelling.trim())) return
		addVariantMutation.mutate()
	}

	const removeVariantMutation = createMutation(() => ({
		mutationFn: (variant: Variant) => api('DELETE', `/api/wordbook/${entryId}/variants/${variant.id}`),
		onSuccess: async () => {
			pushSuccess('Variant removed')
			await invalidateAll()
		},
	}))

	function removeVariant(variant: Variant) {
		removeVariantMutation.mutate(variant)
	}
</script>

{#if variants.length > 0 || canEdit}
	<div class="mb-3 space-y-0.5">
		{#each variants as variant (variant.id)}
			<div class="flex items-baseline gap-2 text-sm group">
				<span class="text-dim min-w-24 text-xs font-medium">{variant.dialectName}:</span>
				{#if variant.pronunciation}
					<span class="text-secondary font-mono text-xs">{variant.pronunciation}</span>
				{/if}
				{#if variant.spelling}
					<span class="text-secondary italic">"{variant.spelling}"</span>
				{/if}
				{#if canEdit}
					<button
						type="button"
						onclick={() => removeVariant(variant)}
						aria-label="Remove {variant.dialectName} variant"
						class="text-xs text-error opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-error-hover"
					>remove</button>
				{/if}
			</div>
		{/each}

		{#if canEdit && !adding}
			<button type="button" onclick={openAdd} class="text-xs text-link hover:text-link-hover hover:underline">
				+ Add dialect variant
			</button>
		{/if}

		{#if adding}
			{#if dialectsLoaded && dialects.length === 0}
				<p class="text-xs text-secondary">
					No dialects exist for this language yet — add one on the
					<a href="/Wordbook/contribute/language/{languageSlug}" class="text-link hover:underline">language edit page</a>.
				</p>
			{:else if dialectsLoaded && availableDialects.length === 0}
				<p class="text-xs text-secondary">Every dialect already has a variant. Remove one to change it.</p>
			{:else}
				<form onsubmit={addVariant} class="flex flex-wrap items-center gap-2 pt-1">
					<select
						bind:value={dialectIdString}
						required
						aria-label="Dialect"
						class="px-2 py-1 text-xs text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="" disabled>Dialect…</option>
						{#each availableDialects as dialect (dialect.id)}
							<option value={String(dialect.id)}>{dialect.name}</option>
						{/each}
					</select>
					<input
						type="text"
						bind:value={pronunciation}
						placeholder="/pronunciation/"
						aria-label="Pronunciation"
						class="px-2 py-1 text-xs font-mono text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					/>
					<input
						type="text"
						bind:value={spelling}
						placeholder="spelling"
						aria-label="Spelling"
						class="px-2 py-1 text-xs text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					/>
					<button type="submit" disabled={saving} class="px-2.5 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
					<button type="button" onclick={() => adding = false} class="text-xs text-secondary hover:text-body">Cancel</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}
