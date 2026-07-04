<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'

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
	let savingDialect = $state(false)
	let editingDialectSlug = $state<string | null>(null)
	let editName = $state('')
	let editRegion = $state('')

	function slugify(name: string): string {
		return name.trim().toLowerCase().replaceAll(/[^\da-z]+/g, '-').replaceAll(/^-+|-+$/g, '')
	}

	async function addDialect(event: Event) {
		event.preventDefault()
		if (!dialectName.trim()) return
		savingDialect = true
		try {
			const response = await fetch(`/api/languages/${languageSlug}/dialects`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: dialectName.trim(),
					slug: slugify(dialectName),
					region: dialectRegion.trim() || undefined,
				}),
			})
			if (!response.ok) {
				const body = await response.json()
				throw new Error(body.error || 'Failed to add dialect')
			}
			pushSuccess(`Dialect "${dialectName.trim()}" added`)
			dialectName = ''
			dialectRegion = ''
			addingDialect = false
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to add dialect')
		} finally {
			savingDialect = false
		}
	}

	function startEdit(dialect: Dialect) {
		editingDialectSlug = dialect.slug
		editName = dialect.name
		editRegion = dialect.region ?? ''
	}

	async function saveEdit(event: Event) {
		event.preventDefault()
		if (!editingDialectSlug || !editName.trim()) return
		savingDialect = true
		try {
			const response = await fetch(`/api/languages/${languageSlug}/dialects/${editingDialectSlug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editName.trim(), region: editRegion.trim() || undefined }),
			})
			if (!response.ok) {
				const body = await response.json()
				throw new Error(body.error || 'Failed to update dialect')
			}
			pushSuccess('Dialect updated')
			editingDialectSlug = null
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to update dialect')
		} finally {
			savingDialect = false
		}
	}

	async function deleteDialect(dialect: Dialect) {
		const confirmed = await confirmDialog.confirm(
			`Delete dialect "${dialect.name}"?`,
			'Dialect variants recorded against it will be removed. This cannot be undone.',
			'Delete',
		)
		if (!confirmed) return
		try {
			const response = await fetch(`/api/languages/${languageSlug}/dialects/${dialect.slug}`, { method: 'DELETE' })
			if (!response.ok) {
				const body = await response.json()
				throw new Error(body.error || 'Failed to delete dialect')
			}
			pushSuccess(`Dialect "${dialect.name}" deleted`)
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to delete dialect')
		}
	}

	// ── Danger zone ─────────────────────────────────────────────
	async function deleteLanguage() {
		const confirmed = await confirmDialog.confirm(
			`Delete "${languageName}"?`,
			'Deletion is refused while the language still has entries or descendant languages. This cannot be undone.',
			'Delete language',
		)
		if (!confirmed) return
		try {
			const response = await fetch(`/api/languages/${languageSlug}`, { method: 'DELETE' })
			if (!response.ok) {
				const body = await response.json()
				throw new Error(body.error || 'Failed to delete language')
			}
			pushSuccess(`"${languageName}" deleted`)
			goto('/Wordbook')
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to delete language')
		}
	}
</script>

<!-- Dialects manager -->
<section class="bg-raised border border-border-subtle p-4 mb-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-body">Dialects</h3>
		{#if isAdmin && !addingDialect}
			<button type="button" onclick={() => addingDialect = true} class="text-xs text-link hover:text-link-hover hover:underline">+ Add dialect</button>
		{/if}
	</div>

	{#if dialects.length === 0 && !addingDialect}
		<p class="text-xs text-faint">No dialects recorded.</p>
	{/if}

	<div class="space-y-2">
		{#each dialects as dialect (dialect.id)}
			{#if editingDialectSlug === dialect.slug}
				<form onsubmit={saveEdit} class="flex flex-wrap items-end gap-2">
					<Input label="Name" bind:value={editName} required />
					<Input label="Region" bind:value={editRegion} />
					<button type="submit" disabled={savingDialect} class="px-3 py-1.5 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Save</button>
					<button type="button" onclick={() => editingDialectSlug = null} class="text-xs text-faint hover:text-secondary">Cancel</button>
				</form>
			{:else}
				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-secondary">{dialect.name}</span>
					{#if dialect.region}
						<span class="text-faint text-xs">({dialect.region})</span>
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
			<button type="button" onclick={() => addingDialect = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
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
