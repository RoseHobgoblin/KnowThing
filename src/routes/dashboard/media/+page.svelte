<script lang="ts">
	import { onMount } from 'svelte';

	type MediaFile = {
		id: number;
		filename: string;
		mimeType: string | null;
		width: number | null;
		height: number | null;
		sizeBytes: number | null;
		description: string | null;
		hasThumb150: boolean | null;
		uploadedAt: string;
		usageCount: number;
	};

	let files = $state<MediaFile[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let searchQuery = $state('');
	let sortBy = $state('newest');
	let showUnused = $state(false);
	let viewMode = $state<'grid' | 'list'>('grid');
	let currentPage = $state(0);
	const perPage = 50;

	// Upload state
	let uploading = $state(false);
	let uploadProgress = $state('');
	let uploadError = $state('');
	let dragOver = $state(false);

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	async function loadFiles() {
		loading = true;
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		params.set('sort', sortBy);
		if (showUnused) params.set('unused', 'true');
		params.set('limit', String(perPage));
		params.set('offset', String(currentPage * perPage));

		const res = await fetch(`/api/media?${params}`);
		if (res.ok) {
			const data = await res.json();
			files = data.files;
			total = data.total;
		}
		loading = false;
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			currentPage = 0;
			loadFiles();
		}, 300);
	}

	async function uploadFile(file: File) {
		uploading = true;
		uploadError = '';
		uploadProgress = `Uploading ${file.name}...`;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch('/api/media', { method: 'POST', body: formData });
			if (!res.ok) {
				const err = await res.json();
				uploadError = err.error || 'Upload failed';
			} else {
				uploadProgress = '';
				loadFiles();
			}
		} catch {
			uploadError = 'Upload failed';
		} finally {
			uploading = false;
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			for (const file of input.files) {
				uploadFile(file);
			}
			input.value = '';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) {
			for (const file of e.dataTransfer.files) {
				if (file.type.startsWith('image/')) {
					uploadFile(file);
				}
			}
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	const totalPages = $derived(Math.ceil(total / perPage));

	onMount(loadFiles);
</script>

<svelte:head>
	<title>Media Library — KnowThing</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold text-stone-900">Media Library</h1>
		<span class="text-sm text-stone-500">{total} files</span>
	</div>

	<!-- Drop zone + Upload -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
			{dragOver ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-white hover:border-stone-400'}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={() => dragOver = false}
	>
		<div class="text-stone-500 text-sm mb-2">
			{#if dragOver}
				Drop to upload
			{:else if uploading}
				{uploadProgress}
			{:else}
				Drag & drop images here, or
			{/if}
		</div>
		{#if !uploading}
			<label class="inline-block px-4 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 cursor-pointer transition-colors">
				Choose files
				<input type="file" accept="image/*" multiple onchange={handleFileInput} class="hidden" />
			</label>
		{/if}
		{#if uploadError}
			<p class="text-red-500 text-sm mt-2">{uploadError}</p>
		{/if}
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap gap-3 items-center">
		<input
			type="text"
			bind:value={searchQuery}
			oninput={handleSearch}
			placeholder="Search files..."
			class="flex-1 min-w-[200px] px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
		/>

		<select
			bind:value={sortBy}
			onchange={() => { currentPage = 0; loadFiles(); }}
			class="px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
		>
			<option value="newest">Newest</option>
			<option value="oldest">Oldest</option>
			<option value="name">Name</option>
			<option value="size">Largest</option>
			<option value="usage">Most used</option>
		</select>

		<label class="flex items-center gap-1.5 text-sm text-stone-600">
			<input type="checkbox" bind:checked={showUnused} onchange={() => { currentPage = 0; loadFiles(); }} class="rounded border-stone-300 text-amber-600 focus:ring-amber-400" />
			Unused only
		</label>

		<div class="flex border border-stone-300 rounded-lg overflow-hidden">
			<button
				onclick={() => viewMode = 'grid'}
				class="px-2.5 py-1.5 text-xs {viewMode === 'grid' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}"
			>Grid</button>
			<button
				onclick={() => viewMode = 'list'}
				class="px-2.5 py-1.5 text-xs {viewMode === 'list' ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}"
			>List</button>
		</div>
	</div>

	<!-- File grid/list -->
	{#if loading}
		<div class="text-center py-12 text-stone-400">Loading...</div>
	{:else if files.length === 0}
		<div class="text-center py-12 text-stone-400">
			{searchQuery ? 'No files match your search.' : 'No media uploaded yet.'}
		</div>
	{:else if viewMode === 'grid'}
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
			{#each files as file}
				<a
					href="/dashboard/media/{encodeURIComponent(file.filename)}"
					class="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:border-amber-300 hover:shadow-md transition-all"
				>
					<div class="aspect-square bg-stone-100 flex items-center justify-center overflow-hidden">
						{#if file.mimeType?.startsWith('image/')}
							<img
								src="/api/media/{file.filename}?w=150"
								alt={file.filename}
								loading="lazy"
								class="w-full h-full object-cover group-hover:scale-105 transition-transform"
							/>
						{:else}
							<span class="text-xs text-stone-400">file</span>
						{/if}
					</div>
					<div class="p-2">
						<div class="text-xs font-medium text-stone-800 truncate group-hover:text-amber-700">{file.filename}</div>
						<div class="flex items-center gap-1 text-[10px] text-stone-400 mt-0.5">
							{#if file.width && file.height}
								<span>{file.width}×{file.height}</span>
								<span>·</span>
							{/if}
							<span>{formatBytes(file.sizeBytes)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
			{#each files as file}
				<a href="/dashboard/media/{encodeURIComponent(file.filename)}" class="flex items-center gap-4 px-4 py-3 hover:bg-amber-50/30 transition-colors">
					<div class="w-12 h-12 bg-stone-100 rounded flex items-center justify-center shrink-0 overflow-hidden">
						{#if file.mimeType?.startsWith('image/')}
							<img src="/api/media/{file.filename}?w=150" alt={file.filename} loading="lazy" class="w-full h-full object-cover" />
						{:else}
							<span class="text-xs text-stone-400">file</span>
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-stone-800 truncate">{file.filename}</div>
						<div class="text-xs text-stone-400">
							{formatBytes(file.sizeBytes)}
							{#if file.width && file.height}
								<span class="mx-1">·</span> {file.width}×{file.height}
							{/if}
							<span class="mx-1">·</span> {file.usageCount} {file.usageCount === 1 ? 'page' : 'pages'}
							{#if file.description}
								<span class="mx-1">·</span> <span class="text-stone-500">{file.description}</span>
							{/if}
						</div>
					</div>
					<span class="text-xs text-stone-400 shrink-0">
						{new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
					</span>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex justify-center gap-2 pt-2">
			<button
				onclick={() => { currentPage = Math.max(0, currentPage - 1); loadFiles(); }}
				disabled={currentPage === 0}
				class="px-3 py-1 text-sm rounded-md border border-stone-300 disabled:opacity-30 hover:bg-stone-50"
			>←</button>
			<span class="px-3 py-1 text-sm text-stone-600">
				{currentPage + 1} / {totalPages}
			</span>
			<button
				onclick={() => { currentPage = Math.min(totalPages - 1, currentPage + 1); loadFiles(); }}
				disabled={currentPage >= totalPages - 1}
				class="px-3 py-1 text-sm rounded-md border border-stone-300 disabled:opacity-30 hover:bg-stone-50"
			>→</button>
		</div>
	{/if}
</div>
