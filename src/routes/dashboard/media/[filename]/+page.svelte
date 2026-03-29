<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { goto } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'

	let { data }: { data: PageData } = $props()

	let description = $state(data.file.description || '')
	let categoriesInput = $state(data.categories.join(', '))
	let saving = $state(false)
	let copied = $state(false)
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const layoutData = $derived($page.data)
	const isAdmin = $derived(layoutData.user?.role === 'admin')

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '—'
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / 1048576).toFixed(1)} MB`
	}

	async function saveDetails() {
		saving = true
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
				pushSuccess('Description saved')
				invalidateAll()
			} else {
				pushError('Failed to save description')
			}
		} finally {
			saving = false
		}
	}

	async function deleteFile() {
		const ok = await confirmDialog.confirm('Delete file', `Delete "${data.file.filename}"? This cannot be undone.${data.usage.length > 0 ? ` Warning: used in ${data.usage.length} page(s).` : ''}`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('File deleted')
			goto('/dashboard/media')
		} else {
			pushError('Failed to delete file')
		}
	}

	function copyWikitext() {
		navigator.clipboard.writeText(`[[File:${data.file.filename}|thumb|Caption]]`)
		copied = true
		setTimeout(() => copied = false, 2000)
	}
</script>

<svelte:head>
	<title>{data.file.filename} — Media — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="text-sm text-dim">
		<a href="/dashboard" class="hover:text-link">Dashboard</a>
		<span class="mx-1">›</span>
		<a href="/dashboard/media" class="hover:text-link">Media</a>
		<span class="mx-1">›</span>
		<span class="text-secondary">{data.file.filename}</span>
	</nav>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Image preview -->
		<div class="lg:col-span-2">
			<div class="bg-surface rounded-lg border border-border overflow-hidden">
				<div class="bg-raised p-4 flex items-center justify-center min-h-[300px]">
					<img
						src="/api/media/{data.file.filename}"
						alt={data.file.filename}
						class="max-w-full max-h-[600px] object-contain rounded-sm shadow-sm"
					/>
				</div>

				<!-- Thumbnails -->
				{#if data.file.hasThumb150 || data.file.hasThumb300 || data.file.hasThumb600}
					<div class="px-4 py-3 border-t border-border-subtle">
						<div class="text-xs font-medium text-dim mb-2">Thumbnails</div>
						<div class="flex gap-3">
							{#if data.file.hasThumb150}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=150" alt="150px" class="h-16 object-contain rounded-sm border border-border" />
									<span class="text-[10px] text-faint block mt-1">150px</span>
								</div>
							{/if}
							{#if data.file.hasThumb300}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=300" alt="300px" class="h-16 object-contain rounded-sm border border-border" />
									<span class="text-[10px] text-faint block mt-1">300px</span>
								</div>
							{/if}
							{#if data.file.hasThumb600}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=600" alt="600px" class="h-16 object-contain rounded-sm border border-border" />
									<span class="text-[10px] text-faint block mt-1">600px</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Description & Categories -->
			<div class="bg-surface rounded-lg border border-border p-4 mt-4">
				<h3 class="text-sm font-semibold text-body mb-3">Details</h3>
				<div class="space-y-3">
					<div>
						<label for="desc" class="block text-xs font-medium text-secondary mb-1">Description</label>
						<textarea id="desc" bind:value={description} rows={3} class="
							w-full px-3 py-2 border border-border-strong rounded-lg text-sm
							focus:outline-none focus:ring-2 focus:ring-accent
						" placeholder="Describe this file..."></textarea>
					</div>
					<div>
						<label for="cats" class="block text-xs font-medium text-secondary mb-1">Categories <span class="text-faint">(comma-separated)</span></label>
						<input id="cats" type="text" bind:value={categoriesInput} class="
							w-full px-3 py-2 border border-border-strong rounded-lg text-sm
							focus:outline-none focus:ring-2 focus:ring-accent
						" placeholder="flags, maps, portraits" />
					</div>
					<div class="flex items-center gap-3">
						<button onclick={saveDetails} disabled={saving} class="
							px-4 py-1.5 bg-accent text-surface text-sm rounded-md transition-colors
							hover:bg-accent-hover
							disabled:opacity-50
						">
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Sidebar -->
		<div class="space-y-4">
			<!-- Metadata -->
			<div class="bg-surface rounded-lg border border-border p-4">
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
							<dd class="text-body">{data.file.width} × {data.file.height}</dd>
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
					{#if data.file.hash}
						<div class="flex justify-between">
							<dt class="text-dim">Hash</dt>
							<dd class="text-secondary font-mono text-[10px] truncate max-w-[120px]" title={data.file.hash}>{data.file.hash.slice(0, 12)}…</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Actions -->
			<div class="bg-surface rounded-lg border border-border p-4">
				<h3 class="text-sm font-semibold text-body mb-3">Actions</h3>
				<div class="space-y-2">
					<button onclick={copyWikitext} class="
						w-full text-left px-3 py-2 text-sm rounded-md text-link transition-colors
						hover:bg-accent-subtle
					">
						{copied ? 'Copied!' : 'Copy wikitext'}
					</button>
					<a href="/api/media/{data.file.filename}" target="_blank" class="block px-3 py-2 text-sm rounded-md text-secondary transition-colors hover:bg-page">
						View full size ↗
					</a>
					{#if isAdmin}
						<button onclick={deleteFile} class="
							w-full text-left px-3 py-2 text-sm rounded-md text-red-500 transition-colors
							hover:bg-red-50
						">
							Delete file{data.usage.length > 0 ? ` (used in ${data.usage.length} pages)` : ''}
						</button>
					{/if}
				</div>
			</div>

			<!-- Usage -->
			<div class="bg-surface rounded-lg border border-border p-4">
				<h3 class="text-sm font-semibold text-body mb-3">Used in {data.usage.length} {data.usage.length === 1 ? 'page' : 'pages'}</h3>
				{#if data.usage.length > 0}
					<ul class="text-sm space-y-1">
						{#each data.usage as slug}
							<li>
								<a href="/know/{slug}" class="text-link hover:text-link-hover hover:underline">{slug.replaceAll('_', ' ')}</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-faint">Not used in any pages.</p>
				{/if}
			</div>

			<!-- History -->
			{#if data.history.length > 0}
				<div class="bg-surface rounded-lg border border-border p-4">
					<h3 class="text-sm font-semibold text-body mb-3">History</h3>
					<div class="space-y-2">
						{#each data.history as entry}
							<div class="text-xs text-dim">
								<span class="font-medium text-secondary">{entry.username || 'Unknown'}</span>
								{entry.action === 'upload' ? 'uploaded' : entry.action === 'reupload' ? 'reuploaded' : entry.action === 'describe' ? 'updated description' : entry.action}
								<span class="text-faint">
									{new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if entry.details}
									<div class="text-faint mt-0.5">{entry.details}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
