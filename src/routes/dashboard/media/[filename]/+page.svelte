<script lang="ts">
	import type { PageData } from './$types.js';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let description = $state(data.file.description || '');
	let categoriesInput = $state(data.categories.join(', '));
	let saving = $state(false);
	let saveMessage = $state('');
	let copied = $state(false);

	const layoutData = $derived($page.data);
	const isAdmin = $derived(layoutData.user?.role === 'admin');

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	async function saveDetails() {
		saving = true;
		saveMessage = '';
		try {
			const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: description.trim(),
					categories: categoriesInput ? categoriesInput.split(',').map((c) => c.trim()).filter(Boolean) : []
				})
			});
			if (res.ok) {
				saveMessage = 'Saved';
				invalidateAll();
				setTimeout(() => saveMessage = '', 2000);
			}
		} finally {
			saving = false;
		}
	}

	async function deleteFile() {
		if (!confirm(`Delete "${data.file.filename}"? This cannot be undone.${data.usage.length > 0 ? ` Warning: used in ${data.usage.length} page(s).` : ''}`)) return;
		const res = await fetch(`/api/media/${encodeURIComponent(data.file.filename)}`, { method: 'DELETE' });
		if (res.ok) goto('/dashboard/media');
	}

	function copyWikitext() {
		navigator.clipboard.writeText(`[[File:${data.file.filename}|thumb|Caption]]`);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}
</script>

