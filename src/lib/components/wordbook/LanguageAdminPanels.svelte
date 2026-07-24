<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushError, pushSuccess } from '$lib/notifications.svelte'
	import { createMutation, useQueryClient } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

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
	const queryClient = useQueryClient()

	// ── Dialects ────────────────────────────────────────────────
	let addingDialect = $state(false)
	let dialectName = $state('')
	let dialectRegion = $state('')
	let editingDialectSlug = $state<string | null>(null)
	let editName = $state('')
	let editRegion = $state('')
	const dialectMutation = createMutation(() => ({
		mutationFn: ({ method, slug, body }: {
			method: 'POST' | 'PUT' | 'DELETE'
			slug?: string
			body?: unknown
		}) => api(method, `/api/languages/${languageSlug}/dialects${slug ? `/${slug}` : ''}`, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['languages', languageSlug, 'dialects'] }),
	}))
	const languageDeleteMutation = createMutation(() => ({
		mutationFn: () => api('DELETE', `/api/languages/${languageSlug}`),
	}))

	function slugify(name: string): string {
		return name.trim().toLowerCase().replaceAll(/[^\da-z]+/g, '-').replaceAll(/^-+|-+$/g, '')
	}

	async function addDialect(event: Event) {
		event.preventDefault()
		if (!dialectName.trim()) return
		try {
			await dialectMutation.mutateAsync({ method: 'POST', body: {
				name: dialectName.trim(),
				slug: slugify(dialectName),
				region: dialectRegion.trim() || undefined,
			} })
			pushSuccess(m.wbc_dialect_added({ name: dialectName.trim() }))
			dialectName = ''
			dialectRegion = ''
			addingDialect = false
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_add_dialect())
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
		try {
			await dialectMutation.mutateAsync({
				method: 'PUT',
				slug: editingDialectSlug,
				body: { name: editName.trim(), region: editRegion.trim() || undefined },
			})
			pushSuccess(m.wbc_dialect_updated())
			editingDialectSlug = null
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_update_dialect())
		}
	}

	async function deleteDialect(dialect: Dialect) {
		const confirmed = await confirmDialog.confirm(
			m.wbc_delete_dialect_confirm_title({ name: dialect.name }),
			m.wbc_delete_dialect_confirm_body(),
			m.common_delete(),
		)
		if (!confirmed) return
		try {
			await dialectMutation.mutateAsync({ method: 'DELETE', slug: dialect.slug })
			pushSuccess(m.wbc_dialect_deleted({ name: dialect.name }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_delete_dialect())
		}
	}

	// ── Danger zone ─────────────────────────────────────────────
	async function deleteLanguage() {
		const confirmed = await confirmDialog.confirm(
			m.wbc_delete_language_confirm_title({ name: languageName }),
			m.wbc_delete_language_confirm_body(),
			m.wbc_delete_language_button(),
		)
		if (!confirmed) return
		try {
			await languageDeleteMutation.mutateAsync()
			pushSuccess(m.wbc_language_deleted({ name: languageName }))
			goto('/Wordbook')
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_delete_language())
		}
	}
</script>

<!-- Dialects manager -->
<section class="bg-raised p-4 mb-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-body">{m.wbc_dialects_heading()}</h3>
		{#if isAdmin && !addingDialect}
			<button type="button" onclick={() => addingDialect = true} class="text-xs text-link hover:text-link-hover hover:underline">+ {m.wbc_add_dialect()}</button>
		{/if}
	</div>

	{#if dialects.length === 0 && !addingDialect}
		<p class="text-xs text-secondary">{m.wbc_no_dialects_recorded()}</p>
	{/if}

	<div class="space-y-2">
		{#each dialects as dialect (dialect.id)}
			{#if editingDialectSlug === dialect.slug}
				<form onsubmit={saveEdit} class="flex flex-wrap items-end gap-2">
					<Input label={m.common_name()} bind:value={editName} required />
					<Input label={m.wbc_region()} bind:value={editRegion} />
					<button type="submit" disabled={dialectMutation.isPending} class="px-3 py-1.5 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">{m.common_save()}</button>
					<button type="button" onclick={() => editingDialectSlug = null} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
				</form>
			{:else}
				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-secondary">{dialect.name}</span>
					{#if dialect.region}
						<span class="text-secondary text-xs">({dialect.region})</span>
					{/if}
					{#if isAdmin}
						<span class="ml-auto flex gap-2">
							<button type="button" onclick={() => startEdit(dialect)} class="text-xs text-link hover:text-link-hover hover:underline">{m.common_edit()}</button>
							<button type="button" onclick={() => deleteDialect(dialect)} aria-label={m.wbc_delete_dialect_aria({ name: dialect.name })} class="text-xs text-error hover:text-error-hover hover:underline">{m.common_delete()}</button>
						</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	{#if addingDialect}
		<form onsubmit={addDialect} class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-border-subtle">
			<Input label={m.common_name()} bind:value={dialectName} required placeholder="Northern" />
			<Input label={m.wbc_region()} bind:value={dialectRegion} placeholder="The highlands" />
			<button type="submit" disabled={dialectMutation.isPending} class="px-3 py-1.5 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">{m.common_add()}</button>
			<button type="button" onclick={() => addingDialect = false} class="text-xs text-secondary hover:text-body">{m.common_cancel()}</button>
		</form>
	{/if}
</section>

<!-- Danger zone (admin only) -->
{#if isAdmin}
	<section class="border border-error-border bg-error-bg p-4">
		<h3 class="text-sm font-semibold text-error-text mb-1">{m.common_danger_zone()}</h3>
		<p class="text-xs text-secondary mb-3">
			{m.wbc_language_delete_condition()}
		</p>
		<button
			type="button"
			onclick={deleteLanguage}
			class="px-3 py-1.5 text-xs border border-error-border text-error transition-colors hover:bg-error hover:text-surface"
		>
			{m.wbc_delete_this_language()}
		</button>
	</section>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
