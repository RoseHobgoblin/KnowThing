<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Skeleton from '$lib/components/ui/Skeleton.svelte'

	type MediaFile = {
		id: number
		filename: string
		mimeType: string | null
		width: number | null
		height: number | null
		sizeBytes: number | null
		description: string | null
		hasThumb150: boolean | null
		uploadedAt: string
		usageCount: number
	}

	let files = $state<MediaFile[]>([])
	let total = $state(0)
	let loading = $state(true)
	let searchQuery = $state('')
	let sortBy = $state('newest')
	let showUnused = $state(false)
	let viewMode = $state<'grid' | 'list'>('grid')
	let currentPage = $state(0)
	const perPage = 50

	// Upload state
	let uploading = $state(false)
	let uploadProgress = $state('')
	let uploadError = $state('')
	let dragOver = $state(false)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '—'
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / 1048576).toFixed(1)} MB`
	}

	async function loadFiles() {
		loading = true
		const params = new URLSearchParams()
		if (searchQuery) params.set('q', searchQuery)
		params.set('sort', sortBy)
		if (showUnused) params.set('unused', 'true')
		params.set('limit', String(perPage))
		params.set('offset', String(currentPage * perPage))

		const res = await fetch(`/api/media?${params}`)
		if (res.ok) {
			const data = await res.json()
			files = data.files
			total = data.total
		}
		loading = false
	}

	let searchTimeout: ReturnType<typeof setTimeout>
	function handleSearch() {
		clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			currentPage = 0
			loadFiles()
		}, 300)
	}

	async function uploadFile(file: File) {
		uploading = true
		uploadError = ''
		uploadProgress = `Uploading ${file.name}...`

		const formData = new FormData()
		formData.append('file', file)

		try {
			const res = await fetch('/api/media', { method: 'POST', body: formData })
			if (res.ok) {
				uploadProgress = ''
				pushSuccess(`Uploaded ${file.name}`)
				loadFiles()
			} else {
				const error = await res.json()
				pushError(error.error || 'Upload failed')
			}
		} catch {
			pushError('Upload failed')
		} finally {
			uploading = false
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement
		if (input.files) {
			for (const file of input.files) {
				uploadFile(file)
			}
			input.value = ''
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault()
		dragOver = false
		if (e.dataTransfer?.files) {
			for (const file of e.dataTransfer.files) {
				if (file.type.startsWith('image/')) {
					uploadFile(file)
				}
			}
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault()
		dragOver = true
	}

	const totalPages = $derived(Math.ceil(total / perPage))
	const unifiedSearchHref = $derived.by(() => {
		const params = new URLSearchParams()
		params.set('scope', 'media')
		if (searchQuery.trim()) params.set('q', searchQuery.trim())
		if (showUnused) params.set('unused', 'true')
		return `/search?${params.toString()}`
	})

	let sortByInitialized = false
	$effect(() => {
		sortBy  // subscribe to sortBy changes
		if (!sortByInitialized) { sortByInitialized = true; return }
		currentPage = 0
		loadFiles()
	})

	onMount(loadFiles)
</script>

<svelte:head>
	<title>Media Library — KnowThing</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-heading">Media Library</h1>
			<p class="text-sm text-dim">Browse and manage uploaded files. Use unified search for cross-domain search behavior.</p>
		</div>
		<div class="flex items-center gap-3">
			<a href={unifiedSearchHref} class="text-sm text-link hover:text-link-hover">Open in search</a>
			<span class="text-sm text-dim">{total} files</span>
		</div>
	</div>

	<!-- Drop zone + Upload -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if permissions.canManageMedia}
		<div
			class="relative border-2 border-dashed p-6 text-center transition-colors
				{dragOver ? 'border-accent-border bg-accent-subtle' : 'border-border-strong bg-surface hover:border-border-strong'}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={() => dragOver = false}
		>
			<div class="text-dim text-sm mb-2">
				{#if dragOver}
					Drop to upload
				{:else if uploading}
					{uploadProgress}
				{:else}
					Drag & drop images here, or
				{/if}
			</div>
			{#if !uploading}
				<label class="
					inline-block px-4 py-1.5 bg-accent text-surface text-sm cursor-pointer
					transition-colors
					hover:bg-accent-hover
				">
					Choose files
					<input type="file" accept="image/*" multiple onchange={handleFileInput} class="hidden" />
				</label>
			{/if}
			{#if uploadError}
				<p class="text-error text-sm mt-2">{uploadError}</p>
			{/if}
		</div>
	{:else if permissions.isAuthenticated}
		<div class="border border-border-subtle bg-surface p-6 text-center">
			<p class="text-sm text-faint">Editor role required to upload media.</p>
		</div>
	{/if}

	<!-- Controls -->
	<div class="flex flex-wrap gap-3 items-center">
		<Input
			type="text"
			bind:value={searchQuery}
			oninput={handleSearch}
			placeholder="Search files..."
			class="flex-1 min-w-[200px]"
		/>

		<Select
			type="single"
			bind:value={sortBy}
			items={[
				{ value: 'newest', label: 'Newest' },
				{ value: 'oldest', label: 'Oldest' },
				{ value: 'name', label: 'Name' },
				{ value: 'size', label: 'Largest' },
				{ value: 'usage', label: 'Most used' },
			]}
		/>

		<Checkbox bind:value={showUnused} label="Unused only" onclick={() => { currentPage = 0; loadFiles() }} />

		<div class="flex border border-border-strong overflow-hidden">
			<button
				onclick={() => viewMode = 'grid'}
				class="px-2.5 py-1.5 text-xs {viewMode === 'grid' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page'}"
			>Grid</button>
			<button
				onclick={() => viewMode = 'list'}
				class="px-2.5 py-1.5 text-xs {viewMode === 'list' ? 'bg-accent text-surface' : 'bg-surface text-secondary hover:bg-page'}"
			>List</button>
		</div>

		<button
			type="button"
			onclick={() => goto(unifiedSearchHref)}
			class="px-3 py-2 text-xs border border-border text-secondary hover:bg-page"
		>
			Search View
		</button>
	</div>

	<!-- File grid/list -->
	{#if loading}
		{#if viewMode === 'grid'}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true" aria-label="Loading media">
				{#each Array(12) as _}
					<div class="bg-surface border border-border overflow-hidden">
						<Skeleton class="aspect-square w-full" />
						<div class="p-2 space-y-1.5">
							<Skeleton class="h-3 w-3/4" />
							<Skeleton class="h-3 w-1/2" />
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="bg-surface border border-border divide-y divide-border-subtle" aria-busy="true" aria-label="Loading media">
				{#each Array(8) as _}
					<div class="flex items-center gap-4 px-4 py-3">
						<Skeleton class="size-12 shrink-0" />
						<div class="flex-1 min-w-0 space-y-1.5">
							<Skeleton class="h-4 w-1/3" />
							<Skeleton class="h-3 w-2/3" />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else if files.length === 0}
		<div class="text-center py-12 text-faint">
			{searchQuery ? 'No files match your search.' : 'No media uploaded yet.'}
		</div>
	{:else if viewMode === 'grid'}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each files as file}
				<a
					href="/dashboard/media/{encodeURIComponent(file.filename)}"
					class="
						group bg-surface border border-border overflow-hidden transition-all
						hover:border-accent-border hover:shadow-md
					"
				>
					<div class="aspect-square bg-raised flex items-center justify-center overflow-hidden">
						{#if file.mimeType?.startsWith('image/')}
							<img
								src="/api/media/{file.filename}?w=150"
								alt={file.filename}
								loading="lazy"
								class="size-full object-cover transition-transform group-hover:scale-105"
							/>
						{:else}
							<span class="text-xs text-faint">file</span>
						{/if}
					</div>
					<div class="p-2">
						<div class="text-xs font-medium text-body truncate group-hover:text-link">{file.filename}</div>
						<div class="flex items-center gap-1 text-xs text-faint mt-0.5">
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
		<div class="bg-surface border border-border divide-y divide-border-subtle">
			{#each files as file}
				<a href="/dashboard/media/{encodeURIComponent(file.filename)}" class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent-subtle/30">
					<div class="
						size-12 bg-raised flex items-center justify-center shrink-0 overflow-hidden
					">
						{#if file.mimeType?.startsWith('image/')}
							<img src="/api/media/{file.filename}?w=150" alt={file.filename} loading="lazy" class="size-full object-cover" />
						{:else}
							<span class="text-xs text-faint">file</span>
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-body truncate">{file.filename}</div>
						<div class="text-xs text-faint">
							{formatBytes(file.sizeBytes)}
							{#if file.width && file.height}
								<span class="mx-1">·</span> {file.width}×{file.height}
							{/if}
							<span class="mx-1">·</span> {file.usageCount} {file.usageCount === 1 ? 'page' : 'pages'}
							{#if file.description}
								<span class="mx-1">·</span> <span class="text-dim">{file.description}</span>
							{/if}
						</div>
					</div>
					<span class="text-xs text-faint shrink-0">
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
				onclick={() => { currentPage = Math.max(0, currentPage - 1); loadFiles() }}
				disabled={currentPage === 0}
				class="
					px-3 py-1 text-sm border border-border-strong
					disabled:opacity-30
					hover:bg-page
				"
			>←</button>
			<span class="px-3 py-1 text-sm text-secondary">
				{currentPage + 1} / {totalPages}
			</span>
			<button
				onclick={() => { currentPage = Math.min(totalPages - 1, currentPage + 1); loadFiles() }}
				disabled={currentPage >= totalPages - 1}
				class="
					px-3 py-1 text-sm border border-border-strong
					disabled:opacity-30
					hover:bg-page
				"
			>→</button>
		</div>
	{/if}
</div>