<svelte:head>
	<title>{data.file.filename} — Media — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="text-sm text-stone-500">
		<a href="/dashboard" class="hover:text-amber-700">Dashboard</a>
		<span class="mx-1">›</span>
		<a href="/dashboard/media" class="hover:text-amber-700">Media</a>
		<span class="mx-1">›</span>
		<span class="text-stone-700">{data.file.filename}</span>
	</nav>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Image preview -->
		<div class="lg:col-span-2">
			<div class="bg-white rounded-lg border border-stone-200 overflow-hidden">
				<div class="bg-stone-100 p-4 flex items-center justify-center min-h-[300px]">
					<img
						src="/api/media/{data.file.filename}"
						alt={data.file.filename}
						class="max-w-full max-h-[600px] object-contain rounded shadow-sm"
					/>
				</div>

				<!-- Thumbnails -->
				{#if data.file.hasThumb150 || data.file.hasThumb300 || data.file.hasThumb600}
					<div class="px-4 py-3 border-t border-stone-100">
						<div class="text-xs font-medium text-stone-500 mb-2">Thumbnails</div>
						<div class="flex gap-3">
							{#if data.file.hasThumb150}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=150" alt="150px" class="h-16 object-contain rounded border border-stone-200" />
									<span class="text-[10px] text-stone-400 block mt-1">150px</span>
								</div>
							{/if}
							{#if data.file.hasThumb300}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=300" alt="300px" class="h-16 object-contain rounded border border-stone-200" />
									<span class="text-[10px] text-stone-400 block mt-1">300px</span>
								</div>
							{/if}
							{#if data.file.hasThumb600}
								<div class="text-center">
									<img src="/api/media/{data.file.filename}?w=600" alt="600px" class="h-16 object-contain rounded border border-stone-200" />
									<span class="text-[10px] text-stone-400 block mt-1">600px</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Description & Categories -->
			<div class="bg-white rounded-lg border border-stone-200 p-4 mt-4">
				<h3 class="text-sm font-semibold text-stone-800 mb-3">Details</h3>
				<div class="space-y-3">
					<div>
						<label for="desc" class="block text-xs font-medium text-stone-600 mb-1">Description</label>
						<textarea id="desc" bind:value={description} rows={3} class="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Describe this file..."></textarea>
					</div>
					<div>
						<label for="cats" class="block text-xs font-medium text-stone-600 mb-1">Categories <span class="text-stone-400">(comma-separated)</span></label>
						<input id="cats" type="text" bind:value={categoriesInput} class="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="flags, maps, portraits" />
					</div>
					<div class="flex items-center gap-3">
						<button onclick={saveDetails} disabled={saving} class="px-4 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
							{saving ? 'Saving...' : 'Save'}
						</button>
						{#if saveMessage}
							<span class="text-sm text-green-600">{saveMessage}</span>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Sidebar -->
		<div class="space-y-4">
			<!-- Metadata -->
			<div class="bg-white rounded-lg border border-stone-200 p-4">
				<h3 class="text-sm font-semibold text-stone-800 mb-3">File Info</h3>
				<dl class="text-sm space-y-2">
					<div class="flex justify-between">
						<dt class="text-stone-500">Filename</dt>
						<dd class="text-stone-800 font-mono text-xs">{data.file.filename}</dd>
					</div>
					{#if data.file.originalFilename && data.file.originalFilename !== data.file.filename}
						<div class="flex justify-between">
							<dt class="text-stone-500">Original</dt>
							<dd class="text-stone-800 text-xs">{data.file.originalFilename}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-stone-500">Type</dt>
						<dd class="text-stone-800">{data.file.mimeType}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-stone-500">Size</dt>
						<dd class="text-stone-800">{formatBytes(data.file.sizeBytes)}</dd>
					</div>
					{#if data.file.width && data.file.height}
						<div class="flex justify-between">
							<dt class="text-stone-500">Dimensions</dt>
							<dd class="text-stone-800">{data.file.width} × {data.file.height}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-stone-500">Uploaded</dt>
						<dd class="text-stone-800">{new Date(data.file.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
					</div>
					{#if data.uploaderName}
						<div class="flex justify-between">
							<dt class="text-stone-500">By</dt>
							<dd class="text-stone-800">{data.uploaderName}</dd>
						</div>
					{/if}
					{#if data.file.hash}
						<div class="flex justify-between">
							<dt class="text-stone-500">Hash</dt>
							<dd class="text-stone-600 font-mono text-[10px] truncate max-w-[120px]" title={data.file.hash}>{data.file.hash.slice(0, 12)}…</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Actions -->
			<div class="bg-white rounded-lg border border-stone-200 p-4">
				<h3 class="text-sm font-semibold text-stone-800 mb-3">Actions</h3>
				<div class="space-y-2">
					<button onclick={copyWikitext} class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-amber-50 text-amber-700 transition-colors">
						{copied ? 'Copied!' : 'Copy wikitext'}
					</button>
					<a href="/api/media/{data.file.filename}" target="_blank" class="block px-3 py-2 text-sm rounded-md hover:bg-stone-50 text-stone-600 transition-colors">
						View full size ↗
					</a>
					{#if isAdmin}
						<button onclick={deleteFile} class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-red-50 text-red-500 transition-colors">
							Delete file{data.usage.length > 0 ? ` (used in ${data.usage.length} pages)` : ''}
						</button>
					{/if}
				</div>
			</div>

			<!-- Usage -->
			<div class="bg-white rounded-lg border border-stone-200 p-4">
				<h3 class="text-sm font-semibold text-stone-800 mb-3">Used in {data.usage.length} {data.usage.length === 1 ? 'page' : 'pages'}</h3>
				{#if data.usage.length > 0}
					<ul class="text-sm space-y-1">
						{#each data.usage as slug}
							<li>
								<a href="/know/{slug}" class="text-amber-700 hover:text-amber-900 hover:underline">{slug.replace(/_/g, ' ')}</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-stone-400">Not used in any pages.</p>
				{/if}
			</div>

			<!-- History -->
			{#if data.history.length > 0}
				<div class="bg-white rounded-lg border border-stone-200 p-4">
					<h3 class="text-sm font-semibold text-stone-800 mb-3">History</h3>
					<div class="space-y-2">
						{#each data.history as entry}
							<div class="text-xs text-stone-500">
								<span class="font-medium text-stone-700">{entry.username || 'Unknown'}</span>
								{entry.action === 'upload' ? 'uploaded' : entry.action === 'reupload' ? 'reuploaded' : entry.action === 'describe' ? 'updated description' : entry.action}
								<span class="text-stone-400">
									{new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if entry.details}
									<div class="text-stone-400 mt-0.5">{entry.details}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
