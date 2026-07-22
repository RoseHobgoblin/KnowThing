<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { createMutation } from '@tanstack/svelte-query'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import { api } from '$lib/api'

	type Dialect = { id: number, name: string, slug: string, region: string | null, description: string | null }

	let {
		languageSlug,
		languageName,
		dialects = [],
		isAdmin = false,
	}: {
		languageSlug: string
		languageName: string
		dialects?: Dialect[]
		isAdmin?: boolean
	} = $props()

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	// ── Dialects ────────────────────────────────────────────────
	let addingDialect = $state(false)
	let dialectName = $state('')
	let dialectRegion = $state('')
	let editingDialectSlug = $state<string | null>(null)
	let editName = $state('')
	let editRegion = $state('')

	function slugify(name: string): string {
		return name.trim().toLowerCase().replaceAll(/[^\da-z]+/g, '-').replaceAll(/^-+|-+$/g, '')
	}

	const onError = (error: Error) => pushError(error.message)

	const addDialectMutation = createMutation(() => ({
		mutationFn: () => api('POST', `/api/languages/${languageSlug}/dialects`, {
			name: dialectName.trim(),
			slug: slugify(dialectName),
			region: dialectRegion.trim() || undefined,
		}),
		onSuccess: async () => {
			pushSuccess(`Dialect "${dialectName.trim()}" added`)
			dialectName = ''
			dialectRegion = ''
			addingDialect = false
			await invalidateAll()
		},
		onError,
	}))

	function addDialect(event: Event) {
		event.preventDefault()
		if (dialectName.trim()) addDialectMutation.mutate()
	}

	function startEdit(dialect: Dialect) {
		editingDialectSlug = dialect.slug
		editName = dialect.name
		editRegion = dialect.region ?? ''
	}

	const saveEditMutation = createMutation(() => ({
		mutationFn: () => api('PUT', `/api/languages/${languageSlug}/dialects/${editingDialectSlug}`, {
			name: editName.trim(),
			region: editRegion.trim() || undefined,
		}),
		onSuccess: async () => {
			pushSuccess('Dialect updated')
			editingDialectSlug = null
			await invalidateAll()
		},
		onError,
	}))

	function saveEdit(event: Event) {
		event.preventDefault()
		if (editingDialectSlug && editName.trim()) saveEditMutation.mutate()
	}

	const savingDialect = $derived(addDialectMutation.isPending || saveEditMutation.isPending)

	const deleteDialectMutation = createMutation(() => ({
		mutationFn: (dialect: Dialect) => api('DELETE', `/api/languages/${languageSlug}/dialects/${dialect.slug}`),
		onSuccess: async (_data, dialect) => {
			pushSuccess(`Dialect "${dialect.name}" deleted`)
			await invalidateAll()
		},
		onError,
	}))

	async function deleteDialect(dialect: Dialect) {
		const confirmed = await confirmDialog.confirm(
			`Delete dialect "${dialect.name}"?`,
			'Dialect variants recorded against it will be removed. This cannot be undone.',
			'Delete',
		)
		if (confirmed) deleteDialectMutation.mutate(dialect)
	}

	// ── Danger zone ─────────────────────────────────────────────
	const deleteLanguageMutation = createMutation(() => ({
		mutationFn: () => api('DELETE', `/api/languages/${languageSlug}`),
		onSuccess: () => {
			pushSuccess(`"${languageName}" deleted`)
			goto('/Wordbook')
		},
		onError,
	}))

	async function deleteLanguage() {
		const confirmed = await confirmDialog.confirm(
			`Delete "${languageName}"?`,
			'Deletion is refused while the language still has entries or descendant languages. This cannot be undone.',
			'Delete language',
		)
		if (confirmed) deleteLanguageMutation.mutate()
	}
</script>

<!-- Dialects manager -->
<section class="bg-raised p-4 mb-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-body">Dialects</h3>
		{#if isAdmin && !addingDialect}
			<button type="button" onclick={() => addingDialect = true} class="text-xs text-link hover:text-link-hover hover:underline">+ Add dialect</button>
		{/if}
	</div>

	{#if dialects.length === 0 && !addingDialect}
		<p class="text-xs text-secondary">No dialects recorded.</p>
	{/if}

	<div class="space-y-2">
		{#each dialects as dialect (dialect.id)}
			{#if editingDialectSlug === dialect.slug}
				<form onsubmit={saveEdit} class="flex flex-wrap items-end gap-2">
					<Input label="Name" bind:value={editName} required />
					<Input label="Region" bind:value={editRegion} />
					<button type="submit" disabled={savingDialect} class="px-3 py-1.5 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Save</button>
					<button type="button" onclick={() => editingDialectSlug = null} class="text-xs text-secondary hover:text-body">Cancel</button>
				</form>
			{:else}
				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-secondary">{dialect.name}</span>
					{#if dialect.region}
						<span class="text-secondary text-xs">({dialect.region})</span>
					{/if}
					{#if isAdmin}
						<span class="ml-auto flex gap-2">
							<button type="button" onclick={() => startEdit(dialect)} class="text-xs text-link hover:text-link-hover hover:underline">Edit</button>
							<button type="button" onclick={() => deleteDialect(dialect)} aria-label="Delete dialect {dialect.name}" class="text-xs text-error hover:text-error-hover hover:underline">Delete</button>
						</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	{#if addingDialect}
		<form onsubmit={addDialect} class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-border-subtle">
			<Input label="Name" bind:value={dialectName} required placeholder="Northern" />
			<Input label="Region" bind:value={dialectRegion} placeholder="The highlands" />
			<button type="submit" disabled={savingDialect} class="px-3 py-1.5 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
			<button type="button" onclick={() => addingDialect = false} class="text-xs text-secondary hover:text-body">Cancel</button>
		</form>
	{/if}
</section>

<!-- Danger zone (admin only) -->
{#if isAdmin}
	<section class="border border-error-border bg-error-bg p-4">
		<h3 class="text-sm font-semibold text-error-text mb-1">Danger zone</h3>
		<p class="text-xs text-secondary mb-3">
			A language can only be deleted once it has no entries and no descendant languages.
		</p>
		<button
			type="button"
			onclick={deleteLanguage}
			class="px-3 py-1.5 text-xs border border-error-border text-error transition-colors hover:bg-error hover:text-surface"
		>
			Delete this language
		</button>
	</section>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
