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

	let { data }: { data: PageData } = $props()
	const initialFile = $state.snapshot(untrack(() => data.file))
	const initialCategories = $state.snapshot(untrack(() => data.categories))
	const initialDetails = {
		description: initialFile.description || '',
		categoriesInput: initialCategories.join(', '),
	}

	let description = $state(initialDetails.description)
	let categoriesInput = $state(initialDetails.categoriesInput)
	let saving = $state(false)
	let saveError = $state('')
	let savedAt = $state<Date | null>(null)
	let copied = $state(false)
	let confirmDialog: ReturnType<typeof ConfirmDialog>
	let stablePermissions = $state(normalizePermissions(data.permissions))

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
		saving = true
		saveError = ''
		try {
			const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: description.trim(),
					categories: categoriesInput ? categoriesInput.split(',').map(c => c.trim()).filter(Boolean) : [],
				}),
			})
			if (res.ok) {
				savedSnapshot = currentSnapshot
				savedAt = new Date()
				pushSuccess('File details saved')
				invalidateAll()
			} else {
				const body = await res.json().catch(() => ({}))
				saveError = body.error || 'Failed to save file details'
				pushError(saveError)
			}
		} finally {
			saving = false
		}
	}

	async function deleteFile() {
		const ok = await confirmDialog.confirm(
			'Delete file',
			`Delete "${data.file.filename}"? This cannot be undone.${data.usage.length > 0 ? ` Warning: used in ${data.usage.length} page(s).` : ''}`,
			'Delete file',
			'Cancel',
		)
		if (!ok) return
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('File deleted')
			goto('/dashboard/media')
		} else {
			const body = await res.json().catch(() => ({}))
			pushError(body.error || 'Failed to delete file')
		}
	}

	function copyWikitext() {
		navigator.clipboard.writeText(`[[File:${data.file.filename}|thumb|Caption]]`)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	let replaceInput: HTMLInputElement | undefined
	let replacing = $state(false)

	async function onReplaceFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		replacing = true
		const formData = new FormData()
		formData.set('file', file)
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, {
			method: 'POST',
			body: formData,
		})
		replacing = false
		input.value = ''
		if (res.ok) {
			pushSuccess('Uploaded as new version. Previous version archived.')
			invalidateAll()
		} else {
			const body = await res.json().catch(() => ({}))
			pushError(body.error || 'Failed to replace file')
		}
	}

	async function restoreVersion(version: number) {
		const ok = await confirmDialog.confirm(
			'Restore version',
			`Restore version ${version}? Current version will be archived.`,
			'Restore',
			'Cancel',
		)
		if (!ok) return
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'restore', version }),
		})
		if (res.ok) {
			pushSuccess(`Restored version ${version}.`)
			invalidateAll()
		} else {
			const body = await res.json().catch(() => ({}))
			pushError(body.error || 'Failed to restore version')
		}
	}

	let renameInput = $state(data.file.filename)
	let renaming = $state(false)
	let renameOpen = $state(false)

	async function submitRename() {
		const target = renameInput.trim()
		if (!target || target === data.file.filename) {
			renameOpen = false
			return
		}
		renaming = true
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'rename', newFilename: target }),
		})
		renaming = false
		if (res.ok) {
			const body = await res.json().catch(() => ({}))
			const finalName: string = body.newFilename ?? target
			pushSuccess(`Renamed to ${finalName}. ${body.rewrittenPages ?? 0} page(s) updated.`)
			renameOpen = false
			goto(`/media/${encodeURIComponent(finalName)}`)
		} else {
			const body = await res.json().catch(() => ({}))
			pushError(body.error || 'Failed to rename file')
		}
	}
</script>

<svelte:head>
	<title>{data.file.filename} - Media - KnowThing</title>
</svelte:head>

<UnsavedChangesGuard when={isDirty && !saving} />

