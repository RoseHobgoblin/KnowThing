<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import { createMutation, createQuery } from '@tanstack/svelte-query'
	import { languageRequest, wordbookEntryRequest } from '../wordbook-client.js'
	import { m } from '$lib/paraglide/messages.js'

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
		queryKey: ['languages', languageSlug, 'dialects'],
		queryFn: () => languageRequest<Array<{ id: number, name: string }>>('GET', languageSlug, 'dialects'),
		enabled: adding,
	}))
	const dialects = $derived(dialectsQuery.data ?? [])
	const addMutation = createMutation(() => ({
		mutationFn: (body: { dialectId: number, pronunciation?: string, spelling?: string }) =>
			wordbookEntryRequest('POST', entryId, 'variants', body),
	}))
	const removeMutation = createMutation(() => ({
		mutationFn: (id: number) => wordbookEntryRequest('DELETE', entryId, `variants/${id}`),
	}))

	// Dialects the entry doesn't already have a variant for
	const availableDialects = $derived(
		dialects.filter(dialect => !variants.some(variant => variant.dialectId === dialect.id)),
	)

	function openAdd() {
		adding = true
	}

	async function addVariant(event: Event) {
		event.preventDefault()
		const dialectId = Number(dialectIdString)
		if (!dialectId || (!pronunciation.trim() && !spelling.trim())) return
		try {
			await addMutation.mutateAsync({
				dialectId,
				pronunciation: pronunciation.trim() || undefined,
				spelling: spelling.trim() || undefined,
			})
			pushSuccess(m.wbc_variant_added())
			adding = false
			dialectIdString = ''
			pronunciation = ''
			spelling = ''
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_add_variant())
		}
	}

	async function removeVariant(variant: Variant) {
		try {
			await removeMutation.mutateAsync(variant.id)
			pushSuccess(m.wbc_variant_removed())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_remove_variant())
		}
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
						aria-label={m.wbc_remove_variant_aria({ name: variant.dialectName })}
						class="text-xs text-error opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-error-hover"
					>{m.common_remove()}</button>
				{/if}
			</div>
		{/each}

		{#if canEdit && !adding}
			<button type="button" onclick={openAdd} class="text-xs text-link hover:text-link-hover hover:underline">
				+ {m.wbc_add_dialect_variant()}
			</button>
		{/if}

		{#if adding}
			{#if dialectsQuery.isError}
				<p class="text-xs text-error">{m.wbc_could_not_load_dialects()}</p>
			{:else if dialectsQuery.isPending}
				<p class="text-xs text-secondary">{m.wbc_loading_dialects()}</p>
			{:else if dialects.length === 0}
				<p class="text-xs text-secondary">
					{m.wbc_no_dialects_add_prefix()}
					<a href="/Wordbook/contribute/language/{languageSlug}" class="text-link hover:underline">{m.wbc_language_edit_page()}</a>.
				</p>
			{:else if availableDialects.length === 0}
				<p class="text-xs text-secondary">{m.wbc_every_dialect_has_variant()}</p>
			{:else}
				<form onsubmit={addVariant} class="flex flex-wrap items-center gap-2 pt-1">
					<select
						bind:value={dialectIdString}
						required
						aria-label={m.wbc_dialect()}
						class="px-2 py-1 text-xs text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="" disabled>{m.wbc_dialect_placeholder()}</option>
						{#each availableDialects as dialect (dialect.id)}
							<option value={String(dialect.id)}>{dialect.name}</option>
						{/each}
					</select>
					<input
						type="text"
						bind:value={pronunciation}
						placeholder="/pronunciation/"
						aria-label={m.wbc_pronunciation()}
						class="px-2 py-1 text-xs font-mono text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					/>
					<input
						type="text"
						bind:value={spelling}
						placeholder={m.wbc_spelling_placeholder()}
						aria-label={m.wbc_spelling()}
						class="px-2 py-1 text-xs text-body bg-surface outline-none focus:ring-2 focus:ring-accent"
					/>
					<button type="submit" disabled={addMutation.isPending} class="px-2.5 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">{m.common_add()}</button>
					<button type="button" onclick={() => adding = false} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}
