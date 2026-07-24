<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { invalidateAll, goto } from '$app/navigation'
	import { normalizePermissions } from '$lib/permissions.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import { createMutation, useQueryClient } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	const initialFile = $state.snapshot(untrack(() => data.file))
	const initialCategories = $state.snapshot(untrack(() => data.categories))
	const initialDetails = {
		description: initialFile.description || '',
		categoriesInput: initialCategories.join(', '),
	}

	let description = $state(initialDetails.description)
	let categoriesInput = $state(initialDetails.categoriesInput)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	let copied = $state(false)
	let confirmDialog: ReturnType<typeof ConfirmDialog>
	let stablePermissions = $state(normalizePermissions(data.permissions))
	const queryClient = useQueryClient()
	const mediaUrl = $derived(`/api/media/${encodeURIComponent(data.file.filename)}`)
	const saveMutation = createMutation(() => ({
		mutationFn: (body: { description: string, categories: string[] }) => api('PUT', mediaUrl, body),
	}))
	const deleteMutation = createMutation(() => ({ mutationFn: () => api('DELETE', mediaUrl) }))
	const versionMutation = createMutation(() => ({
		mutationFn: (body: { action: 'restore', version: number } | { action: 'rename', newFilename: string }) =>
			api<{ newFilename?: string, rewrittenPages?: number }>('PATCH', mediaUrl, body),
	}))
	const replaceMutation = createMutation(() => ({
		mutationFn: async (file: File) => {
			const formData = new FormData()
			formData.set('file', file)
			const response = await fetch(mediaUrl, { method: 'POST', body: formData })
			if (!response.ok) {
				const payload = await response.json().catch(() => null) as { error?: string } | null
				throw new Error(payload?.error ?? m.media_replace_failed())
			}
		},
	}))
	const saving = $derived(saveMutation.isPending)
	const replacing = $derived(replaceMutation.isPending)
	const renaming = $derived(versionMutation.isPending)

	const layoutData = $derived($page.data)
	const permissions = $derived(stablePermissions)
	const canManageMedia = $derived(permissions.canManageMedia)
	const currentSnapshot = $derived(JSON.stringify({ description, categoriesInput }))
	let savedSnapshot = $state(JSON.stringify(initialDetails))
	const isDirty = $derived(currentSnapshot !== savedSnapshot)

	$effect(() => {
		if (layoutData.permissions !== undefined) {
			stablePermissions = normalizePermissions(layoutData.permissions)
		}
	})

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '-'
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / 1048576).toFixed(1)} MB`
	}

	function resetDraft() {
		description = initialDetails.description
		categoriesInput = initialDetails.categoriesInput
		saveError = ''
	}

	async function saveDetails() {
		saveError = ''
		try {
			await saveMutation.mutateAsync({
				description: description.trim(),
				categories: categoriesInput ? categoriesInput.split(',').map(c => c.trim()).filter(Boolean) : [],
			})
			savedSnapshot = currentSnapshot
			savedAt = new Date()
			await queryClient.invalidateQueries({ queryKey: ['media'] })
			pushSuccess(m.media_details_saved())
			await invalidateAll()
		} catch (error) {
			saveError = error instanceof Error ? error.message : m.media_save_details_failed()
			pushError(saveError)
		}
	}

	async function deleteFile() {
		const ok = await confirmDialog.confirm(
			m.media_delete_file(),
			`${m.media_delete_confirm({ name: data.file.filename })}${data.usage.length > 0 ? m.media_delete_warning({ count: data.usage.length }) : ''}`,
			m.media_delete_file(),
			m.common_cancel(),
		)
		if (!ok) return
		try {
			await deleteMutation.mutateAsync()
			await queryClient.invalidateQueries({ queryKey: ['media'] })
			pushSuccess(m.media_file_deleted())
			goto('/dashboard/media')
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.media_delete_failed())
		}
	}

	function copyWikitext() {
		navigator.clipboard.writeText(`[[File:${data.file.filename}|thumb|Caption]]`)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	let replaceInput: HTMLInputElement | undefined

	async function onReplaceFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		input.value = ''
		try {
			await replaceMutation.mutateAsync(file)
			await queryClient.invalidateQueries({ queryKey: ['media'] })
			pushSuccess(m.media_uploaded_new_version())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.media_replace_failed())
		}
	}

	async function restoreVersion(version: number) {
		const ok = await confirmDialog.confirm(
			m.media_restore_version(),
			m.media_restore_confirm({ version }),
			m.media_restore(),
			m.common_cancel(),
		)
		if (!ok) return
		try {
			await versionMutation.mutateAsync({ action: 'restore', version })
			await queryClient.invalidateQueries({ queryKey: ['media'] })
			pushSuccess(m.media_restored_toast({ version }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.media_restore_failed())
		}
	}

	let renameInput = $state(data.file.filename)
	let renameOpen = $state(false)

	async function submitRename() {
		const target = renameInput.trim()
		if (!target || target === data.file.filename) {
			renameOpen = false
			return
		}
		try {
			const body = await versionMutation.mutateAsync({ action: 'rename', newFilename: target })
			await queryClient.invalidateQueries({ queryKey: ['media'] })
			const finalName: string = body.newFilename ?? target
			pushSuccess(m.media_renamed_toast({ name: finalName, count: body.rewrittenPages ?? 0 }))
			renameOpen = false
			goto(`/media/${encodeURIComponent(finalName)}`)
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.media_rename_failed())
		}
	}
</script>

<svelte:head>
	<title>{m.media_page_title({ filename: data.file.filename })}</title>
</svelte:head>

<UnsavedChangesGuard when={isDirty && !saving} />

<div class="space-y-6">
	<nav class="text-sm text-dim">
		{#if canManageMedia}
			<a href="/dashboard/media" class="hover:text-link">{m.media_breadcrumb()}</a>
			<span class="mx-1">></span>
		{/if}
		<span class="text-secondary">{data.file.filename}</span>
	</nav>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<div class="bg-surface overflow-hidden">
				<div class="bg-raised p-4 flex items-center justify-center min-h-75">
					<img
						src="/api/media/{data.file.filename}"
						alt={data.file.filename}
						class="max-w-full max-h-150 object-contain shadow-sm"
					/>
				</div>

				{#if data.file.hasThumb150 || data.file.hasThumb300 || data.file.hasThumb600}
					<div class="px-4 py-3 border-t border-border-subtle">
						<div class="text-xs font-medium text-dim mb-2">{m.media_thumbnails()}</div>
						<div class="flex gap-3">
							{#if data.file.hasThumb150}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=150" alt="150px" class="h-16 object-contain" />
									<span class="text-xs text-secondary block mt-1">150px</span>
								</div>
							{/if}
							{#if data.file.hasThumb300}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=300" alt="300px" class="h-16 object-contain" />
									<span class="text-xs text-secondary block mt-1">300px</span>
								</div>
							{/if}
							{#if data.file.hasThumb600}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=600" alt="600px" class="h-16 object-contain" />
									<span class="text-xs text-secondary block mt-1">600px</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			{#if canManageMedia}
				<div class="bg-surface p-4 mt-4 space-y-4">
					<RecordModeBanner
						modeLabel={m.media_mode_label()}
						title={m.media_file_details()}
						description={m.media_file_details_desc()}
					/>

					{#if saveError}
						<FormNotice title={m.media_not_saved()} message={saveError} />
					{/if}

					<div class="space-y-3">
						<div>
							<label for="desc" class="block text-xs font-medium text-secondary mb-1">{m.common_description()}</label>
							<textarea
								id="desc"
								bind:value={description}
								rows={3}
								class="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
								placeholder={m.media_describe_placeholder()}
							></textarea>
						</div>
						<div>
							<Input
								id="cats"
								label={m.media_categories()}
								hint={m.media_comma_separated()}
								type="text"
								bind:value={categoriesInput}
								placeholder={m.media_categories_placeholder()}
							/>
						</div>
					</div>
				</div>
			{:else if data.file.description}
				<div class="bg-surface p-4 mt-4">
					<h3 class="text-sm font-semibold text-body mb-2">{m.common_description()}</h3>
					<p class="text-sm text-body whitespace-pre-wrap">{data.file.description}</p>
				</div>
			{/if}
		</div>

		<div class="space-y-4">
			<div class="bg-surface p-4">
				<h3 class="text-sm font-semibold text-body mb-3">{m.media_file_info()}</h3>
				<dl class="text-sm space-y-2">
					<div class="flex justify-between">
						<dt class="text-dim">{m.media_filename()}</dt>
						<dd class="text-body font-mono text-xs">{data.file.filename}</dd>
					</div>
					{#if data.file.originalFilename && data.file.originalFilename !== data.file.filename}
						<div class="flex justify-between">
							<dt class="text-dim">{m.media_original()}</dt>
							<dd class="text-body text-xs">{data.file.originalFilename}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-dim">{m.common_type()}</dt>
						<dd class="text-body">{data.file.mimeType}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-dim">{m.media_size()}</dt>
						<dd class="text-body">{formatBytes(data.file.sizeBytes)}</dd>
					</div>
					{#if data.file.width && data.file.height}
						<div class="flex justify-between">
							<dt class="text-dim">{m.media_dimensions()}</dt>
							<dd class="text-body">{data.file.width} x {data.file.height}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-dim">{m.media_uploaded()}</dt>
						<dd class="text-body">{new Date(data.file.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
					</div>
					{#if data.uploaderName}
						<div class="flex justify-between">
							<dt class="text-dim">{m.media_by()}</dt>
							<dd class="text-body">{data.uploaderName}</dd>
						</div>
					{/if}
				</dl>
			</div>

			<div class="bg-surface p-4">
				<h3 class="text-sm font-semibold text-body mb-3">{m.media_actions()}</h3>
				<div class="space-y-2">
					{#if canManageMedia}
						<button onclick={copyWikitext} class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle">
							{copied ? m.media_copied() : m.media_copy_wikitext()}
						</button>
					{/if}
					<a href="/api/media/{data.file.filename}" target="_blank" class="block px-3 py-2 text-sm text-secondary transition-colors hover:bg-page">
						{m.media_view_full_size()} ->
					</a>
					{#if data.file.mimeType === 'image/svg+xml'}
						<a href="/api/media/{data.file.filename}?format=svg" target="_blank" download class="block px-3 py-2 text-sm text-secondary transition-colors hover:bg-page">
							{m.media_download_svg()} ->
						</a>
					{/if}
					{#if canManageMedia}
						<button
							type="button"
							onclick={() => replaceInput?.click()}
							disabled={replacing}
							class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle disabled:opacity-50"
						>
							{replacing ? m.media_uploading() : m.media_upload_new_version()}
						</button>
						<input
							bind:this={replaceInput}
							type="file"
							class="hidden"
							onchange={onReplaceFile}
							accept={data.file.mimeType ?? '*/*'}
						/>
						<button
							type="button"
							onclick={() => {
								renameOpen = !renameOpen
								renameInput = data.file.filename
							}}
							class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle"
						>
							{m.media_rename_file()}
						</button>
						{#if renameOpen}
							<div class="px-3 py-2 space-y-2 bg-raised">
								<Input
									id="rename"
									label={m.media_new_filename()}
									hint={m.media_rename_hint()}
									type="text"
									bind:value={renameInput}
								/>
								<div class="flex gap-2">
									<button
										type="button"
										onclick={submitRename}
										disabled={renaming}
										class="px-3 py-1.5 text-sm bg-accent text-white disabled:opacity-50"
									>
										{renaming ? m.media_renaming() : m.media_rename()}
									</button>
									<button
										type="button"
										onclick={() => { renameOpen = false }}
										class="px-3 py-1.5 text-sm text-secondary hover:bg-page"
									>
										{m.common_cancel()}
									</button>
								</div>
							</div>
						{/if}
						<button onclick={deleteFile} class="w-full text-left px-3 py-2 text-sm text-error transition-colors hover:bg-error-bg">
							{m.media_delete_file()}{data.usage.length > 0 ? ` ${m.media_delete_used_suffix({ count: data.usage.length })}` : ''}
						</button>
					{/if}
				</div>
			</div>

			{#if data.versions && data.versions.length > 0}
				<div class="bg-surface p-4">
					<h3 class="text-sm font-semibold text-body mb-3">{m.media_version_history()}</h3>
					<ul class="text-sm space-y-2">
						{#each data.versions as v (v.version)}
							<li class="flex items-start justify-between gap-2 pb-2 border-b border-border-subtle last:border-0 last:pb-0">
								<div class="min-w-0 flex-1">
									<div class="text-body">v{v.version} — {formatBytes(v.sizeBytes)}{v.width && v.height ? `, ${v.width}x${v.height}` : ''}</div>
									<div class="text-xs text-secondary">{new Date(v.archivedAt).toLocaleString()} {v.username ? `· ${v.username}` : ''}</div>
								</div>
								{#if canManageMedia}
									<button
										type="button"
										onclick={() => restoreVersion(v.version)}
										class="shrink-0 text-xs text-link hover:underline"
									>
										{m.media_restore()}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="bg-surface p-4">
				<h3 class="text-sm font-semibold text-body mb-3">{m.media_used_in_pages({ count: data.usage.length })}</h3>
				{#if data.usage.length > 0}
					<ul class="text-sm space-y-1">
						{#each data.usage as slug (slug)}
							<li><a href="/know/{slug}" class="text-link hover:text-link-hover hover:underline">{slug.replaceAll('_', ' ')}</a></li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-secondary">{m.media_not_used()}</p>
				{/if}
			</div>
		</div>
	</div>

	{#if canManageMedia}
		<StickyActionBar
			dirty={isDirty}
			{saving}
			error={saveError}
			{savedAt}
			onsave={saveDetails}
			ondiscard={resetDraft}
			saveLabel={m.media_save_details()}
		/>
	{/if}
</div>

<ConfirmDialog bind:this={confirmDialog} />