<div class="space-y-6">
	<nav class="text-sm text-dim">
		{#if canManageMedia}
			<a href="/dashboard/media" class="hover:text-link">Media</a>
			<span class="mx-1">></span>
		{/if}
		<span class="text-secondary">{data.file.filename}</span>
	</nav>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<div class="bg-surface border border-border overflow-hidden">
				<div class="bg-raised p-4 flex items-center justify-center min-h-75">
					<img
						src="/api/media/{data.file.filename}"
						alt={data.file.filename}
						class="max-w-full max-h-150 object-contain shadow-sm"
					/>
				</div>

				{#if data.file.hasThumb150 || data.file.hasThumb300 || data.file.hasThumb600}
					<div class="px-4 py-3 border-t border-border-subtle">
						<div class="text-xs font-medium text-dim mb-2">Thumbnails</div>
						<div class="flex gap-3">
							{#if data.file.hasThumb150}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=150" alt="150px" class="h-16 object-contain border border-border" />
									<span class="text-xs text-faint block mt-1">150px</span>
								</div>
							{/if}
							{#if data.file.hasThumb300}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=300" alt="300px" class="h-16 object-contain border border-border" />
									<span class="text-xs text-faint block mt-1">300px</span>
								</div>
							{/if}
							{#if data.file.hasThumb600}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=600" alt="600px" class="h-16 object-contain border border-border" />
									<span class="text-xs text-faint block mt-1">600px</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			{#if canManageMedia}
				<div class="bg-surface border border-border p-4 mt-4 space-y-4">
					<RecordModeBanner
						modeLabel="Configure Media"
						title="File Details"
						description="Edit metadata, categories, and usage-facing details for this file."
					/>

					{#if saveError}
						<FormNotice title="Media details were not saved" message={saveError} />
					{/if}

					<div class="space-y-3">
						<div>
							<label for="desc" class="block text-xs font-medium text-secondary mb-1">Description</label>
							<textarea
								id="desc"
								bind:value={description}
								rows={3}
								class="w-full px-3 py-2 border border-border-strong text-sm focus:outline-none focus:ring-2 focus:ring-accent"
								placeholder="Describe this file..."
							></textarea>
						</div>
						<div>
							<Input
								id="cats"
								label="Categories"
								hint="Comma-separated"
								type="text"
								bind:value={categoriesInput}
								placeholder="flags, maps, portraits"
							/>
						</div>
					</div>
				</div>
			{:else if data.file.description}
				<div class="bg-surface border border-border p-4 mt-4">
					<h3 class="text-sm font-semibold text-body mb-2">Description</h3>
					<p class="text-sm text-body whitespace-pre-wrap">{data.file.description}</p>
				</div>
			{/if}
		</div>

		<div class="space-y-4">
			<div class="bg-surface border border-border p-4">
				<h3 class="text-sm font-semibold text-body mb-3">File Info</h3>
				<dl class="text-sm space-y-2">
					<div class="flex justify-between">
						<dt class="text-dim">Filename</dt>
						<dd class="text-body font-mono text-xs">{data.file.filename}</dd>
					</div>
					{#if data.file.originalFilename && data.file.originalFilename !== data.file.filename}
						<div class="flex justify-between">
							<dt class="text-dim">Original</dt>
							<dd class="text-body text-xs">{data.file.originalFilename}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-dim">Type</dt>
						<dd class="text-body">{data.file.mimeType}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-dim">Size</dt>
						<dd class="text-body">{formatBytes(data.file.sizeBytes)}</dd>
					</div>
					{#if data.file.width && data.file.height}
						<div class="flex justify-between">
							<dt class="text-dim">Dimensions</dt>
							<dd class="text-body">{data.file.width} x {data.file.height}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-dim">Uploaded</dt>
						<dd class="text-body">{new Date(data.file.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
					</div>
					{#if data.uploaderName}
						<div class="flex justify-between">
							<dt class="text-dim">By</dt>
							<dd class="text-body">{data.uploaderName}</dd>
						</div>
					{/if}
				</dl>
			</div>

			<div class="bg-surface border border-border p-4">
				<h3 class="text-sm font-semibold text-body mb-3">Actions</h3>
				<div class="space-y-2">
					{#if canManageMedia}
						<button onclick={copyWikitext} class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle">
							{copied ? 'Copied!' : 'Copy wikitext'}
						</button>
					{/if}
					<a href="/api/media/{data.file.filename}" target="_blank" class="block px-3 py-2 text-sm text-secondary transition-colors hover:bg-page">
						View full size ->
					</a>
					{#if data.file.mimeType === 'image/svg+xml'}
						<a href="/api/media/{data.file.filename}?format=svg" target="_blank" download class="block px-3 py-2 text-sm text-secondary transition-colors hover:bg-page">
							Download original SVG ->
						</a>
					{/if}
					{#if canManageMedia}
						<button
							type="button"
							onclick={() => replaceInput?.click()}
							disabled={replacing}
							class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle disabled:opacity-50"
						>
							{replacing ? 'Uploading...' : 'Upload new version'}
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
							onclick={() => { renameOpen = !renameOpen; renameInput = data.file.filename }}
							class="w-full text-left px-3 py-2 text-sm text-link transition-colors hover:bg-accent-subtle"
						>
							Rename file
						</button>
						{#if renameOpen}
							<div class="px-3 py-2 space-y-2 bg-raised">
								<Input
									id="rename"
									label="New filename"
									hint="Pages referencing this file will be rewritten."
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
										{renaming ? 'Renaming...' : 'Rename'}
									</button>
									<button
										type="button"
										onclick={() => { renameOpen = false }}
										class="px-3 py-1.5 text-sm text-secondary hover:bg-page"
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}
						<button onclick={deleteFile} class="w-full text-left px-3 py-2 text-sm text-error transition-colors hover:bg-error-bg">
							Delete file{data.usage.length > 0 ? ` (used in ${data.usage.length} pages)` : ''}
						</button>
					{/if}
				</div>
			</div>

			{#if data.versions && data.versions.length > 0}
				<div class="bg-surface border border-border p-4">
					<h3 class="text-sm font-semibold text-body mb-3">Version history</h3>
					<ul class="text-sm space-y-2">
						{#each data.versions as v}
							<li class="flex items-start justify-between gap-2 pb-2 border-b border-border-subtle last:border-0 last:pb-0">
								<div class="min-w-0 flex-1">
									<div class="text-body">v{v.version} — {formatBytes(v.sizeBytes)}{v.width && v.height ? `, ${v.width}x${v.height}` : ''}</div>
									<div class="text-xs text-faint">{new Date(v.archivedAt).toLocaleString()} {v.username ? `· ${v.username}` : ''}</div>
								</div>
								{#if canManageMedia}
									<button
										type="button"
										onclick={() => restoreVersion(v.version)}
										class="shrink-0 text-xs text-link hover:underline"
									>
										Restore
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="bg-surface border border-border p-4">
				<h3 class="text-sm font-semibold text-body mb-3">Used in {data.usage.length} {data.usage.length === 1 ? 'page' : 'pages'}</h3>
				{#if data.usage.length > 0}
					<ul class="text-sm space-y-1">
						{#each data.usage as slug}
							<li><a href="/know/{slug}" class="text-link hover:text-link-hover hover:underline">{slug.replaceAll('_', ' ')}</a></li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-faint">Not used in any pages.</p>
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
			saveLabel="Save details"
		/>
	{/if}
</div>

<ConfirmDialog bind:this={confirmDialog} />
