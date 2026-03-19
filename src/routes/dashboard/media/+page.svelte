<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
	let uploading = $state(false);
	let uploadError = $state('');

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	async function handleUpload(e: Event) {
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		uploading = true;
		uploadError = '';

		try {
			const res = await fetch('/api/media', { method: 'POST', body: formData });
			if (!res.ok) {
				const err = await res.json();
				uploadError = err.error || 'Upload failed';
			} else {
				window.location.reload();
			}
		} catch {
			uploadError = 'Upload failed';
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:head>
	<title>Media Library — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Upload -->
	<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
		<h2 class="font-semibold text-stone-800 mb-3">Upload Media</h2>
		<form onsubmit={(e) => { e.preventDefault(); handleUpload(e); }} enctype="multipart/form-data" class="flex items-center gap-3">
			<input type="file" name="file" accept="image/*" required class="text-sm text-stone-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-sm file:bg-amber-50 file:text-amber-700 file:cursor-pointer hover:file:bg-amber-100" />
			<button type="submit" disabled={uploading} class="px-4 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
				{uploading ? 'Uploading...' : 'Upload'}
			</button>
		</form>
		{#if uploadError}
			<p class="text-red-500 text-sm mt-2">{uploadError}</p>
		{/if}
	</div>

	<!-- File list -->
	<div class="bg-white rounded-lg shadow-sm border border-stone-200">
		<div class="px-6 py-4 border-b border-stone-100">
			<h1 class="text-xl font-bold text-stone-900">Media Library</h1>
			<p class="text-sm text-stone-500 mt-1">{data.files.length} files</p>
		</div>

		{#if data.files.length === 0}
			<div class="p-6 text-center text-stone-500">No media uploaded yet.</div>
		{:else}
			<div class="divide-y divide-stone-100">
				{#each data.files as file}
					<div class="px-6 py-3 flex items-center gap-4">
						<div class="w-12 h-12 bg-stone-100 rounded flex items-center justify-center shrink-0 overflow-hidden">
							{#if file.mimeType?.startsWith('image/')}
								<img src="/api/media/{file.filename}" alt={file.filename} class="w-full h-full object-cover" />
							{:else}
								<span class="text-xs text-stone-400">file</span>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-stone-800 truncate">{file.filename}</div>
							<div class="text-xs text-stone-400">
								{formatBytes(file.sizeBytes)}
								{#if file.width && file.height}
									<span class="mx-1">&middot;</span> {file.width}&times;{file.height}
								{/if}
								<span class="mx-1">&middot;</span> Used in {file.usageCount} {file.usageCount === 1 ? 'page' : 'pages'}
							</div>
						</div>
						<span class="text-xs text-stone-400 shrink-0">
							{new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
